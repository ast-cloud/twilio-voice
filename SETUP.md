# Twilio Browser Calling — Setup Guide

## Project Structure

```
Twilio Calling/
├── server/          Express backend (token generation + TwiML webhook)
│   ├── index.js
│   ├── .env         ← you create this (copy from .env.example)
│   └── package.json
└── client/          React frontend (Twilio Voice SDK)
    ├── src/
    │   ├── App.jsx
    │   └── components/Dialer.jsx
    └── package.json
```

---

## Step 1 — Twilio Console Setup

1. Sign up for a free trial at https://www.twilio.com/try-twilio
2. Note your **Account SID** and **Auth Token** from the dashboard

### Create an API Key
- Console → Account → API Keys & Tokens → Create API Key
- Type: **Standard**
- Save the **SID** (starts with `SK`) and **Secret** (shown only once)

### Get a Phone Number
- Console → Phone Numbers → Manage → Buy a number
- (Free trial gives you $15.50 credit — a number costs ~$1/month)

### Create a TwiML Application
- Console → Voice → TwiML Apps → Create new TwiML App
- **Voice Request URL**: `http://localhost:3001/voice` (for local dev)
  - For production, replace with your public server URL (use ngrok for testing)
- Save the **TwiML App SID** (starts with `AP`)

---

## Step 2 — Configure the Server

```bash
cd server
cp .env.example .env
```

Edit `.env` and fill in all values:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_API_KEY=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_SECRET=your_api_secret
TWILIO_TWIML_APP_SID=APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_CALLER_ID=+1xxxxxxxxxx
PORT=3001
```

---

## Step 3 — Install Dependencies & Run

### Backend
```bash
cd server
npm install
npm run dev
```

### Frontend (new terminal)
```bash
cd client
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

---

## Step 4 — Expose localhost for Twilio (required for inbound calls)

Twilio's servers need to reach your `/voice` webhook. Use **ngrok**:

```bash
ngrok http 3001
```

Then update your TwiML App's Voice Request URL to:
`https://your-ngrok-id.ngrok-free.app/voice`

Outbound calls from the browser work without ngrok.

---

## How It Works

```
Browser                   Express Server              Twilio
  |                            |                          |
  |-- GET /token ------------->|                          |
  |<-- AccessToken ------------|                          |
  |                            |                          |
  |-- device.connect() ------->|-- POST /voice (TwiML) -->|
  |                            |<-- TwiML response --------|
  |<===== WebRTC audio =====================================|
```

- `/token` — signs an Access Token with your API Key/Secret + VoiceGrant
- `/voice` — returns TwiML that tells Twilio to dial the requested number
- The browser connects via WebRTC; Twilio bridges to PSTN

---

## Trial Account Limitations

- All calls begin with: *"You have a trial account..."*
- Outbound calls can only go to **verified caller IDs** (add at: Console → Phone Numbers → Verified Caller IDs)
- $15.50 starting credit, ~$0.013/min for US calls
