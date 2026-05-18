import { useEffect, useRef, useState, useCallback } from "react";
import { Device } from "@twilio/voice-sdk";
import styles from "./Dialer.module.css";

const DIGITS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["*", "0", "#"],
];

const STATUS_LABELS = {
  offline: "Offline",
  registering: "Registering...",
  ready: "Ready",
  calling: "Calling...",
  ringing: "Ringing...",
  "on-call": "On Call",
  incoming: "Incoming Call",
  error: "Error",
};

export default function Dialer() {
  const deviceRef = useRef(null);
  const activeCallRef = useRef(null);

  const [status, setStatus] = useState("offline");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [incomingCall, setIncomingCall] = useState(null);

  const updateStatus = (s) => {
    setStatus(s);
    if (s !== "error") setErrorMsg("");
  };

  // Boot the Twilio Device
  const connect = useCallback(async () => {
    try {
      updateStatus("registering");
      const base = import.meta.env.VITE_BACKEND_URL ?? "";
      const res = await fetch(`${base}/token?identity=browser-user`);
      const { token } = await res.json();

      const device = new Device(token, { logLevel: "warn" });

      device.on("registered", () => updateStatus("ready"));
      device.on("error", (err) => {
        setErrorMsg(err.message);
        updateStatus("error");
      });
      device.on("unregistered", () => updateStatus("offline"));

      device.on("incoming", (call) => {
        setIncomingCall(call);
        updateStatus("incoming");

        call.on("disconnect", () => {
          setIncomingCall(null);
          activeCallRef.current = null;
          updateStatus("ready");
        });
        call.on("cancel", () => {
          setIncomingCall(null);
          updateStatus("ready");
        });
      });

      await device.register();
      deviceRef.current = device;
    } catch (err) {
      setErrorMsg(err.message);
      updateStatus("error");
    }
  }, []);

  // Disconnect / unregister device
  const disconnect = useCallback(async () => {
    if (activeCallRef.current) {
      activeCallRef.current.disconnect();
      activeCallRef.current = null;
    }
    if (deviceRef.current) {
      await deviceRef.current.unregister();
      deviceRef.current.destroy();
      deviceRef.current = null;
    }
    updateStatus("offline");
  }, []);

  // Place an outbound call
  const startCall = useCallback(async () => {
    if (!deviceRef.current || !phoneNumber.trim()) return;
    try {
      updateStatus("calling");
      const call = await deviceRef.current.connect({ params: { To: phoneNumber.trim() } });

      activeCallRef.current = call;

      call.on("accept", () => updateStatus("on-call"));
      call.on("ringing", () => updateStatus("ringing"));
      call.on("disconnect", () => {
        activeCallRef.current = null;
        setIsMuted(false);
        updateStatus("ready");
      });
      call.on("error", (err) => {
        setErrorMsg(err.message);
        activeCallRef.current = null;
        updateStatus("error");
      });
    } catch (err) {
      setErrorMsg(err.message);
      updateStatus("error");
    }
  }, [phoneNumber]);

  // Hang up active call
  const hangUp = useCallback(() => {
    if (activeCallRef.current) {
      activeCallRef.current.disconnect();
    }
  }, []);

  // Accept incoming call
  const acceptCall = useCallback(() => {
    if (!incomingCall) return;
    incomingCall.accept();
    activeCallRef.current = incomingCall;
    setIncomingCall(null);
    updateStatus("on-call");
  }, [incomingCall]);

  // Reject incoming call
  const rejectCall = useCallback(() => {
    if (!incomingCall) return;
    incomingCall.reject();
    setIncomingCall(null);
    updateStatus("ready");
  }, [incomingCall]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (!activeCallRef.current) return;
    const next = !isMuted;
    activeCallRef.current.mute(next);
    setIsMuted(next);
  }, [isMuted]);

  // Send DTMF digit
  const pressDigit = useCallback((digit) => {
    setPhoneNumber((prev) => prev + digit);
    if (status === "on-call" && activeCallRef.current) {
      activeCallRef.current.sendDigits(digit);
    }
  }, [status]);

  // Clean up on unmount
  useEffect(() => () => { disconnect(); }, [disconnect]);

  const isCallActive = status === "on-call" || status === "calling" || status === "ringing";
  const isReady = status === "ready";

  return (
    <div className={styles.card}>
      <h1 className={styles.title}>Twilio Dialer</h1>

      {/* Status badge */}
      <div className={`${styles.statusBadge} ${styles[status]}`}>
        <span className={styles.dot} />
        {STATUS_LABELS[status] || status}
      </div>

      {errorMsg && <p className={styles.error}>{errorMsg}</p>}

      {/* Phone number display */}
      <div className={styles.display}>
        <input
          className={styles.numberInput}
          type="tel"
          placeholder="+1 (555) 000-0000"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          disabled={isCallActive}
        />
        <button
          className={styles.clearBtn}
          onClick={() => setPhoneNumber((p) => p.slice(0, -1))}
          disabled={isCallActive || !phoneNumber}
          aria-label="Backspace"
        >
          ⌫
        </button>
      </div>

      {/* Dial pad */}
      <div className={styles.dialpad}>
        {DIGITS.map((row, r) => (
          <div key={r} className={styles.row}>
            {row.map((d) => (
              <button
                key={d}
                className={styles.digit}
                onClick={() => pressDigit(d)}
                disabled={status === "offline" || status === "registering"}
              >
                {d}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Incoming call banner */}
      {status === "incoming" && (
        <div className={styles.incomingBanner}>
          <p>Incoming call…</p>
          <div className={styles.incomingActions}>
            <button className={`${styles.actionBtn} ${styles.accept}`} onClick={acceptCall}>Accept</button>
            <button className={`${styles.actionBtn} ${styles.reject}`} onClick={rejectCall}>Reject</button>
          </div>
        </div>
      )}

      {/* Primary actions */}
      <div className={styles.actions}>
        {!isCallActive && status !== "incoming" && (
          <>
            {status === "offline" || status === "error" ? (
              <button className={`${styles.actionBtn} ${styles.connect}`} onClick={connect}>
                Connect
              </button>
            ) : (
              <>
                <button
                  className={`${styles.actionBtn} ${styles.call}`}
                  onClick={startCall}
                  disabled={!isReady || !phoneNumber.trim()}
                >
                  Call
                </button>
                <button className={`${styles.actionBtn} ${styles.disconnect}`} onClick={disconnect}>
                  Disconnect
                </button>
              </>
            )}
          </>
        )}

        {isCallActive && (
          <>
            <button
              className={`${styles.actionBtn} ${isMuted ? styles.unmute : styles.mute}`}
              onClick={toggleMute}
            >
              {isMuted ? "Unmute" : "Mute"}
            </button>
            <button className={`${styles.actionBtn} ${styles.hangup}`} onClick={hangUp}>
              Hang Up
            </button>
          </>
        )}
      </div>
    </div>
  );
}
