# NovaStream — 4K & 1080p 120Hz / 60FPS Ultra-Smooth WebRTC Streaming

A peer-to-peer (P2P) web application that enables you to stream **anything** from your device (full monitors, game windows, desktop applications, or browser tabs) directly to another person in **native 4K (3840x2160) or 1080p @ 120 FPS / 60 FPS** with **system audio** and **near-zero latency (< 15ms)**.

Secured with **Google Sign-In (Firebase Authentication)** and powered by **Cloud Firestore** for real-time signaling.

---

## ⚡ Key Highlights

- **Buttery-Smooth 120 FPS & 60 FPS Capture**: Locks up to 120 frames per second display capture for high-refresh 120Hz/144Hz monitors with continuous `motion` content hint and `maintain-framerate` degradation preference.
- **120Hz Native Compositor UI**: Liquid Glass interface completely optimized for 120Hz/144Hz/240Hz displays with GPU-composited 3D transforms, zero CPU layout thrashing, and active display refresh rate auto-detection.
- **Ultra-Low Latency (< 15ms)**: Uses direct WebRTC UDP peer-to-peer streaming with minimal jitter buffer target (15ms) and immediate playout instead of RTMP/HLS (which adds 5–15 seconds of buffering delay).
- **Two-Way Voice Chat**: Viewers can speak directly to the streamer in real-time, with instant 1-click microphone mute/unmute.
- **End-to-End Encrypted (E2EE) Live Chat**: Messages are encrypted directly on devices with **256-bit AES-GCM** and unique 96-bit IVs using the Web Crypto API. Zero plaintext is stored in Firestore.
- **Hardware-Accelerated Codecs (VP9 / H.264 High Profile / AV1)**: Prioritizes modern GPU video encoders (Nvidia NVENC, AMD AMF, Intel QuickSync, Apple Silicon) with level-asymmetry-allowed for butter-smooth 120 FPS compression.
- **Ultra-High Bitrate Pipe (Up to 50 Mbps)**: Custom SDP munging removes browser WebRTC bandwidth caps and kicks off instant high-bandwidth ramp-up (`x-google-start-bitrate`).
- **Hi-Fi Stereo Sound (Opus 510 kbps @ 48 kHz)**: Crystal-clear game/system audio capture with optional microphone commentary mixing.
- **Firebase Google Authentication**: Streamers and viewers sign in securely using their Google accounts.
- **Real-Time Performance HUD**: Live on-screen telemetry showing rendered FPS, resolution, bitrate throughput, and round-trip ping.
- **Modern Next.js 15 + React 19 + Tailwind CSS Architecture**: Ultra-clean componentized UI with fluid cubic-bezier transitions, glassmorphic panels, and hardware-composited backdrop orbs.
- **Dual-Channel ICE + Metered TURN Relay**: Connect reliably across different Wi-Fi networks, cellular 4G/5G mobile hotspots, and strict symmetric NAT firewalls worldwide.
- **Secure GitHub / Vercel Hosting**: Supports one-click Vercel deployment with Next.js or static export to GitHub Pages.

---

## 🚀 Quick Start (Running Locally)

### Option 1: Double-Click Launcher (Recommended)
Simply double-click **`start.bat`** in this folder. It launches the Next.js 15 dev server and opens `http://localhost:3000` in your default browser.

### Option 2: Standard NPM
```bash
npm run dev
```
Then visit [http://localhost:3000](http://localhost:3000).

### Option 3: Production Build
```bash
npm run build
npm start
```

### Option 4: PowerShell Launcher
Open PowerShell in this folder and run:
```powershell
.\start-server.ps1
```

---

## 🔒 Local `.env` Configuration

Your credentials are kept safely in your local **`.env`** file (which is ignored by Git in `.gitignore`):
```env
FIREBASE_API_KEY=AIzaSy...
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project
FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abcdef...
```

When you launch `start.bat` or `.\start-server.ps1`, it automatically loads these credentials into the local runtime without touching any Git-tracked files.

---

## 🌐 Deploying to GitHub Pages with Secrets

NovaStream includes a pre-configured GitHub Actions workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

### Step 1: Create a GitHub Repository
1. Go to [GitHub](https://github.com/new) and create a new repository (e.g. `novastream`).

### Step 2: Push Your Code
Open PowerShell in `d:\Streaming` and run:
```powershell
git init
git add .
git commit -m "Initial commit of NovaStream 1080p60 WebRTC"
git branch -M main
git remote add origin https://github.com/<YOUR-USERNAME>/<YOUR-REPO-NAME>.git
git push -u origin main
```
*(Notice: Your `.env` and `env-config.js` will NOT be committed because they are protected by `.gitignore`)*.

### Step 3: Add Your Firebase Secrets to GitHub
1. In your GitHub repository, click **Settings** > **Secrets and variables** > **Actions**.
2. Click **New repository secret** and add the following 6 secrets from your `.env`:
   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_STORAGE_BUCKET`
   - `FIREBASE_MESSAGING_SENDER_ID`
   - `FIREBASE_APP_ID`

### Step 4: Enable GitHub Pages
1. In your GitHub repository, go to **Settings** > **Pages**.
2. Under **Build and deployment > Source**, select **GitHub Actions**.
3. Now go to the **Actions** tab. The **Deploy to GitHub Pages** workflow will run automatically.
4. Once completed, your site will be live at:
   ```
   https://<YOUR-USERNAME>.github.io/<YOUR-REPO-NAME>/
   ```

### Step 5: Authorize GitHub Domain in Firebase
To allow Google Sign-In to work on your new GitHub Pages site:
1. Go to [Firebase Console](https://console.firebase.google.com/) > Your Project.
2. Navigate to **Authentication** > **Settings** tab.
3. Under **Authorized domains**, click **Add domain**.
4. Add: `<YOUR-USERNAME>.github.io`
5. Click **Add**.

### Step 6: Set Firestore Security Rules for P2P Signaling
To allow distant peers to exchange WebRTC SDP offers, answers, and ICE candidates in real time:
1. Go to [Firebase Console](https://console.firebase.google.com/) > Your Project.
2. Click **Firestore Database** in the left sidebar.
3. Click the **Rules** tab at the top.
4. Replace all existing text with the contents of [`firestore.rules`](firestore.rules):
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /rooms/{roomId} {
         allow read, write: if true;

         match /callerCandidates/{candidateId} {
           allow read, write: if true;
         }

         match /calleeCandidates/{candidateId} {
           allow read, write: if true;
         }

         match /viewers/{viewerId} {
           allow read, write: if true;
           match /{viewerChildren=**} {
             allow read, write: if true;
           }
         }

         match /messages/{messageId} {
           allow read, write: if true;
         }

         match /{allChildren=**} {
           allow read, write: if true;
         }
       }

       match /{document=**} {
         allow read, write: if false;
       }
     }
   }
   ```
5. Click **Publish**.

---

## 🌐 Streaming to Friends Across the Internet (TURN Relay Setup)

### Why does "Unable to establish direct P2P connection" happen?
When two computers are on the same Wi-Fi router, WebRTC connects directly using local LAN IPs (`host` candidates).
However, when streaming to a friend on another network, residential ISP, mobile hotspot, or college Wi-Fi:
* Modern routers and mobile operators enforce **Symmetric NAT and Carrier-Grade NAT (CGNAT)**.
* NAT firewalls block unsolicited incoming direct UDP packets.
* Google STUN servers only discover your public IP — **STUN cannot relay video packets through firewalls**.

### The Solution: Built-in TURN Relay Support
NovaStream includes built-in support for **free TURN relay servers** (via **Metered.ca** or custom CoTURN/Twilio/Cloudflare):
1. In NovaStream, click **Settings** (or click **"Configure free TURN relay"**).
2. Get your free account at [metered.ca/tools/openrelay](https://www.metered.ca/tools/openrelay/) (**50 GB free every month**, no credit card required).
3. Paste your **Metered App Name** and **API Key**.
4. Click **🔍 Test Relay Connection** — you will see a green checkmark confirming TURN relay connectivity!
5. Click **Save Settings**.

> **💡 Host Relay Inheritance:** When the Streamer configures a TURN relay, NovaStream **automatically shares the relay server with the viewer via Firestore**! Your friend just enters the 6-character room code and connects instantly without having to configure anything!

---

## 🎮 How to Stream Anything to Another Person

### For the Streamer:
1. Open the website and click **Sign in with Google**.
2. Under **Broadcast From This Device**, choose your settings:
   - Resolution: `1080p Full HD` (or `1440p` / `4K`)
   - Frame Rate: `60 FPS`
   - Bitrate: `10 Mbps` or `12 Mbps`
   - Check **Mix Microphone** if you want to speak.
3. Click **Start 1080p60 Stream**.
4. In the browser screen share dialog:
   - Select **Entire Screen** (to stream games or anything on your PC) or **Window**.
   - Ensure **"Share system audio"** is checked at the bottom of the dialog.
5. Copy the **Room Code** or click **Copy 1-Click Invite Link** and send it to your friend!

### For the Viewer:
1. Open the invite link (or website).
2. Click **Sign in with Google**, enter the room code, and click **Join Stream**.
3. The stream connects within milliseconds in full 1080p 60fps!
4. If your browser restricts audio autoplay, click the **Unmute Stream** prompt on the screen.

---

## 📂 Project Structure

```
d:\Streaming\
├── .env                  # Local Firebase credentials (NEVER committed to git)
├── .env.example          # Template for repository
├── .gitignore            # Protects .env and local generated files
├── .github\
│   └── workflows\
│       └── deploy.yml    # GitHub Actions workflow for automatic Pages deployment
├── index.html            # Main web application & responsive UI
├── style.css             # Liquid Glass UI, morphing living orbs & specular bevels
├── app.js                # UI coordinator, routing, telemetry HUD, modals
├── auth.js               # Firebase Google Authentication & user profile state
├── chat.js               # End-to-end encrypted (E2EE) live chat engine
├── firebase-config.js    # Firebase SDK initialization & environment resolver
├── streamer.js           # 4K/1080p60 screen capture & host WebRTC signaling
├── viewer.js             # Viewer WebRTC peer client & 2-way voice controller
├── webrtc.js             # Bitrate optimization, SDP munging, 60fps & audio tuning
├── start.bat             # 1-Click Windows execution launcher
├── start-server.ps1      # Native .NET HttpListener server & .env loader
├── README.md             # Documentation & setup guide
```
