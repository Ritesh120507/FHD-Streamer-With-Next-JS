/**
 * NovaStream - Viewer Controller Module
 * Handles WebRTC client reception, 1080p60 playback, low-latency audio & Firestore signaling
 */

import { doc, getDoc, setDoc, deleteDoc, updateDoc, onSnapshot, collection, addDoc, arrayUnion } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { initFirebase } from './firebase-config.js';
import { getCurrentUser } from './auth.js';
import { getRTCConfig, hasTurnServers, waitForIceGathering, triggerIceRestart, startStatsMonitor, prioritize4KCodecs, captureViewerMicrophone, enhanceSDP } from './webrtc.js';

let peerConnection = null;
let currentRoomId = null;
let remoteStream = null;
let viewerMicStream = null;
let viewerMicSender = null;
let isViewerMicMuted = false;
let stopStatsMonitor = null;
let roomUnsubscribe = null;
let candidatesUnsubscribe = null;

/**
 * Join an active stream room
 */
export async function joinStream(roomId, callbacks = {}) {
  const user = getCurrentUser();
  if (!user) {
    throw new Error("You must be signed in with Google to watch streams.");
  }

  const { db } = initFirebase();
  if (!db) {
    throw new Error("Firebase database is not initialized.");
  }

  const normalizedRoomId = roomId.trim().toUpperCase();
  currentRoomId = normalizedRoomId;

  const {
    onStreamTrackReceived,
    onHostDetails,
    onStatsUpdate,
    onStreamEnded,
    onStreamPauseChanged,
    onError
  } = callbacks;

  try {
    const roomRef = doc(db, 'rooms', normalizedRoomId);
    const roomSnapshot = await getDoc(roomRef);

    if (!roomSnapshot.exists()) {
      throw new Error(`Stream Room "${normalizedRoomId}" does not exist. Please verify the room code.`);
    }

    const roomData = roomSnapshot.data();
    if (roomData.status === 'ended') {
      throw new Error("This stream has already ended.");
    }

    if (!roomData.offer) {
      throw new Error("Stream is not ready yet. Please wait a moment and try again.");
    }

    if (onHostDetails) {
      onHostDetails(roomData.host, roomData.settings);
    }

    // 1. Create PeerConnection with STUN & Host-shared TURN servers
    const rtcConfig = await getRTCConfig(roomData.iceServers);
    peerConnection = new RTCPeerConnection(rtcConfig);
    prioritize4KCodecs(peerConnection);
    remoteStream = new MediaStream();

    let remoteDescriptionSet = false;
    const pendingCandidates = [];

    // 2. Handle incoming video and audio tracks with ultra-low latency & jitter tuning
    peerConnection.ontrack = (event) => {
      console.log("[NovaStream] Received remote track:", event.track.kind);

      if (event.receiver) {
        // Enforce immediate playout delay & micro-jitter buffer for butter-smooth 120Hz/60Hz frame delivery
        try {
          if ('playoutDelayHint' in event.receiver) {
            event.receiver.playoutDelayHint = 0; // Immediate playout
          }
        } catch (_) {}
        try {
          if ('jitterBufferTarget' in event.receiver) {
            // W3C spec: 15ms target (~1.5 frames at 120Hz) eliminates jitter without buffering delay
            event.receiver.jitterBufferTarget = 15;
          }
        } catch (_) {}
      }

      event.streams[0].getTracks().forEach((track) => {
        if (!remoteStream.getTracks().some(t => t.id === track.id)) {
          remoteStream.addTrack(track);
        }
      });

      if (onStreamTrackReceived) {
        onStreamTrackReceived(remoteStream);
      }
    };

    // 3. Collect Viewer ICE candidates and write to Firestore (Dual-Channel: Subcollection + Document Array)
    const addedViewerHashes = new Set();
    const calleeCandidatesCollection = collection(roomRef, 'calleeCandidates');
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const candJson = event.candidate.toJSON();
        const candHash = candJson.candidate;
        if (!candHash || addedViewerHashes.has(candHash)) return;
        addedViewerHashes.add(candHash);

        // 3a. Subcollection Trickle ICE
        addDoc(calleeCandidatesCollection, candJson).catch(e => {
          if (e.code === 'permission-denied') {
            console.error("[NovaStream] Firestore permission denied on calleeCandidates. Please update Firestore security rules in Firebase Console.", e);
          } else {
            console.warn("[NovaStream] Error sending callee ICE candidate via subcollection:", e);
          }
        });

        // 3b. Document Array Backup: Ensures candidates reach host even if subcollection rules are restricted
        updateDoc(roomRef, {
          calleeCandidatesList: arrayUnion(candJson)
        }).catch(() => {});
      }
    };

    // Connection state
    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      console.log("[NovaStream] Viewer connection state:", state);
      if (state === 'failed') {
        console.warn("[NovaStream] WebRTC connection failed.");
        const hasTurn = hasTurnServers(rtcConfig);
        const errMsg = hasTurn
          ? "Unable to connect to streamer. Please verify internet connection."
          : "Unable to establish direct P2P connection to streamer. Make sure your Firestore security rules allow subcollections (/rooms/{roomId}/{allChildren=**}) or configure a free TURN relay in Settings.";
        const err = new Error(errMsg);
        err.code = hasTurn ? "ERR_WEBRTC_FAILED" : "ERR_NAT_TRAVERSAL_FAILED";
        err.isNatFailure = !hasTurn;
        if (onError) onError(err);
      }
    };

    let viewerIceRestartTimer = null;
    peerConnection.oniceconnectionstatechange = () => {
      const iceState = peerConnection.iceConnectionState;
      console.log("[NovaStream] Viewer ICE state:", iceState);
      if (iceState === 'disconnected') {
        if (viewerIceRestartTimer) clearTimeout(viewerIceRestartTimer);
        viewerIceRestartTimer = setTimeout(async () => {
          if (peerConnection && peerConnection.iceConnectionState === 'disconnected') {
            console.log("[NovaStream] Viewer connection blip, executing auto ICE restart...");
            await triggerIceRestart(peerConnection);
          }
        }, 3500);
      } else if (iceState === 'connected' || iceState === 'completed') {
        if (viewerIceRestartTimer) clearTimeout(viewerIceRestartTimer);
      }
    };

    // 4. Set Host Offer as Remote Description
    const offerDescription = new RTCSessionDescription(roomData.offer);
    await peerConnection.setRemoteDescription(offerDescription);
    remoteDescriptionSet = true;
    prioritize4KCodecs(peerConnection);

    const processedCallerHashes = new Set();
    function processCallerCandidate(candidateData) {
      if (!candidateData || !candidateData.candidate) return;
      if (processedCallerHashes.has(candidateData.candidate)) return;
      processedCallerHashes.add(candidateData.candidate);

      const candidate = new RTCIceCandidate(candidateData);
      if (remoteDescriptionSet && peerConnection.currentRemoteDescription) {
        peerConnection.addIceCandidate(candidate).catch(e => {
          console.warn("[NovaStream] Error adding caller ICE candidate:", e);
        });
      } else {
        pendingCandidates.push(candidate);
      }
    }

    // Drain any caller ICE candidates that arrived before Offer was processed
    for (const cand of pendingCandidates) {
      try {
        await peerConnection.addIceCandidate(cand);
      } catch (e) {
        console.warn("[NovaStream] Error adding queued caller ICE candidate:", e);
      }
    }
    pendingCandidates.length = 0;

    // Process any initial caller candidates that were sent in the room document array
    if (roomData.callerCandidatesList && Array.isArray(roomData.callerCandidatesList)) {
      roomData.callerCandidatesList.forEach(cand => processCallerCandidate(cand));
    }

    // 4b. Prepare Audio Transceiver for two-way voice chat (non-blocking)
    // Ensures the SDP answer is sent immediately without waiting for microphone permission
    try {
      peerConnection.addTransceiver('audio', { direction: 'sendrecv' });
    } catch (e) {
      console.warn("[NovaStream] Audio transceiver setup note:", e);
    }

    // 5. Create Answer & enhance with high bitrate SDP & Hybrid ICE (Wait for STUN public candidates)
    const answer = await peerConnection.createAnswer();
    const targetBitrateKbps = (roomData.settings?.bitrateMbps || 25) * 1000;
    const enhancedAnswerSdp = enhanceSDP(answer.sdp, targetBitrateKbps);
    const answerDescription = new RTCSessionDescription({ type: answer.type, sdp: enhancedAnswerSdp });
    await peerConnection.setLocalDescription(answerDescription);

    // Wait up to 1.0s for public STUN candidates to be gathered into localDescription
    await waitForIceGathering(peerConnection, 1000);
    const finalAnswerSdp = peerConnection.localDescription ? peerConnection.localDescription.sdp : answerDescription.sdp;

    // 6. Update Firestore with Answer & Viewer Info & embed public STUN candidates
    const viewerProfile = {
      uid: user.uid,
      displayName: user.displayName || 'Viewer',
      email: user.email,
      photoURL: user.photoURL || ''
    };

    await updateDoc(roomRef, {
      status: 'active',
      answer: {
        type: answerDescription.type,
        sdp: finalAnswerSdp // Embeds public STUN candidates directly in Answer!
      },
      viewer: viewerProfile,
      calleeCandidatesList: []
    });

    // Also register viewer in mesh viewers collection (enables multi-viewer tracking)
    setDoc(doc(roomRef, 'viewers', user.uid), {
      status: 'active',
      viewer: viewerProfile,
      joinedAt: Date.now()
    }).catch(() => {});

    // 7. Listen for Host's ICE candidates via Subcollection (with error handling)
    const callerCandidatesCollection = collection(roomRef, 'callerCandidates');
    candidatesUnsubscribe = onSnapshot(callerCandidatesCollection, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          processCallerCandidate(change.doc.data());
        }
      });
    }, (error) => {
      console.warn("[NovaStream] Subcollection callerCandidates listener notice (using dual-channel backup):", error.message);
    });

    // 8. Listen for Room Status changes, Stream Pause Privacy, & Backup Candidate Array
    roomUnsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data && data.status === 'ended') {
          console.log("[NovaStream] Host formally ended the stream.");
          if (onStreamEnded) onStreamEnded();
          leaveStream();
        }

        // Privacy pause indicator from host
        if (data && data.isPaused !== undefined && onStreamPauseChanged) {
          onStreamPauseChanged(Boolean(data.isPaused));
        }

        // Process any caller candidates sent via the document array backup
        if (data && data.callerCandidatesList && Array.isArray(data.callerCandidatesList)) {
          data.callerCandidatesList.forEach(cand => processCallerCandidate(cand));
        }
      }
    }, (error) => {
      console.error("[NovaStream] Error listening to room updates in viewer:", error);
      if (error.code === 'permission-denied' && onError) {
        onError(new Error("Firestore permission denied on rooms. Please check your Firestore security rules in Firebase Console."));
      }
    });

    // 9. Start live telemetry HUD stats monitor
    if (onStatsUpdate) {
      stopStatsMonitor = startStatsMonitor(peerConnection, onStatsUpdate, 1000);
    }

    return {
      roomId: normalizedRoomId,
      remoteStream
    };
  } catch (error) {
    console.error("[NovaStream] Viewer join failed:", error);
    leaveStream();
    if (onError) onError(error);
    throw error;
  }
}

/**
 * Leave the current stream room and disconnect WebRTC
 */
export function leaveStream() {
  if (stopStatsMonitor) {
    stopStatsMonitor();
    stopStatsMonitor = null;
  }

  if (roomUnsubscribe) {
    roomUnsubscribe();
    roomUnsubscribe = null;
  }

  if (candidatesUnsubscribe) {
    candidatesUnsubscribe();
    candidatesUnsubscribe = null;
  }

  if (peerConnection) {
    try {
      peerConnection.close();
    } catch (e) {}
    peerConnection = null;
  }

  if (remoteStream) {
    remoteStream.getTracks().forEach(track => track.stop());
    remoteStream = null;
  }

  if (viewerMicStream) {
    viewerMicStream.getTracks().forEach(track => track.stop());
    viewerMicStream = null;
  }
  viewerMicSender = null;

  if (currentRoomId) {
    try {
      const user = getCurrentUser();
      const { db } = initFirebase();
      if (user && db) {
        deleteDoc(doc(db, 'rooms', currentRoomId, 'viewers', user.uid)).catch(() => {});
      }
    } catch (_) {}
    currentRoomId = null;
  }
}

export function getRemoteStream() {
  return remoteStream;
}

/**
 * Mute or unmute viewer microphone during voice chat
 */
export async function setViewerMicMuted(muted) {
  isViewerMicMuted = Boolean(muted);

  // If unmuting and mic hasn't been captured yet, capture it now on-demand
  if (!isViewerMicMuted && !viewerMicStream) {
    try {
      viewerMicStream = await captureViewerMicrophone();
      if (viewerMicStream && peerConnection) {
        const micTrack = viewerMicStream.getAudioTracks()[0];
        if (micTrack) {
          const transceivers = peerConnection.getTransceivers();
          const audioTransceiver = transceivers.find(t => t.receiver && t.receiver.track && t.receiver.track.kind === 'audio');
          if (audioTransceiver && audioTransceiver.sender) {
            await audioTransceiver.sender.replaceTrack(micTrack);
            viewerMicSender = audioTransceiver.sender;
          } else {
            viewerMicSender = peerConnection.addTrack(micTrack, viewerMicStream);
          }
        }
      }
    } catch (e) {
      console.warn("[NovaStream] Failed to capture viewer mic on-demand:", e);
    }
  }

  if (viewerMicStream) {
    viewerMicStream.getAudioTracks().forEach(track => {
      track.enabled = !isViewerMicMuted;
    });
  }
  return isViewerMicMuted;
}

export function getViewerMicMuted() {
  return isViewerMicMuted;
}

export function hasViewerMic() {
  return Boolean(viewerMicStream && viewerMicStream.getAudioTracks().length > 0);
}

