import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import SessionTimer from "../components/SessionTimer";
import api from "../lib/api";
import "./CheckIn.css";

export default function CheckIn() {
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { ok, message, session? }
  const scannerRef = useRef(null);

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) submitCheckIn({ token });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitCheckIn({ code: manualCode, token }) {
    setResult(null);
    setSubmitting(true);

    let coords = {};
    try {
      const pos = await getPosition();
      coords = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
    } catch {
      // location not available/denied — fine unless the session requires it
    }

    try {
      const { data } = await api.post("/sessions/check-in", {
        code: manualCode,
        token,
        ...coords,
      });
      setResult({
        ok: true,
        message: `Checked in — marked ${data.status} for ${data.class}`,
        session: data,
      });
    } catch (err) {
      setResult({
        ok: false,
        message: err.response?.data?.error || "Check-in failed",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function getPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject();
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 5000,
      });
    });
  }

  async function startScanner() {
    setScanning(true);
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;
    await scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 220 },
      async (decodedText) => {
        await scanner.stop();
        setScanning(false);
        try {
          const url = new URL(decodedText);
          const token = url.searchParams.get("token");
          submitCheckIn({ token });
        } catch {
          setResult({ ok: false, message: "Unrecognized QR code" });
        }
      },
      () => {},
    );
  }

  async function stopScanner() {
    if (scannerRef.current) await scannerRef.current.stop();
    setScanning(false);
  }

  return (
    <div className="max-w-sm mx-auto page-body teacher-dashboard">
      <h1 className="text-2xl font-semibold mb-4">Check In</h1>

      {!scanning ? (
        <button
          onClick={startScanner}
          disabled={submitting}
          className="w-full bg-blue-600 text-white rounded-lg py-2 mb-4 disabled:opacity-50"
        >
          Scan QR code
        </button>
      ) : (
        <div className="mb-4">
          <div id="qr-reader" className="mb-2" />
          <button onClick={stopScanner} className="text-sm text-gray-500">
            Cancel scan
          </button>
        </div>
      )}

      <p className="text-center text-gray-400 text-sm mb-4">— or —</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitCheckIn({ code });
        }}
        className="flex gap-2 mb-4"
      >
        <input
          className="flex-1 border rounded-lg px-3 py-2 uppercase tracking-widest"
          placeholder="Enter code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={6}
          disabled={submitting}
        />
        <button
          className="bg-gray-800 text-white px-4 rounded-lg flex items-center justify-center min-w-[64px] disabled:opacity-70"
          disabled={submitting}
        >
          {submitting ? (
            <span className="spinner" aria-label="Checking in" />
          ) : (
            "Go"
          )}
        </button>
      </form>

      {result && (
        <p
          className={`text-center font-medium mb-3 ${result.ok ? "text-green-600" : "text-red-600"}`}
        >
          {result.message}
        </p>
      )}

      {result?.ok && result.session && (
        <SessionTimer
          opensAt={result.session.opensAt}
          closesAt={result.session.closesAt}
          status={result.session.sessionStatus}
        />
      )}
    </div>
  );
}
