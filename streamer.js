/**
 * NovaStream - Streamer Controller Module
 * Handles 1080p60 screen capture, WebRTC host connection, Firestore signaling & viewer tracking
 */

import { doc, setDoc, updateDoc, onSnapshot, collection, addDoc, deleteDoc, getDocs, arrayUnion } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { initFirebase } from './firebase-config.js';
import { getCurrentUser } from './auth.js';
import { getRTCConfig, hasTurnServers, waitForIceGathering, triggerIceRestart, captureDisplayMedia, captureMicrophone, mixAudioStreams, optimizeSenderParameters, enhanceSDP, startStatsMonitor, prioritize4KCodecs } from './webrtc.js';

let activeStream = null;
let micStream = null;
let peerConnection = null;
let currentRoomId = null;
let stopStatsMonitor = null;
let roomUnsubscribe = null;
let candidatesUnsubscribe = null;
let viewersUnsubscribe = null;
let isHostMicMuted = false;
let isStreamPaused = false;
let qualityEnforcerInterval = null;

// Multi-viewer connection registry: viewerId -> { pc, videoSender, audioSender, unsubscribe }
const activeViewers = new Map();
const connectedViewersList = new Map();

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Toggle or set stream privacy pause mode (mutes video to a frosted privacy slate)
 */
export async function setStreamPaused(paused) {
  isStreamPaused = Boolean(paused);
  if (activeStream) {
    const vTrack = activeStream.getVideoTracks()[0];
    if (vTrack) {
      vTrack.enabled = !isStreamPaused;
    }
  }

  if (currentRoomId) {
    try {
      const { db } = initFirebase();
      if (db) {
        const roomRef = doc(db, 'rooms', currentRoomId);
        await updateDoc(roomRef, { isPaused: isStreamPaused });
      }
    } catch (e) {
      console.warn("[NovaStream] Failed to sync pause state to Firestore:", e);
    }
  }

  console.log(`[NovaStream] Stream privacy pause toggled: ${isStreamPaused ? 'PAUSED' : 'ACTIVE'}`);
  return isStreamPaused;
}

export function getStreamPaused() {
  return isStreamPaused;
}

/**
 * Start streaming from this device (Supports Vanity ID, Mic Selection, Gaming Mode & Multi-Viewer)
 */
export async function startStream(options = {}, callbacks = {}) {
  const user = getCurrentUser();
  if (!user) {
    throw new Error("You must be signed in with Google to start streaming.");
  }

  const { db } = initFirebase();
  if (!db) {
    throw new Error("Firebase database is not initialized.");
  }

  const {
    customRoomId = '',
    resolution = '1080p',
    frameRate = 120,
    bitrateMbps = 18,
    includeMic = false,
    micDeviceId = null,
    audioMode = 'gaming'
  } = options;

  const {
    onStreamReady,
    onViewerConnected,
    onViewerDisconnected,
    onViewersChanged,
    onViewerVoiceReceived,
    onStatsUpdate,
    onStreamEnded,
    onError
  } = callbacks;

  try {
    // 1. Capture Screen / Display Media with 1080p60 & System Audio
    const displayStream = await captureDisplayMedia({
      resolution,
      frameRate,
      includeAudio: true,
      contentHint: 'motion'
    });
    activeStream = displayStream;

    // Handle user stopping screen share via browser floating bar
    const videoTrack = displayStream.getVideoTracks()[0];
    videoTrack.onended = () => {
      console.log("[NovaStream] Display track ended by user.");
      stopStream();
    };

    // 2. Optional: Capture & mix microphone (device-aware & mode-aware)
    let finalAudioTrack = null;
    if (includeMic) {
      micStream = await captureMicrophone({ deviceId: micDeviceId, mode: audioMode });
      finalAudioTrack = mixAudioStreams(displayStream, micStream);
    } else if (displayStream.getAudioTracks().length > 0) {
      finalAudioTrack = displayStream.getAudioTracks()[0];
    }

    // 3. Resolve RTC configuration with multi-port STUN & configured TURN Relay
    const rtcConfig = await getRTCConfig();

    // 4. Determine Room ID (Vanity room code or auto-generated 6-character code)
    const cleanCustomId = (customRoomId || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 12);
    currentRoomId = cleanCustomId || generateRoomId();

    const roomRef = doc(db, 'rooms', currentRoomId);
    const callerCandidatesCollection = collection(roomRef, 'callerCandidates');
    const calleeCandidatesCollection = collection(roomRef, 'calleeCandidates');
    const viewersCollection = collection(roomRef, 'viewers');

    // 5. Create Primary WebRTC PeerConnection (for Viewer #1 / Classic Joining)
    peerConnection = new RTCPeerConnection(rtcConfig);
    const videoSender = peerConnection.addTrack(videoTrack, activeStream);
    optimizeSenderParameters(videoSender, bitrateMbps * 1000000, frameRate);

    if (finalAudioTrack) {
      peerConnection.addTrack(finalAudioTrack, activeStream);
    } else {
      peerConnection.addTransceiver('audio', { direction: 'recvonly' });
    }

    peerConnection.ontrack = (event) => {
      if (event.track.kind === 'audio') {
        console.log("[NovaStream] Host received viewer voice track!");
        if (onViewerVoiceReceived) {
          onViewerVoiceReceived(event.streams[0] || new MediaStream([event.track]));
        }
      }
    };

    prioritize4KCodecs(peerConnection);

    // ICE gathering & Dual-channel synchronization for primary peer connection
    const addedCallerHashes = new Set();
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const candJson = event.candidate.toJSON();
        const candHash = candJson.candidate;
        if (!candHash || addedCallerHashes.has(candHash)) return;
        addedCallerHashes.add(candHash);

        addDoc(callerCandidatesCollection, candJson).catch(() => {});
        updateDoc(roomRef, {
          callerCandidatesList: arrayUnion(candJson)
        }).catch(() => {});
      }
    };

    // Connection state & Auto ICE Restart
    let iceRestartTimeout = null;
    peerConnection.oniceconnectionstatechange = () => {
      const iceState = peerConnection.iceConnectionState;
      console.log("[NovaStream] Host ICE state:", iceState);
      if (iceState === 'disconnected') {
        if (iceRestartTimeout) clearTimeout(iceRestartTimeout);
        iceRestartTimeout = setTimeout(async () => {
          if (peerConnection && peerConnection.iceConnectionState === 'disconnected') {
            console.log("[NovaStream] Connection dropped, executing auto ICE restart...");
            await triggerIceRestart(peerConnection);
          }
        }, 3500);
      } else if (iceState === 'connected' || iceState === 'completed') {
        if (iceRestartTimeout) clearTimeout(iceRestartTimeout);
      }
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      console.log("[NovaStream] Host connection state:", state);
      if (state === 'connected') {
        optimizeSenderParameters(videoSender, bitrateMbps * 1000000, frameRate);
      } else if (state === 'failed') {
        const hasTurn = hasTurnServers(rtcConfig);
        const errMsg = hasTurn
          ? "Connection to viewer failed. Please check network."
          : "Direct P2P connection to viewer failed. Ensure Firestore rules are set or configure a free TURN relay in Settings.";
        const err = new Error(errMsg);
        err.code = hasTurn ? "ERR_WEBRTC_FAILED" : "ERR_NAT_TRAVERSAL_FAILED";
        err.isNatFailure = !hasTurn;
        if (onError) onError(err);
        if (onViewerDisconnected) onViewerDisconnected();
      } else if (state === 'disconnected') {
        if (onViewerDisconnected) onViewerDisconnected();
      }
    };

    // Continuous Quality Enforcer: Re-locks 60 FPS & 1:1 native resolution every 2.5s
    if (qualityEnforcerInterval) clearInterval(qualityEnforcerInterval);
    qualityEnforcerInterval = setInterval(() => {
      if (peerConnection && videoSender && (peerConnection.connectionState === 'connected' || peerConnection.iceConnectionState === 'connected')) {
        optimizeSenderParameters(videoSender, bitrateMbps * 1000000, frameRate);
      }
    }, 2500);

    // 6. Create SDP Offer with Bitrate Enhancement & Hybrid ICE (Wait for STUN public candidates)
    const offer = await peerConnection.createOffer();
    const enhancedSdp = enhanceSDP(offer.sdp, bitrateMbps * 1000);
    const sdpDescription = new RTCSessionDescription({ type: offer.type, sdp: enhancedSdp });
    await peerConnection.setLocalDescription(sdpDescription);

    // Wait up to 1.2s for public STUN candidates to be gathered into localDescription
    await waitForIceGathering(peerConnection, 1200);
    const finalOfferSdp = peerConnection.localDescription ? peerConnection.localDescription.sdp : sdpDescription.sdp;

    let remoteDescriptionSet = false;
    const pendingCandidates = [];
    const processedCalleeHashes = new Set();

    function processCalleeCandidate(candidateData) {
      if (!candidateData || !candidateData.candidate) return;
      if (processedCalleeHashes.has(candidateData.candidate)) return;
      processedCalleeHashes.add(candidateData.candidate);

      const candidate = new RTCIceCandidate(candidateData);
      if (remoteDescriptionSet && peerConnection.currentRemoteDescription) {
        peerConnection.addIceCandidate(candidate).catch(e => {
          console.warn("[NovaStream] Error adding callee ICE candidate:", e);
        });
      } else {
        pendingCandidates.push(candidate);
      }
    }

    // Save initial room data with Offer & ICE servers
    await setDoc(roomRef, {
      status: 'waiting',
      createdAt: Date.now(),
      isPaused: false,
      settings: {
        resolution,
        frameRate,
        bitrateMbps,
        audioMode
      },
      iceServers: rtcConfig.iceServers,
      host: {
        uid: user.uid,
        displayName: user.displayName || 'Streamer',
        email: user.email,
        photoURL: user.photoURL || ''
      },
      offer: {
        type: sdpDescription.type,
        sdp: finalOfferSdp
      },
      callerCandidatesList: []
    });

    // 7. Listen for Primary Viewer's SDP Answer & Backup Candidate Array
    roomUnsubscribe = onSnapshot(roomRef, async (snapshot) => {
      const data = snapshot.data();
      if (!data) return;

      if (!peerConnection.currentRemoteDescription && data.answer) {
        console.log("[NovaStream] Received Answer from primary viewer:", data.viewer);
        const answerDescription = new RTCSessionDescription(data.answer);
        await peerConnection.setRemoteDescription(answerDescription);
        remoteDescriptionSet = true;

        for (const cand of pendingCandidates) {
          try {
            await peerConnection.addIceCandidate(cand);
          } catch (e) {
            console.warn("[NovaStream] Error adding queued callee candidate:", e);
          }
        }
        pendingCandidates.length = 0;

        if (data.viewer) {
          connectedViewersList.set(data.viewer.uid || 'viewer-1', data.viewer);
          if (onViewerConnected) onViewerConnected(data.viewer);
          if (onViewersChanged) onViewersChanged(connectedViewersList.size, Array.from(connectedViewersList.values()));
        }
      }

      if (data.calleeCandidatesList && Array.isArray(data.calleeCandidatesList)) {
        data.calleeCandidatesList.forEach(cand => processCalleeCandidate(cand));
      }
    }, (error) => {
      console.warn("[NovaStream] Room snapshot notice:", error.message);
    });

    // 8. Listen for Primary Viewer ICE candidates via Subcollection
    candidatesUnsubscribe = onSnapshot(calleeCandidatesCollection, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          processCalleeCandidate(change.doc.data());
        }
      });
    }, (error) => {
      console.warn("[NovaStream] Callee candidates subcollection notice:", error.message);
    });

    // 9. Multi-Viewer Support: Listen for additional viewers joining via /viewers collection
    viewersUnsubscribe = onSnapshot(viewersCollection, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        const viewerId = change.doc.id;
        const viewerData = change.doc.data();

        if (change.type === 'added' || change.type === 'modified') {
          if (viewerData.status === 'joining' && !activeViewers.has(viewerId)) {
            console.log(`[NovaStream Mesh] Incoming viewer join request: ${viewerId}`);
            setupAdditionalViewer(viewerId, viewerData, rtcConfig, roomRef, displayStream, finalAudioTrack, bitrateMbps, frameRate, callbacks);
          }
        } else if (change.type === 'removed') {
          console.log(`[NovaStream Mesh] Viewer left: ${viewerId}`);
          cleanupViewer(viewerId);
          connectedViewersList.delete(viewerId);
          if (onViewersChanged) onViewersChanged(connectedViewersList.size, Array.from(connectedViewersList.values()));
        }
      });
    }, (error) => {
      console.warn("[NovaStream] Viewers collection notice (using single-room mode):", error.message);
    });

    // 10. Start live telemetry HUD stats monitor with Adaptive Bitrate (BWE)
    if (onStatsUpdate) {
      stopStatsMonitor = startStatsMonitor(peerConnection, onStatsUpdate, 1000, {
        videoSender,
        targetBitrateBps: bitrateMbps * 1000000,
        enableAdaptiveBitrate: true
      });
    }

    // Notify UI that stream is locally ready and active
    if (onStreamReady) {
      onStreamReady({
        roomId: currentRoomId,
        stream: displayStream,
        settings: { resolution, frameRate, bitrateMbps, audioMode }
      });
    }

    return {
      roomId: currentRoomId,
      stream: displayStream
    };
  } catch (error) {
    console.error("[NovaStream] Start stream failure:", error);
    await stopStream();
    if (onError) onError(error);
    throw error;
  }
}

/**
 * Handle WebRTC connection negotiation for an additional viewer (Multi-Viewer P2P Mesh)
 */
async function setupAdditionalViewer(viewerId, viewerData, rtcConfig, roomRef, displayStream, audioTrack, bitrateMbps, frameRate, callbacks) {
  try {
    const pc = new RTCPeerConnection(rtcConfig);
    const videoTrack = displayStream.getVideoTracks()[0];
    const sender = pc.addTrack(videoTrack, displayStream);
    optimizeSenderParameters(sender, bitrateMbps * 1000000, frameRate);

    if (audioTrack) {
      pc.addTrack(audioTrack, displayStream);
    } else {
      pc.addTransceiver('audio', { direction: 'recvonly' });
    }

    prioritize4KCodecs(pc);

    const viewerDocRef = doc(roomRef, 'viewers', viewerId);
    const viewerCallerCandColl = collection(viewerDocRef, 'callerCandidates');
    const viewerCalleeCandColl = collection(viewerDocRef, 'calleeCandidates');

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        addDoc(viewerCallerCandColl, e.candidate.toJSON()).catch(() => {});
        updateDoc(viewerDocRef, {
          callerCandidatesList: arrayUnion(e.candidate.toJSON())
        }).catch(() => {});
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        if (viewerData.viewer) {
          connectedViewersList.set(viewerId, viewerData.viewer);
          if (callbacks.onViewersChanged) callbacks.onViewersChanged(connectedViewersList.size, Array.from(connectedViewersList.values()));
        }
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        cleanupViewer(viewerId);
        connectedViewersList.delete(viewerId);
        if (callbacks.onViewersChanged) callbacks.onViewersChanged(connectedViewersList.size, Array.from(connectedViewersList.values()));
      }
    };

    const offer = await pc.createOffer();
    const enhancedSdp = enhanceSDP(offer.sdp, bitrateMbps * 1000);
    await pc.setLocalDescription({ type: offer.type, sdp: enhancedSdp });
    await waitForIceGathering(pc, 1000);

    const finalOffer = pc.localDescription || offer;
    await updateDoc(viewerDocRef, {
      status: 'offered',
      offer: { type: finalOffer.type, sdp: finalOffer.sdp }
    });

    const unsubDoc = onSnapshot(viewerDocRef, async (snap) => {
      const data = snap.data();
      if (!data) return;

      if (!pc.currentRemoteDescription && data.answer) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
      if (data.calleeCandidatesList && Array.isArray(data.calleeCandidatesList) && pc.currentRemoteDescription) {
        data.calleeCandidatesList.forEach(cand => {
          try { pc.addIceCandidate(new RTCIceCandidate(cand)); } catch (_) {}
        });
      }
    });

    const unsubCand = onSnapshot(viewerCalleeCandColl, (snap) => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added' && pc.currentRemoteDescription) {
          try { pc.addIceCandidate(new RTCIceCandidate(change.doc.data())); } catch (_) {}
        }
      });
    });

    activeViewers.set(viewerId, { pc, unsubDoc, unsubCand });
  } catch (err) {
    console.warn(`[NovaStream Mesh] Error setting up viewer ${viewerId}:`, err);
  }
}

function cleanupViewer(viewerId) {
  const item = activeViewers.get(viewerId);
  if (item) {
    if (item.unsubDoc) item.unsubDoc();
    if (item.unsubCand) item.unsubCand();
    if (item.pc) {
      try { item.pc.close(); } catch (_) {}
    }
    activeViewers.delete(viewerId);
  }
}

/**
 * End current active stream and clean up Firestore room
 */
export async function stopStream() {
  if (qualityEnforcerInterval) {
    clearInterval(qualityEnforcerInterval);
    qualityEnforcerInterval = null;
  }

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

  if (viewersUnsubscribe) {
    viewersUnsubscribe();
    viewersUnsubscribe = null;
  }

  // Close all mesh viewers
  activeViewers.forEach((_, viewerId) => cleanupViewer(viewerId));
  connectedViewersList.clear();

  if (peerConnection) {
    try {
      peerConnection.close();
    } catch (e) {}
    peerConnection = null;
  }

  if (activeStream) {
    activeStream.getTracks().forEach(track => track.stop());
    activeStream = null;
  }

  if (micStream) {
    micStream.getTracks().forEach(track => track.stop());
    micStream = null;
  }

  isStreamPaused = false;

  // Update Firestore room status to ended
  if (currentRoomId) {
    try {
      const { db } = initFirebase();
      if (db) {
        const roomRef = doc(db, 'rooms', currentRoomId);
        await updateDoc(roomRef, {
          status: 'ended',
          endedAt: Date.now()
        });
      }
    } catch (e) {
      console.warn("[NovaStream] Could not mark room as ended:", e);
    }
    currentRoomId = null;
  }
}

export function getActiveStream() {
  return activeStream;
}

export function getCurrentRoomId() {
  return currentRoomId;
}

export function getConnectedViewers() {
  return Array.from(connectedViewersList.values());
}

/**
 * Toggle or set streamer microphone mute state
 */
export function setStreamerMicMuted(muted) {
  isHostMicMuted = Boolean(muted);
  if (micStream) {
    micStream.getAudioTracks().forEach(track => {
      track.enabled = !isHostMicMuted;
    });
  }
  return isHostMicMuted;
}

export function getStreamerMicMuted() {
  return isHostMicMuted;
}

