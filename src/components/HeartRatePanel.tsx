import { useEffect, useRef, useState } from 'react';
import type { AppState, TrainingType } from '../lib/types';
import type { AppApi } from '../App';
import { HeartRateMonitor, isBluetoothSupported } from '../lib/bluetooth';
import { estimateMaxHr } from '../lib/metrics';
import { uid } from '../lib/storage';

interface SessionAccum {
  startedAt: number;
  sum: number;
  count: number;
  max: number;
}

function hrZone(bpm: number, maxHr: number): { name: string; color: string } {
  const f = bpm / maxHr;
  if (f < 0.6) return { name: 'Zone 1 · Recovery', color: '#3b82f6' };
  if (f < 0.7) return { name: 'Zone 2 · Aerobic', color: '#00e0a4' };
  if (f < 0.8) return { name: 'Zone 3 · Tempo', color: '#f5a623' };
  if (f < 0.9) return { name: 'Zone 4 · Threshold', color: '#ff8c42' };
  return { name: 'Zone 5 · Max', color: '#ff5a5f' };
}

export function HeartRatePanel({
  state,
  api,
  today,
}: {
  state: AppState;
  api: AppApi;
  today: string;
}) {
  const monitorRef = useRef<HeartRateMonitor | null>(null);
  const [connected, setConnected] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [bpm, setBpm] = useState<number | null>(null);
  const [hrv, setHrv] = useState<number | null>(null);
  const [battery, setBattery] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [sessionType, setSessionType] = useState<TrainingType>('cardio');
  const accum = useRef<SessionAccum | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const maxHr = estimateMaxHr(state.profile.age);
  const supported = isBluetoothSupported();

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => {
      if (accum.current) {
        setElapsed(Math.round((Date.now() - accum.current.startedAt) / 1000));
      }
    }, 1000);
    return () => clearInterval(t);
  }, [recording]);

  useEffect(() => {
    return () => {
      monitorRef.current?.disconnect();
    };
  }, []);

  // Keep the latest recording flag available to the sample handler.
  const recordingRef = useRef(recording);
  recordingRef.current = recording;

  const connect = async () => {
    setError(null);
    const monitor = new HeartRateMonitor({
      onSample: (s) => {
        setBpm(s.bpm);
        if (s.hrv != null) setHrv(s.hrv);
        if (recordingRef.current && accum.current) {
          accum.current.sum += s.bpm;
          accum.current.count += 1;
          accum.current.max = Math.max(accum.current.max, s.bpm);
        }
      },
      onConnected: (name) => {
        setConnected(true);
        setDeviceName(name);
      },
      onDisconnected: () => {
        setConnected(false);
        setBpm(null);
      },
      onBattery: setBattery,
      onError: setError,
    });
    monitorRef.current = monitor;
    await monitor.connect();
  };

  const disconnect = async () => {
    await monitorRef.current?.disconnect();
    setConnected(false);
    setBpm(null);
  };

  const saveRecovery = () => {
    api.patchRecovery(today, {
      restingHr: bpm ?? undefined,
      hrvMs: hrv != null ? Math.round(hrv) : undefined,
    });
    setError(null);
  };

  const startSession = () => {
    accum.current = { startedAt: Date.now(), sum: 0, count: 0, max: 0 };
    setElapsed(0);
    setRecording(true);
  };

  const stopSession = () => {
    setRecording(false);
    const a = accum.current;
    if (a && a.count > 0) {
      const durationMin = Math.max(1, Math.round((Date.now() - a.startedAt) / 60000));
      api.addTraining(today, {
        id: uid(),
        type: sessionType,
        durationMin,
        avgHr: Math.round(a.sum / a.count),
        maxHr: a.max,
      });
    }
    accum.current = null;
  };

  const zone = bpm != null ? hrZone(bpm, maxHr) : null;

  return (
    <div className="grid">
      <div className="card">
        <p className="section-title">Heart rate monitor</p>

        {!supported && (
          <div className="banner error" style={{ marginBottom: 12 }}>
            Web Bluetooth isn't available in this browser. Use Chrome or Edge
            (desktop or Android) over HTTPS or localhost.
          </div>
        )}
        {error && (
          <div className="banner error" style={{ marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <div
            className="hr-big"
            style={{ color: zone?.color ?? 'var(--text-dim)' }}
          >
            <span className={connected && bpm ? 'hr-pulse' : ''}>
              {bpm ?? '—'}
            </span>
            <span style={{ fontSize: 20, color: 'var(--text-dim)' }}> bpm</span>
          </div>
          {zone && (
            <div style={{ color: zone.color, fontSize: 14, marginTop: 4 }}>
              {zone.name}
            </div>
          )}
          <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
            {connected
              ? `Connected to ${deviceName}`
              : 'Not connected'}
            {battery != null && connected ? ` · battery ${battery}%` : ''}
            {hrv != null ? ` · HRV ${Math.round(hrv)} ms` : ''}
          </div>
        </div>

        <div className="row" style={{ justifyContent: 'center' }}>
          {!connected ? (
            <button className="btn btn-primary" onClick={connect} disabled={!supported}>
              Connect Bluetooth device
            </button>
          ) : (
            <button className="btn btn-danger" onClick={disconnect}>
              Disconnect
            </button>
          )}
        </div>
      </div>

      {connected && (
        <>
          <div className="card">
            <p className="section-title">Morning reading → recovery</p>
            <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
              Sit still for ~2 minutes, then save your resting HR and HRV. The
              engine uses these against your baseline to score recovery.
            </p>
            <button className="btn" onClick={saveRecovery} disabled={bpm == null}>
              Save resting HR{hrv != null ? ' + HRV' : ''} to today
            </button>
          </div>

          <div className="card">
            <p className="section-title">Record a training session</p>
            <div className="row" style={{ marginBottom: 12 }}>
              <div className="field" style={{ maxWidth: 180 }}>
                <label>Type</label>
                <select
                  value={sessionType}
                  onChange={(e) =>
                    setSessionType(e.target.value as TrainingType)
                  }
                  disabled={recording}
                >
                  <option value="strength">Strength</option>
                  <option value="cardio">Cardio</option>
                  <option value="hiit">HIIT</option>
                  <option value="endurance">Endurance</option>
                  <option value="sport">Sport</option>
                  <option value="mobility">Mobility</option>
                </select>
              </div>
            </div>
            {recording ? (
              <div className="row">
                <div className="hr-big" style={{ fontSize: 32 }}>
                  {Math.floor(elapsed / 60)}:
                  {String(elapsed % 60).padStart(2, '0')}
                </div>
                <button className="btn btn-danger" onClick={stopSession}>
                  Stop & save session
                </button>
              </div>
            ) : (
              <button className="btn btn-primary" onClick={startSession}>
                Start recording (live HR)
              </button>
            )}
          </div>
        </>
      )}

      <div className="card">
        <p className="section-title">Compatibility</p>
        <p className="muted" style={{ fontSize: 13, margin: 0, lineHeight: 1.5 }}>
          Works with any Bluetooth Low Energy device exposing the standard Heart
          Rate Service — Polar, Garmin, Wahoo and CooSpo straps, many smart
          watches, armbands and rings. When the device reports RR-intervals,
          Whoop-Alt computes live HRV (rMSSD) for recovery scoring.
        </p>
      </div>
    </div>
  );
}
