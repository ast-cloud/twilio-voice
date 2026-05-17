require("dotenv").config();
const express = require("express");
const cors = require("cors");
const twilio = require("twilio");
const { AccessToken } = twilio.jwt;
const { VoiceGrant } = AccessToken;
const VoiceResponse = twilio.twiml.VoiceResponse;

const app = express();
app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_API_KEY,
  TWILIO_API_SECRET,
  TWILIO_TWIML_APP_SID,
  TWILIO_CALLER_ID,
  PORT = 3001,
} = process.env;

// Health check
app.get("/", (req, res) => res.json({ status: "ok" }));

// Generate an Access Token for the browser client
app.get("/token", (req, res) => {
  const identity = req.query.identity || "browser-user";

  const token = new AccessToken(
    TWILIO_ACCOUNT_SID,
    TWILIO_API_KEY,
    TWILIO_API_SECRET,
    { identity, ttl: 3600 }
  );

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: TWILIO_TWIML_APP_SID,
    incomingAllow: true,
  });

  token.addGrant(voiceGrant);

  res.json({ token: token.toJwt(), identity });
});

// TwiML webhook — Twilio calls this when the browser client places/receives a call
app.post("/voice", (req, res) => {
  const twiml = new VoiceResponse();
  const to = req.body.To;

  if (to) {
    const dial = twiml.dial({ callerId: TWILIO_CALLER_ID });

    // If To looks like a phone number, dial it; otherwise connect to a browser client
    if (to.startsWith("+") || /^\d+$/.test(to)) {
      dial.number(to);
    } else {
      dial.client(to);
    }
  } else {
    twiml.say("Thank you for calling. Goodbye.");
  }

  res.type("text/xml");
  res.send(twiml.toString());
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Token endpoint:  GET  http://localhost:${PORT}/token`);
  console.log(`Voice webhook:   POST http://localhost:${PORT}/voice`);
});
