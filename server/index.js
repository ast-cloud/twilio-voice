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
  const from = req.body.From;
  console.log("Received a call from ", from, " to ", to);
  try{

    if(from==="+19295279683" ||from==="+918318485265" || from==="+917974035876"){ //Check if gym customer is calling, if yes then connect to gym number
      const localGymNumber = "+919532864296"; // Replace with your gym's phone number after fetching it from db
      const dial = twiml.dial({ callerId: from });
      dial.number(localGymNumber);
    } else if (to) {

      // Emergency Block Check
      const cleanTo = to.replace(/^\+1/, "").trim();
      if (cleanTo === "911" || cleanTo === "933") {
        console.log(`[BLOCK] Blocked an attempted call to emergency number: ${to}`);
        twiml.say("Emergency calling is not supported on this platform. Please use your standard mobile device.");
        twiml.hangup();
      }

      console.log("Going to call")
      const dial = twiml.dial({ callerId: TWILIO_CALLER_ID });
      console.log("1")
      // If To looks like a phone number, dial it; otherwise connect to a browser client
      if (to.startsWith("+") || /^\d+$/.test(to)) {
        console.log("2")
        dial.number(to);
        console.log("3")
      } else {
        console.log("4")
        dial.client(to);
        console.log("5")
      }
    } else {
      twiml.say("Thank you for calling. Goodbye.");
    }
  }catch(error){
    console.log("Error while calling : ", error);
  }
  console.log("6")
  console.log(twiml.toString())
  res.type("text/xml");
  res.send(twiml.toString());
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Token endpoint:  GET  http://localhost:${PORT}/token`);
  console.log(`Voice webhook:   POST http://localhost:${PORT}/voice`);
});
