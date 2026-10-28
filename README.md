# NovaStream — 4K & 1080p 120Hz / 60FPS Ultra-Smooth WebRTC Streaming (Next.js Edition)

A peer-to-peer (P2P) web application built with **Next.js 14**, **React 18**, and **Tailwind CSS** that enables you to stream **anything** from your device (full monitors, game windows, desktop applications, or browser tabs) directly to another person in **native 4K (3840x2160) or 1080p @ 120 FPS / 60 FPS** with **system audio** and **near-zero latency (< 15ms)**.

Secured with **Google Sign-In (Firebase Authentication)** and powered by **Cloud Firestore** for real-time signaling.

---

## ⚡ Key Highlights

- **120 FPS & 60 FPS Capture**: Locks up to 120 frames per second display capture for high-refresh 120Hz/144Hz monitors with continuous `motion` content hint and `maintain-framerate` degradation preference.
- **120Hz Native Compositor UI**: Liquid Glass interface completely optimized for 120Hz/144Hz/240Hz displays with GPU-composited 3D transforms, zero CPU layout thrashing, and active display refresh rate auto-detection.
- **Ultra-Low Latency (< 15ms)**: Uses direct WebRTC UDP peer-to-peer streaming with minimal jitter buffer target (15ms) and zero playout delay hint instead of RTMP/HLS (which adds 5–15 seconds of buffering delay).
- **Two-Way Voice Chat**: Viewers can speak directly to the streamer in real-time, with instant 1-click microphone mute/unmute.
- **End-to-End Encrypted (E2EE) Live Chat**: Messages are encrypted directly on devices with **256-bit AES-GCM** and unique 96-bit IVs using the Web Crypto API. Zero plaintext is stored in Firestore.
- **Hardware-Accelerated Codecs (VP9 / H.264 High Profile / AV1)**: Prioritizes modern GPU video encoders (Nvidia NVENC, AMD AMF, Intel QuickSync, Apple Silicon) with level-asymmetry-allowed for butter-smooth 120 FPS compression.
- **Ultra-High Bitrate Pipe (Up to 50 Mbps)**: Custom SDP munging removes browser WebRTC bandwidth caps and kicks off instant high-bandwidth ramp-up (`x-google-start-bitrate`).
- **Hi-Fi Stereo Sound (Opus 510 kbps @ 48 kHz)**: Crystal-clear game/system audio capture with optional microphone commentary mixing.
- **Firebase Google Authentication**: Streamers and viewers sign in securely using their Google accounts.
- **Real-Time Performance HUD**: Live on-screen telemetry showing rendered FPS, resolution, bitrate throughput, and round-trip ping.
- **Modern Next.js 14 + React 18 + Tailwind CSS Architecture**: Ultra-clean componentized UI with fluid cubic-bezier transitions, glassmorphic panels, and hardware-composited backdrop orbs.
- **Dual-Channel ICE + Metered TURN Relay**: Connect reliably across different Wi-Fi networks, cellular 4G/5G mobile hotspots, and strict symmetric NAT firewalls worldwide.
- **Static Next.js Export for GitHub Pages**: Automatic CI/CD workflow via GitHub Actions.

---

## 🚀 Quick Start (Running Locally)

### Standard NPM
```bash
npm run dev
```
Then visit [http://localhost:3000](http://localhost:3000).

### Production Build & Export
```bash
npm run build
npm start
```

---

## 🔒 Local `.env.local` Configuration

Your credentials are kept safely in your local **`.env.local`** file (which is protected by `.gitignore` and never committed to GitHub):
```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef...

# Optional TURN Relay Server (Metered.ca or custom)
NEXT_PUBLIC_METERED_APP_NAME=
NEXT_PUBLIC_METERED_API_KEY=
NEXT_PUBLIC_TURN_SERVER_URL=
NEXT_PUBLIC_TURN_USERNAME=
NEXT_PUBLIC_TURN_CREDENTIAL=
```

---

## 🌐 Deploying to GitHub Pages with Secrets

NovaStream includes a pre-configured GitHub Actions workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

### Step 1: Create a GitHub Repository
1. Go to [GitHub](https://github.com/new) and create a new repository (e.g. `novastream`).
2. Make sure it is set to **Public** (for free GitHub Pages).
3. Do **not** check "Add a README file" (we already have our own).

### Step 2: Push Your Code
Open PowerShell or Command Prompt in this folder and run:
```bash
git init
git add .
git commit -m "feat: Initial commit of NovaStream Next.js 14 WebRTC app"
git branch -M main
git remote add origin https://github.com/<YOUR-USERNAME>/<YOUR-REPO-NAME>.git
git push -u origin main
```
*(Notice: Your `.env.local` and `.next/` build files will NOT be committed because they are protected by `.gitignore`)*.

### Step 3: Add Your Firebase Secrets to GitHub
1. In your GitHub repository, click **Settings** > **Secrets and variables** > **Actions**.
2. Click **New repository secret** and add the following 6 secrets from your `.env.local`:
   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_STORAGE_BUCKET`
   - `FIREBASE_MESSAGING_SENDER_ID`
   - `FIREBASE_APP_ID`

### Step 4: Enable GitHub Pages (Instant Root Deployment)
1. In your GitHub repository, go to **Settings** > **Pages**.
2. Under **Build and deployment > Source**, ensure **Deploy from a branch** is selected.
3. Select branch: **`main`** and folder: **`/ (root)`**.
4. Click **Save**.
5. Your site is live immediately at:
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
