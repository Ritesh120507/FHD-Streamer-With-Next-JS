/**
 * NovaStream - Application Router & UI Coordinator
 */

import { isFirebaseConfigured, getFirebaseConfig, saveFirebaseConfig, clearFirebaseConfig, initFirebase } from './firebase-config.js';
import { setupAuth, signInWithGoogle, logOut, onUserChanged, getCurrentUser } from './auth.js';
import { startStream, stopStream, setStreamerMicMuted, getStreamerMicMuted, setStreamPaused, getStreamPaused } from './streamer.js';
import { joinStream, leaveStream, setViewerMicMuted, getViewerMicMuted } from './viewer.js';
import { initChat, sendChatMessage, cleanupChat } from './chat.js';
import { getTurnSettings, saveTurnSettings, clearTurnSettings, testTurnConnection, getAudioInputDevices } from './webrtc.js';

// DOM Elements
const views = {
  lobby: document.getElementById('lobby-view'),
  studio: document.getElementById('studio-view'),
  viewer: document.getElementById('viewer-view')
};

// Modals & Banners
const toastContainer = document.getElementById('toast-container');
const unmuteBanner = document.getElementById('unmute-banner');

// Auth elements
const appNavbar = document.getElementById('app-navbar');
const cardAuthLoggedOut = document.getElementById('card-auth-logged-out');
const cardAuthLoggedIn = document.getElementById('card-auth-logged-in');
const cardUserAvatar = document.getElementById('card-user-avatar');
const cardUserName = document.getElementById('card-user-name');
const cardUserEmail = document.getElementById('card-user-email');
const btnCardLogout = document.getElementById('btn-card-logout');
const btnLoginHeader = document.getElementById('btn-login-header');
const btnLoginHero = document.getElementById('btn-login-hero');
const userProfile = document.getElementById('user-profile');
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const btnLogout = document.getElementById('btn-logout');

// Lobby elements
const streamOptionsForm = document.getElementById('stream-options-form');
const btnStartStream = document.getElementById('btn-start-stream');
const joinRoomForm = document.getElementById('join-room-form');
const inputRoomCode = document.getElementById('input-room-code');
const btnJoinStream = document.getElementById('btn-join-stream');

// Advanced Broadcast Options
const optCustomRoomCode = document.getElementById('opt-custom-room-code');
const optIncludeMic = document.getElementById('opt-include-mic');
const micSettingsPanel = document.getElementById('mic-settings-panel');
const optMicDevice = document.getElementById('opt-mic-device');
const optAudioMode = document.getElementById('opt-audio-mode');

// Studio elements
const studioVideo = document.getElementById('studio-video');
const studioRoomCode = document.getElementById('studio-room-code');
const btnCopyRoomCode = document.getElementById('btn-copy-room-code');
const btnCopyShareLink = document.getElementById('btn-copy-share-link');
const btnStopStream = document.getElementById('btn-stop-stream');
const studioViewerStatus = document.getElementById('studio-viewer-status');
const studioViewerCard = document.getElementById('studio-viewer-card');
const studioViewerAvatar = document.getElementById('studio-viewer-avatar');
const studioViewerName = document.getElementById('studio-viewer-name');
const studioViewerEmail = document.getElementById('studio-viewer-email');
const studioViewersBadge = document.getElementById('studio-viewers-badge');
const studioViewersContainer = document.getElementById('studio-viewers-container');
const btnStreamerPause = document.getElementById('btn-streamer-pause');
const streamerPauseIcon = document.getElementById('streamer-pause-icon');
const streamerResumeIcon = document.getElementById('streamer-resume-icon');

// Studio HUD Metrics (Overlay Badge & Performance Card)
const studioMetricFps = document.getElementById('studio-metric-fps');
const studioMetricRes = document.getElementById('studio-metric-res');
const studioCardMetricFps = document.getElementById('studio-card-metric-fps');
const studioCardMetricRes = document.getElementById('studio-card-metric-res');
const studioCardMetricBitrate = document.getElementById('studio-card-metric-bitrate');
const studioCardMetricRtt = document.getElementById('studio-card-metric-rtt');
const studioCardMetricRoute = document.getElementById('studio-card-metric-route');

// Viewer elements
const viewerVideo = document.getElementById('viewer-video');
const viewerPauseOverlay = document.getElementById('viewer-pause-overlay');
const viewerHostName = document.getElementById('viewer-host-name');
const viewerHostAvatar = document.getElementById('viewer-host-avatar');
const btnLeaveStream = document.getElementById('btn-leave-stream');
const btnFullscreen = document.getElementById('btn-fullscreen');
const btnRotateStream = document.getElementById('btn-rotate-stream');
const viewerStage = document.getElementById('viewer-stage');
const btnPip = document.getElementById('btn-pip');
const volumeSlider = document.getElementById('volume-slider');

// Viewer HUD Metrics (Overlay Badge & Live Quality Card)
const viewerMetricFps = document.getElementById('viewer-metric-fps');
const viewerMetricRes = document.getElementById('viewer-metric-res');
const viewerCardMetricFps = document.getElementById('viewer-card-metric-fps');
const viewerCardMetricRes = document.getElementById('viewer-card-metric-res');
const viewerCardMetricBitrate = document.getElementById('viewer-card-metric-bitrate');
const viewerCardMetricRtt = document.getElementById('viewer-card-metric-rtt');
const viewerCardMetricRoute = document.getElementById('viewer-card-metric-route');

// Settings Modal & Controls
const modalSettings = document.getElementById('modal-settings');
const btnNavbarSettings = document.getElementById('btn-navbar-settings');
const btnCloseSettings = document.getElementById('btn-close-settings');
const tabTurnMetered = document.getElementById('tab-turn-metered');
const tabTurnCustom = document.getElementById('tab-turn-custom');
const panelTurnMetered = document.getElementById('panel-turn-metered');
const panelTurnCustom = document.getElementById('panel-turn-custom');
const settingMeteredAppName = document.getElementById('setting-metered-app-name');
const settingMeteredApiKey = document.getElementById('setting-metered-api-key');
const settingCustomTurnUrl = document.getElementById('setting-custom-turn-url');
const settingCustomTurnUser = document.getElementById('setting-custom-turn-user');
const settingCustomTurnCred = document.getElementById('setting-custom-turn-cred');
const turnTestStatus = document.getElementById('turn-test-status');
const turnTestMessage = document.getElementById('turn-test-message');
const btnTestTurn = document.getElementById('btn-test-turn');
const btnSaveTurn = document.getElementById('btn-save-turn');
const btnClearTurn = document.getElementById('btn-clear-turn');

// Studio Voice & Controls
const streamerVoiceAudio = document.getElementById('streamer-voice-audio');
const btnStreamerMic = document.getElementById('btn-streamer-mic');
const streamerMicOnIcon = document.getElementById('streamer-mic-on-icon');
const streamerMicOffIcon = document.getElementById('streamer-mic-off-icon');
const btnStudioFullscreen = document.getElementById('btn-studio-fullscreen');
const viewerVoiceBadge = document.getElementById('viewer-voice-badge');

// Studio Tabs & Chat
const btnStudioTabChat = document.getElementById('btn-studio-tab-chat');
const btnStudioTabInfo = document.getElementById('btn-studio-tab-info');
const studioPaneChat = document.getElementById('studio-pane-chat');
const studioPaneInfo = document.getElementById('studio-pane-info');
const studioChatMessages = document.getElementById('studio-chat-messages');
const studioChatForm = document.getElementById('studio-chat-form');
const studioChatInput = document.getElementById('studio-chat-input');
const studioChatUnread = document.getElementById('studio-chat-unread');

// Viewer Voice Controls
const btnViewerMic = document.getElementById('btn-viewer-mic');
const viewerMicOnIcon = document.getElementById('viewer-mic-on-icon');
const viewerMicOffIcon = document.getElementById('viewer-mic-off-icon');

// Viewer Tabs & Chat
const btnViewerTabChat = document.getElementById('btn-viewer-tab-chat');
const btnViewerTabInfo = document.getElementById('btn-viewer-tab-info');
const viewerPaneChat = document.getElementById('viewer-pane-chat');
const viewerPaneInfo = document.getElementById('viewer-pane-info');
const viewerChatMessages = document.getElementById('viewer-chat-messages');
const viewerChatForm = document.getElementById('viewer-chat-form');
const viewerChatInput = document.getElementById('viewer-chat-input');
const viewerChatUnread = document.getElementById('viewer-chat-unread');

// Current View Tracker
let currentView = 'lobby';

/**
 * Switch active UI view
 */
function switchView(viewName) {
  Object.keys(views).forEach(key => {
    if (views[key]) {
      views[key].classList.toggle('active', key === viewName);
    }
  });
  if (appNavbar) {
    appNavbar.style.display = viewName === 'lobby' ? 'none' : 'flex';
  }
  currentView = viewName;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

let currentRotation = 0; // 0, 90, 180, 270

/**
 * Apply video rotation and auto-scale to fit stage bounds without clipping
 */
function updateVideoRotation(deg) {
  currentRotation = deg % 360;
  const stage = document.getElementById('viewer-stage');
  const video = document.getElementById('viewer-video');
  if (!stage || !video) return;

  const stageRect = stage.getBoundingClientRect();
  const stageW = stageRect.width || stage.clientWidth || window.innerWidth;
  const stageH = stageRect.height || stage.clientHeight || window.innerHeight;

  if (currentRotation === 90 || currentRotation === 270) {
    const scale = Math.min(stageW / stageH, stageH / stageW);
    video.style.transform = `rotate(${currentRotation}deg) scale(${scale.toFixed(4)})`;
  } else {
    video.style.transform = `rotate(${currentRotation}deg) scale(1)`;
  }
}

/**
 * Update Fullscreen button SVG icon and title
 */
function updateFullscreenBtnIcon(isFs) {
  if (!btnFullscreen) return;
  if (isFs) {
    btnFullscreen.title = "Exit Fullscreen (Esc)";
    btnFullscreen.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
      </svg>
    `;
  } else {
    btnFullscreen.title = "Fullscreen";
    btnFullscreen.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
      </svg>
    `;
  }
}

/**
 * Escape HTML to prevent XSS in chat messages
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Format timestamp into HH:MM A string
 */
function formatTime(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Render real-time chat messages into container
 */
function renderChatMessages(container, messages, unreadDot, isPaneActive) {
  if (!container) return;
  if (!messages || messages.length === 0) {
    container.innerHTML = '<div class="chat-empty-state">No messages yet. Say hello!</div>';
    return;
  }

  const currentUser = getCurrentUser();
  const currentUid = currentUser ? currentUser.uid : '';

  container.innerHTML = messages.map(msg => {
    const isMe = msg.senderUid === currentUid;
    const avatar = msg.senderPhoto || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(msg.senderName || 'U')}`;
    const hostBadge = msg.isHost ? '<span class="chat-badge-host">HOST</span>' : '';
    const time = formatTime(msg.timestamp);

    return `
      <div class="chat-message-item ${isMe ? 'is-me' : ''}">
        <img class="chat-avatar" src="${escapeHtml(avatar)}" alt="${escapeHtml(msg.senderName)}">
        <div class="chat-content">
          <div class="chat-meta">
            <span class="chat-author">${escapeHtml(msg.senderName)}</span>
            ${hostBadge}
            <span class="chat-time">${time}</span>
          </div>
          <div class="chat-bubble">${escapeHtml(msg.text)}</div>
        </div>
      </div>
    `;
  }).join('');

  // Auto-scroll to latest message inside RAF to avoid synchronous layout thrashing
  requestAnimationFrame(() => {
    container.scrollTop = container.scrollHeight;
  });

  // Show unread indicator if user is looking at other tab
  if (!isPaneActive && unreadDot) {
    unreadDot.style.display = 'block';
  }
}

/**
 * Setup side panel tab switcher
 */
function setupPanelTabs(tabChat, tabInfo, paneChat, paneInfo, unreadDot) {
  if (!tabChat || !tabInfo || !paneChat || !paneInfo) return;

  tabChat.addEventListener('click', () => {
    tabChat.classList.add('active');
    tabInfo.classList.remove('active');
    paneChat.classList.add('active');
    paneInfo.classList.remove('active');
    if (unreadDot) unreadDot.style.display = 'none';
  });

  tabInfo.addEventListener('click', () => {
    tabInfo.classList.add('active');
    tabChat.classList.remove('active');
    paneInfo.classList.add('active');
    paneChat.classList.remove('active');
  });
}

/**
 * Toast Notifications
 */
export function showToast(message, type = 'info', durationMs = 4000) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, durationMs);
}

/**
 * Copy text helper
 */
async function copyToClipboard(text, successMsg) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMsg, 'success');
  } catch (err) {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    showToast(successMsg, 'success');
  }
}

/**
 * Update UI for authenticated user state
 */
function updateUserUI(user) {
  if (user) {
    if (cardAuthLoggedOut) cardAuthLoggedOut.style.display = 'none';
    if (cardAuthLoggedIn) cardAuthLoggedIn.style.display = 'block';
    if (cardUserAvatar) cardUserAvatar.src = user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.displayName || 'U')}`;
    if (cardUserName) cardUserName.textContent = user.displayName || user.email;
    if (cardUserEmail) cardUserEmail.textContent = user.email || '';

    if (userProfile) userProfile.style.display = 'flex';
    if (userAvatar) userAvatar.src = user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.displayName || 'U')}`;
    if (userName) userName.textContent = user.displayName || user.email;
    if (btnLoginHeader) btnLoginHeader.style.display = 'none';
  } else {
    if (cardAuthLoggedOut) cardAuthLoggedOut.style.display = 'block';
    if (cardAuthLoggedIn) cardAuthLoggedIn.style.display = 'none';

    if (userProfile) userProfile.style.display = 'none';
    if (btnLoginHeader) btnLoginHeader.style.display = 'inline-flex';
  }
}

/**
 * Initialize event handlers and application workflow
 */
function initializeAppWorkflow() {
  // 1. Initialize Firebase Auth
  setupAuth();

  // 2. Auth State Listener
  onUserChanged((user) => {
    updateUserUI(user);
    // If URL has ?room=... auto-join when user is authenticated
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam && user && currentView === 'lobby') {
      inputRoomCode.value = roomParam;
      handleJoinStream(roomParam);
    }
  });

  // 3. Login & Logout buttons
  const triggerLogin = async () => {
    if (!isFirebaseConfigured()) {
      showToast("Firebase credentials not found. Please ensure .env is configured.", "warning", 6000);
      return;
    }
    try {
      showToast("Opening Google Sign-In...", "info");
      await signInWithGoogle();
      showToast("Signed in successfully!", "success");
    } catch (err) {
      showToast(err.message, "error", 6000);
    }
  };

  if (btnLoginHeader) btnLoginHeader.addEventListener('click', triggerLogin);
  if (btnLoginHero) btnLoginHero.addEventListener('click', triggerLogin);

  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      if (currentView === 'studio') await handleStopStream();
      if (currentView === 'viewer') handleLeaveStream();
      await logOut();
      showToast("Signed out", "info");
    });
  }

  if (btnCardLogout) {
    btnCardLogout.addEventListener('click', async () => {
      if (currentView === 'studio') await handleStopStream();
      if (currentView === 'viewer') handleLeaveStream();
      await logOut();
      showToast("Signed out", "info");
    });
  }

  // High performance DOM text update helper (bypasses reflow if unchanged)
  function updateTextIfChanged(el, text) {
    if (el && el.textContent !== text) {
      el.textContent = text;
    }
  }

  // Dynamic Bitrate & Settings Optimizer (Adapts to 120 FPS vs 60 FPS)
  const optResolution = document.getElementById('opt-resolution');
  const optFramerate = document.getElementById('opt-framerate');
  const optBitrate = document.getElementById('opt-bitrate');

  function updateRecommendedSettings() {
    if (!optResolution || !optFramerate || !optBitrate) return;
    const res = optResolution.value;
    const fps = parseInt(optFramerate.value, 10) || 120;

    if (fps === 120) {
      if (res === '4k') optBitrate.value = '50';
      else if (res === '1440p') optBitrate.value = '25';
      else if (res === '1080p') optBitrate.value = '18';
      else if (res === '720p') optBitrate.value = '10';
    } else if (fps === 60) {
      if (res === '4k') optBitrate.value = '25';
      else if (res === '1440p') optBitrate.value = '18';
      else if (res === '1080p') optBitrate.value = '10';
      else if (res === '720p') optBitrate.value = '5';
    } else {
      if (res === '4k') optBitrate.value = '18';
      else if (res === '1440p') optBitrate.value = '12';
      else if (res === '1080p') optBitrate.value = '8';
      else if (res === '720p') optBitrate.value = '5';
    }

    if (btnStartStream) {
      const resLabel = res === '4k' ? '4K UHD' : (res === '1440p' ? '1440p 2K' : (res === '1080p' ? '1080p FHD' : '720p HD'));
      btnStartStream.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="8"/>
        </svg>
        Start ${resLabel} @ ${fps} FPS Stream
      `;
    }
  }

  if (optResolution) optResolution.addEventListener('change', updateRecommendedSettings);
  if (optFramerate) optFramerate.addEventListener('change', updateRecommendedSettings);
  updateRecommendedSettings();

  // Monitor Display Refresh Rate Detector (Identifies 120Hz/144Hz monitors for true buttery smoothness)
  function initDisplayHzDetector() {
    const pill = document.getElementById('hz-indicator-pill');
    const valueEl = document.getElementById('hz-value');

    let frameCount = 0;
    let startTime = performance.now();
    const samples = [];

    function measure(now) {
      frameCount++;
      const elapsed = now - startTime;
      if (elapsed >= 300) {
        const rawHz = Math.round((frameCount * 1000) / elapsed);
        samples.push(rawHz);

        if (samples.length >= 2) {
          const avgHz = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
          let detectedHz = avgHz;
          if (avgHz >= 110 && avgHz <= 130) detectedHz = 120;
          else if (avgHz >= 135 && avgHz <= 155) detectedHz = 144;
          else if (avgHz >= 158 && avgHz <= 175) detectedHz = 165;
          else if (avgHz >= 230 && avgHz <= 250) detectedHz = 240;
          else if (avgHz >= 55 && avgHz <= 65) detectedHz = 60;
          else if (avgHz >= 70 && avgHz <= 80) detectedHz = 75;

          if (valueEl) {
            valueEl.textContent = `${detectedHz}Hz Display`;
          }
          if (pill) {
            pill.classList.add(detectedHz >= 100 ? 'high-refresh' : 'standard-refresh');
            pill.setAttribute('title', `Detected ${detectedHz}Hz display refresh rate. Website and video compositor running at native ${detectedHz}Hz.`);
          }

          // If high-refresh monitor detected, ensure 120 FPS is active
          if (detectedHz >= 100 && optFramerate && optFramerate.value !== '120') {
            optFramerate.value = '120';
            updateRecommendedSettings();
          }
          return;
        }

        frameCount = 0;
        startTime = performance.now();
      }
      requestAnimationFrame(measure);
    }
    requestAnimationFrame(measure);
  }
  initDisplayHzDetector();

  // 4. Start Streaming (Streamer Flow)
  if (btnStartStream) {
    btnStartStream.addEventListener('click', async () => {
      const user = getCurrentUser();
      if (!user) {
        showToast("Please sign in with Google first to start streaming.", "warning");
        triggerLogin();
        return;
      }

      const resolution = document.getElementById('opt-resolution').value;
      const frameRate = parseInt(document.getElementById('opt-framerate').value, 10);
      const bitrateMbps = parseInt(document.getElementById('opt-bitrate').value, 10);
      const includeMic = optIncludeMic ? optIncludeMic.checked : false;
      const customRoomId = optCustomRoomCode ? optCustomRoomCode.value.trim() : '';
      const micDeviceId = optMicDevice ? optMicDevice.value : null;
      const audioMode = optAudioMode ? optAudioMode.value : 'gaming';

      try {
        btnStartStream.disabled = true;
        btnStartStream.textContent = "Requesting Screen Access...";

        const result = await startStream(
          { resolution, frameRate, bitrateMbps, includeMic, customRoomId, micDeviceId, audioMode },
          {
            onStreamReady: ({ roomId, stream, settings }) => {
              studioVideo.srcObject = stream;
              studioVideo.play().catch(e => console.warn("Local play error:", e));
              studioRoomCode.textContent = roomId;
              studioViewerStatus.textContent = "Waiting for friends to join...";
              if (studioViewersBadge) studioViewersBadge.style.display = 'none';
              if (studioViewersContainer) studioViewersContainer.innerHTML = '';

              // Reset pause button state
              if (btnStreamerPause) btnStreamerPause.classList.remove('paused');
              if (streamerPauseIcon) streamerPauseIcon.style.display = 'block';
              if (streamerResumeIcon) streamerResumeIcon.style.display = 'none';

              // Initialize Live Chat for Streamer
              initChat(roomId, (messages) => {
                renderChatMessages(studioChatMessages, messages, studioChatUnread, studioPaneChat && studioPaneChat.classList.contains('active'));
              });

              switchView('studio');
              showToast(`Stream Live! Room: ${roomId} • ${resolution.toUpperCase()} @ ${frameRate} FPS (120Hz locked)`, "success");
            },
            onViewerConnected: (viewer) => {
              showToast(`${viewer.displayName || 'Friend'} joined the stream!`, "success");
            },
            onViewersChanged: (count, viewers) => {
              if (studioViewersBadge) {
                studioViewersBadge.style.display = count > 0 ? 'inline-flex' : 'none';
                studioViewersBadge.textContent = `${count} ${count === 1 ? 'Viewer' : 'Viewers'}`;
              }
              if (studioViewerStatus) {
                studioViewerStatus.textContent = count > 0 ? `Connected Audience (${count}):` : "Waiting for friends to join...";
              }
              if (studioViewersContainer) {
                studioViewersContainer.innerHTML = '';
                viewers.forEach(v => {
                  const card = document.createElement('div');
                  card.className = 'viewer-mini-card';
                  const avatarUrl = v.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(v.displayName || 'V')}`;
                  card.innerHTML = `
                    <img class="user-avatar" src="${avatarUrl}" alt="${v.displayName || 'Viewer'}">
                    <div style="display: flex; flex-direction: column; overflow: hidden;">
                      <span style="font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${v.displayName || 'Friend'}</span>
                      <span style="font-size: 0.72rem; color: var(--text-muted);">${v.email || 'Online'}</span>
                    </div>
                  `;
                  studioViewersContainer.appendChild(card);
                });
              }
            },
            onViewerVoiceReceived: (voiceStream) => {
              console.log("[NovaStream] Playing incoming viewer voice in Studio");
              if (streamerVoiceAudio) {
                streamerVoiceAudio.srcObject = voiceStream;
                streamerVoiceAudio.play().catch(e => console.warn("Voice play error:", e));
              }
              if (viewerVoiceBadge) viewerVoiceBadge.style.display = 'inline-flex';
              showToast("Viewer Voice Chat Connected 🎙️", "info");
            },
            onViewerDisconnected: () => {
              showToast("A viewer left.", "warning");
            },
            onStatsUpdate: (stats) => {
              requestAnimationFrame(() => {
                const fpsText = `${stats.fps} FPS`;
                updateTextIfChanged(studioMetricFps, fpsText);
                updateTextIfChanged(studioCardMetricFps, fpsText);

                updateTextIfChanged(studioMetricRes, stats.resolution);
                updateTextIfChanged(studioCardMetricRes, stats.resolution);

                const bitrateText = `${stats.bitrateMbps} Mbps`;
                updateTextIfChanged(studioCardMetricBitrate, bitrateText);

                updateTextIfChanged(studioCardMetricRtt, stats.rtt);

                const routeText = stats.route || 'Direct P2P';
                updateTextIfChanged(studioCardMetricRoute, routeText);
              });
            },
            onError: (err) => {
              if (err.isNatFailure || err.code === "ERR_NAT_TRAVERSAL_FAILED") {
                showToast(err.message, "warning", 8000);
                setTimeout(() => openSettingsModal(), 1200);
              } else {
                showToast(`Stream Error: ${err.message}`, "error");
              }
            }
          }
        );
      } catch (err) {
        showToast(err.message || "Failed to start stream", "error");
      } finally {
        btnStartStream.disabled = false;
        updateRecommendedSettings();
      }
    });
  }

  // 5. Stop Streaming
  async function handleStopStream() {
    cleanupChat();
    await stopStream();
    if (studioVideo.srcObject) {
      studioVideo.srcObject.getTracks().forEach(t => t.stop());
      studioVideo.srcObject = null;
    }
    if (streamerVoiceAudio) {
      streamerVoiceAudio.srcObject = null;
    }
    if (studioChatMessages) {
      studioChatMessages.innerHTML = '<div class="chat-empty-state">Stream ended.</div>';
    }
    switchView('lobby');
    showToast("Stream ended.", "info");
  }
  if (btnStopStream) btnStopStream.addEventListener('click', handleStopStream);

  // 6. Join Stream (Viewer Flow)
  async function handleJoinStream(roomId) {
    const user = getCurrentUser();
    if (!user) {
      showToast("Please sign in with Google to watch.", "warning");
      triggerLogin();
      return;
    }

    if (!roomId) {
      showToast("Please enter a valid 6-character room code.", "warning");
      return;
    }

    // Direct User Gesture Warm-up: primes viewerVideo to grant audio autoplay permissions
    viewerVideo.muted = false;
    viewerVideo.volume = 1.0;
    try {
      const warmup = viewerVideo.play();
      if (warmup !== undefined) warmup.catch(() => {});
    } catch (e) {}

    try {
      btnJoinStream.disabled = true;
      btnJoinStream.textContent = "Connecting...";

      let isViewerChatInitialized = false;

      await joinStream(roomId, {
        onHostDetails: (host, settings) => {
          if (viewerHostName) viewerHostName.textContent = `${host.displayName || 'Host'}'s Stream`;
          if (viewerHostAvatar) viewerHostAvatar.src = host.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(host.displayName || 'H')}`;
        },
        onStreamTrackReceived: (stream) => {
          if (viewerVideo.srcObject !== stream) {
            viewerVideo.srcObject = stream;
            viewerVideo.preservesPitch = false;

            // Direct compositor V-Sync alignment for buttery smooth 120Hz rendering
            if ('requestVideoFrameCallback' in viewerVideo) {
              const syncVsync = () => {
                viewerVideo.requestVideoFrameCallback(syncVsync);
              };
              viewerVideo.requestVideoFrameCallback(syncVsync);
            }
          }

          // Modern Autoplay Strategy:
          // Try playing with audio first. If blocked by browser autoplay policy,
          // immediately mute and play so video starts seamlessly without freezing!
          viewerVideo.muted = false;
          viewerVideo.play().then(() => {
            if (unmuteBanner) unmuteBanner.style.display = 'none';
          }).catch(err => {
            console.log("[NovaStream] Browser blocked unmuted audio autoplay. Starting muted video:", err);
            viewerVideo.muted = true;
            viewerVideo.play().catch(e => console.warn("[NovaStream] Muted video play error:", e));
            if (unmuteBanner) unmuteBanner.style.display = 'flex';
          });

          switchView('viewer');

          // Initialize Live Chat once per session
          if (!isViewerChatInitialized) {
            isViewerChatInitialized = true;
            showToast("Connected! Buttery Smooth 120Hz/60FPS Stream Active ⚡", "success");
            initChat(roomId, (messages) => {
              renderChatMessages(viewerChatMessages, messages, viewerChatUnread, viewerPaneChat && viewerPaneChat.classList.contains('active'));
            });
          }
        },
        onStatsUpdate: (stats) => {
          requestAnimationFrame(() => {
            const fpsText = `${stats.fps} FPS`;
            updateTextIfChanged(viewerMetricFps, fpsText);
            updateTextIfChanged(viewerCardMetricFps, fpsText);

            updateTextIfChanged(viewerMetricRes, stats.resolution);
            updateTextIfChanged(viewerCardMetricRes, stats.resolution);

            const bitrateText = `${stats.bitrateMbps} Mbps`;
            updateTextIfChanged(viewerCardMetricBitrate, bitrateText);

            updateTextIfChanged(viewerCardMetricRtt, stats.rtt);

            const routeText = stats.route || 'Direct P2P';
            updateTextIfChanged(viewerCardMetricRoute, routeText);
          });
        },
        onStreamPauseChanged: (isPaused) => {
          if (viewerPauseOverlay) {
            viewerPauseOverlay.style.display = isPaused ? 'flex' : 'none';
          }
        },
        onStreamEnded: () => {
          showToast("The host has ended this stream.", "warning");
          handleLeaveStream();
        },
        onError: (err) => {
          if (err.isNatFailure || err.code === "ERR_NAT_TRAVERSAL_FAILED") {
            showToast(err.message, "warning", 9000);
            setTimeout(() => openSettingsModal(), 1200);
          } else {
            showToast(err.message, "error");
          }
        }
      });
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      btnJoinStream.disabled = false;
      btnJoinStream.textContent = "Join Stream";
    }
  }

  if (joinRoomForm) {
    joinRoomForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleJoinStream(inputRoomCode.value);
    });
  }

  // 7. Leave Stream
  function handleLeaveStream() {
    currentRotation = 0;
    updateVideoRotation(0);
    cleanupChat();
    leaveStream();
    if (viewerVideo.srcObject) {
      viewerVideo.srcObject.getTracks().forEach(t => t.stop());
      viewerVideo.srcObject = null;
    }
    if (unmuteBanner) {
      unmuteBanner.style.display = 'none';
    }
    if (viewerChatMessages) {
      viewerChatMessages.innerHTML = '<div class="chat-empty-state">Stream ended.</div>';
    }
    // Remove query param from URL without page reload
    window.history.replaceState({}, document.title, window.location.pathname);
    switchView('lobby');
  }
  if (btnLeaveStream) btnLeaveStream.addEventListener('click', handleLeaveStream);

  // 8. Bulletproof Unmute Action
  const doUnmuteStream = () => {
    console.log("[NovaStream] doUnmuteStream executed");
    if (unmuteBanner) {
      unmuteBanner.style.display = 'none';
    }

    viewerVideo.muted = false;
    viewerVideo.volume = 1.0;
    if (volumeSlider) {
      volumeSlider.value = 1;
    }

    const playPromise = viewerVideo.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        showToast("Audio active 🔊", "success", 2000);
      }).catch(err => {
        console.log("[NovaStream] Video already playing, sound unmuted:", err);
        showToast("Sound unmuted 🔊", "info", 2000);
      });
    } else {
      showToast("Audio active 🔊", "success", 2000);
    }
  };

  if (unmuteBanner) {
    unmuteBanner.addEventListener('click', doUnmuteStream);
  }
  const btnUnmuteStream = document.getElementById('btn-unmute-stream');
  if (btnUnmuteStream) {
    btnUnmuteStream.addEventListener('click', (e) => {
      e.stopPropagation();
      doUnmuteStream();
    });
  }

  // 9. Fullscreen, Screen Rotation & PiP controls
  if (btnFullscreen) {
    btnFullscreen.addEventListener('click', () => {
      const container = document.getElementById('viewer-stage');
      if (!document.fullscreenElement) {
        if (container && container.requestFullscreen) {
          container.requestFullscreen().catch(err => {
            console.warn("[NovaStream] Container fullscreen failed, trying video element:", err);
            if (viewerVideo && viewerVideo.requestFullscreen) viewerVideo.requestFullscreen();
          });
        }
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
      }
    });
  }

  // Screen Rotation Button (Cycles: 0° -> 90° -> 180° -> 270°)
  if (btnRotateStream) {
    btnRotateStream.addEventListener('click', () => {
      const nextRotation = (currentRotation + 90) % 360;
      updateVideoRotation(nextRotation);

      const labels = {
        0: '0° (Default Landscape)',
        90: '90° (Portrait Mode)',
        180: '180° (Inverted Mode)',
        270: '270° (Portrait Reversed)'
      };
      showToast(`Screen: ${labels[nextRotation]} 🔄`, 'info', 2200);
    });
  }

  // Auto-hide controls in fullscreen after inactivity for true 100% clean video view (RAF throttled for 120Hz gaming mice)
  let fsInactivityTimeout = null;
  let fsMouseMoveRaf = null;

  if (viewerStage) {
    const showFullscreenControls = () => {
      if (!document.fullscreenElement) return;
      if (fsMouseMoveRaf) return;

      fsMouseMoveRaf = requestAnimationFrame(() => {
        fsMouseMoveRaf = null;
        if (!document.fullscreenElement) return;

        viewerStage.classList.add('controls-visible');
        viewerStage.classList.remove('hide-cursor');

        clearTimeout(fsInactivityTimeout);
        fsInactivityTimeout = setTimeout(() => {
          if (document.fullscreenElement) {
            viewerStage.classList.remove('controls-visible');
            viewerStage.classList.add('hide-cursor');
          }
        }, 2500);
      });
    };

    viewerStage.addEventListener('mousemove', showFullscreenControls, { passive: true });
    viewerStage.addEventListener('click', showFullscreenControls, { passive: true });
    viewerStage.addEventListener('touchstart', showFullscreenControls, { passive: true });

    // Double-click on stage to toggle fullscreen
    viewerStage.addEventListener('dblclick', (e) => {
      if (e.target.closest('.video-toolbar') || e.target.closest('.unmute-overlay')) return;
      if (!document.fullscreenElement) {
        if (viewerStage.requestFullscreen) viewerStage.requestFullscreen();
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
      }
    });
  }

  // Fullscreen state listener
  document.addEventListener('fullscreenchange', () => {
    const isFs = Boolean(document.fullscreenElement);
    if (viewerStage) {
      if (!isFs) {
        clearTimeout(fsInactivityTimeout);
        viewerStage.classList.remove('controls-visible', 'hide-cursor');
      } else {
        viewerStage.classList.add('controls-visible');
      }
    }
    updateFullscreenBtnIcon(isFs);
    updateVideoRotation(currentRotation);
  });

  // Window resize listener to recalculate rotation scale
  window.addEventListener('resize', () => {
    if (currentRotation !== 0) {
      updateVideoRotation(currentRotation);
    }
  });

  if (btnPip) {
    btnPip.addEventListener('click', async () => {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else if (viewerVideo.requestPictureInPicture) {
          await viewerVideo.requestPictureInPicture();
        }
      } catch (e) {
        showToast("Picture-in-picture error: " + e.message, "error");
      }
    });
  }

  // 10. Volume slider
  if (volumeSlider) {
    volumeSlider.addEventListener('input', (e) => {
      viewerVideo.volume = parseFloat(e.target.value);
      viewerVideo.muted = viewerVideo.volume === 0;
      if (viewerVideo.volume > 0 && unmuteBanner) {
        unmuteBanner.style.display = 'none';
      }
    });
  }

  // 11. Copy Room Code & Share Link
  if (btnCopyRoomCode) {
    btnCopyRoomCode.addEventListener('click', () => {
      const code = studioRoomCode.textContent;
      copyToClipboard(code, `Room Code ${code} copied!`);
    });
  }

  if (btnCopyShareLink) {
    btnCopyShareLink.addEventListener('click', () => {
      const code = studioRoomCode.textContent;
      const shareUrl = `${window.location.origin}${window.location.pathname}?room=${code}`;
      copyToClipboard(shareUrl, "Shareable stream link copied to clipboard!");
    });
  }

  // 12. Panel Tab Switching (Live Chat vs Info)
  setupPanelTabs(btnStudioTabChat, btnStudioTabInfo, studioPaneChat, studioPaneInfo, studioChatUnread);
  setupPanelTabs(btnViewerTabChat, btnViewerTabInfo, viewerPaneChat, viewerPaneInfo, viewerChatUnread);

  // 14. Chat Message Submission
  if (studioChatForm) {
    studioChatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = studioChatInput.value;
      if (!text.trim()) return;
      studioChatInput.value = '';
      try {
        await sendChatMessage(text, true); // Host message
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }

  if (viewerChatForm) {
    viewerChatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = viewerChatInput.value;
      if (!text.trim()) return;
      viewerChatInput.value = '';
      try {
        await sendChatMessage(text, false); // Viewer message
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }

  // 15. Viewer Microphone Mute / Unmute Toggle (Two-Way Voice Chat)
  if (btnViewerMic) {
    btnViewerMic.addEventListener('click', () => {
      const isMuted = !getViewerMicMuted();
      setViewerMicMuted(isMuted);
      btnViewerMic.classList.toggle('mic-muted', isMuted);
      btnViewerMic.classList.toggle('mic-unmuted', !isMuted);
      if (viewerMicOnIcon) viewerMicOnIcon.style.display = isMuted ? 'none' : 'block';
      if (viewerMicOffIcon) viewerMicOffIcon.style.display = isMuted ? 'block' : 'none';
      showToast(isMuted ? "Your Microphone is Muted 🔴" : "Microphone Active 🟢 (Streamer can hear you!)", isMuted ? "warning" : "success");
    });
  }

  // 16. Streamer Microphone Mute / Unmute Toggle
  if (btnStreamerMic) {
    btnStreamerMic.addEventListener('click', () => {
      const isMuted = !getStreamerMicMuted();
      setStreamerMicMuted(isMuted);
      btnStreamerMic.classList.toggle('mic-muted', isMuted);
      btnStreamerMic.classList.toggle('mic-unmuted', !isMuted);
      if (streamerMicOnIcon) streamerMicOnIcon.style.display = isMuted ? 'none' : 'block';
      if (streamerMicOffIcon) streamerMicOffIcon.style.display = isMuted ? 'block' : 'none';
      showToast(isMuted ? "Host Mic Muted 🔴" : "Host Mic Active 🟢", isMuted ? "warning" : "success");
    });
  }

  // 17. Studio Fullscreen Monitor
  if (btnStudioFullscreen) {
    btnStudioFullscreen.addEventListener('click', () => {
      const stage = studioVideo.closest('.video-stage');
      if (!document.fullscreenElement) {
        if (stage && stage.requestFullscreen) stage.requestFullscreen();
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
      }
    });
  }

  // 17b. Streamer Privacy / Pause Screen Toggle
  if (btnStreamerPause) {
    btnStreamerPause.addEventListener('click', async () => {
      const isPaused = !getStreamPaused();
      await setStreamPaused(isPaused);
      btnStreamerPause.classList.toggle('paused', isPaused);
      if (streamerPauseIcon) streamerPauseIcon.style.display = isPaused ? 'none' : 'block';
      if (streamerResumeIcon) streamerResumeIcon.style.display = isPaused ? 'block' : 'none';
      showToast(isPaused ? "Stream Paused for Privacy ⏸️ (Viewers see pause screen)" : "Stream Resumed ▶️", isPaused ? "warning" : "success");
    });
  }

  // 17c. Microphone Settings Panel & Device Population
  if (optIncludeMic && micSettingsPanel) {
    optIncludeMic.addEventListener('change', async () => {
      micSettingsPanel.style.display = optIncludeMic.checked ? 'block' : 'none';
      if (optIncludeMic.checked) {
        await populateAudioDevices();
      }
    });
  }

  async function populateAudioDevices() {
    if (!optMicDevice) return;
    try {
      const devices = await getAudioInputDevices();
      const currentSelected = optMicDevice.value;
      optMicDevice.innerHTML = '<option value="">Default System Microphone</option>';
      devices.forEach((dev, idx) => {
        const option = document.createElement('option');
        option.value = dev.deviceId;
        option.textContent = dev.label || `Microphone ${idx + 1}`;
        if (dev.deviceId === currentSelected) option.selected = true;
        optMicDevice.appendChild(option);
      });
    } catch (e) {
      console.warn("Could not list audio devices:", e);
    }
  }

  populateAudioDevices().catch(() => {});

  // 18. Network & TURN Relay Settings Modal
  function openSettingsModal() {
    if (!modalSettings) return;
    const settings = getTurnSettings();
    if (settingMeteredAppName) settingMeteredAppName.value = settings.meteredAppName || '';
    if (settingMeteredApiKey) settingMeteredApiKey.value = settings.meteredApiKey || '';
    if (settingCustomTurnUrl) settingCustomTurnUrl.value = settings.turnServerUrl || '';
    if (settingCustomTurnUser) settingCustomTurnUser.value = settings.turnUsername || '';
    if (settingCustomTurnCred) settingCustomTurnCred.value = settings.turnCredential || '';

    setTurnTab(settings.provider || 'metered');

    if (turnTestStatus) turnTestStatus.style.display = 'none';
    modalSettings.style.display = 'flex';
  }

  function closeSettingsModal() {
    if (!modalSettings) return;
    modalSettings.style.display = 'none';
  }

  function setTurnTab(tab) {
    if (tabTurnMetered) tabTurnMetered.classList.toggle('active', tab === 'metered');
    if (tabTurnCustom) tabTurnCustom.classList.toggle('active', tab === 'custom');
    if (panelTurnMetered) panelTurnMetered.style.display = tab === 'metered' ? 'block' : 'none';
    if (panelTurnCustom) panelTurnCustom.style.display = tab === 'custom' ? 'block' : 'none';
  }

  if (tabTurnMetered) {
    tabTurnMetered.addEventListener('click', () => setTurnTab('metered'));
  }
  if (tabTurnCustom) {
    tabTurnCustom.addEventListener('click', () => setTurnTab('custom'));
  }

  if (btnNavbarSettings) {
    btnNavbarSettings.addEventListener('click', openSettingsModal);
  }
  if (btnCloseSettings) {
    btnCloseSettings.addEventListener('click', closeSettingsModal);
  }
  if (modalSettings) {
    modalSettings.addEventListener('click', (e) => {
      if (e.target === modalSettings) closeSettingsModal();
    });
  }

  // Any quick link with class .btn-open-turn-modal
  document.querySelectorAll('.btn-open-turn-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openSettingsModal();
    });
  });

  // Save Settings
  if (btnSaveTurn) {
    btnSaveTurn.addEventListener('click', () => {
      const activeProvider = tabTurnCustom && tabTurnCustom.classList.contains('active') ? 'custom' : 'metered';
      const settings = {
        provider: activeProvider,
        meteredAppName: settingMeteredAppName ? settingMeteredAppName.value.trim() : '',
        meteredApiKey: settingMeteredApiKey ? settingMeteredApiKey.value.trim() : '',
        turnServerUrl: settingCustomTurnUrl ? settingCustomTurnUrl.value.trim() : '',
        turnUsername: settingCustomTurnUser ? settingCustomTurnUser.value.trim() : '',
        turnCredential: settingCustomTurnCred ? settingCustomTurnCred.value.trim() : ''
      };
      saveTurnSettings(settings);
      showToast("Network & TURN Settings saved! 🌐", "success");
      closeSettingsModal();
    });
  }

  // Reset Settings
  if (btnClearTurn) {
    btnClearTurn.addEventListener('click', () => {
      clearTurnSettings();
      if (settingMeteredAppName) settingMeteredAppName.value = '';
      if (settingMeteredApiKey) settingMeteredApiKey.value = '';
      if (settingCustomTurnUrl) settingCustomTurnUrl.value = '';
      if (settingCustomTurnUser) settingCustomTurnUser.value = '';
      if (settingCustomTurnCred) settingCustomTurnCred.value = '';
      if (turnTestStatus) turnTestStatus.style.display = 'none';
      showToast("Reset network settings to default STUN", "info");
    });
  }

  // Test Relay Connection
  if (btnTestTurn) {
    btnTestTurn.addEventListener('click', async () => {
      const activeProvider = tabTurnCustom && tabTurnCustom.classList.contains('active') ? 'custom' : 'metered';
      const testSettings = {
        provider: activeProvider,
        meteredAppName: settingMeteredAppName ? settingMeteredAppName.value.trim() : '',
        meteredApiKey: settingMeteredApiKey ? settingMeteredApiKey.value.trim() : '',
        turnServerUrl: settingCustomTurnUrl ? settingCustomTurnUrl.value.trim() : '',
        turnUsername: settingCustomTurnUser ? settingCustomTurnUser.value.trim() : '',
        turnCredential: settingCustomTurnCred ? settingCustomTurnCred.value.trim() : ''
      };

      if (turnTestStatus && turnTestMessage) {
        turnTestStatus.style.display = 'flex';
        turnTestStatus.className = 'test-status-box test-loading';
        turnTestMessage.textContent = "Probing STUN & TURN servers for relay candidates...";
      }

      btnTestTurn.disabled = true;

      try {
        const result = await testTurnConnection(testSettings);
        if (turnTestStatus && turnTestMessage) {
          turnTestStatus.style.display = 'flex';
          turnTestStatus.className = `test-status-box ${result.success ? 'test-success' : 'test-error'}`;
          turnTestMessage.textContent = `${result.success ? '✅' : '⚠️'} ${result.message}`;
        }
      } catch (err) {
        if (turnTestStatus && turnTestMessage) {
          turnTestStatus.style.display = 'flex';
          turnTestStatus.className = 'test-status-box test-error';
          turnTestMessage.textContent = `❌ Test error: ${err.message}`;
        }
      } finally {
        btnTestTurn.disabled = false;
      }
    });
  }
}

// Auto-start on DOM Ready
document.addEventListener('DOMContentLoaded', initializeAppWorkflow);

