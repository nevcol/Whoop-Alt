// Web Bluetooth heart-rate monitor.
//
// Works with virtually any BLE device that exposes the standard Heart Rate
// Service (UUID 0x180D) — chest straps (Polar, Garmin, Wahoo), armbands,
// many smartwatches and rings. When the device reports RR-intervals we also
// compute live HRV (rMSSD), the same signal Whoop uses for recovery.

const HEART_RATE_SERVICE = 'heart_rate';
const HEART_RATE_MEASUREMENT = 0x2a37;
const BATTERY_SERVICE = 'battery_service';
const BATTERY_LEVEL = 0x2a19;

export interface HeartRateSample {
  bpm: number;
  /** RR intervals in milliseconds reported with this notification (if any). */
  rrIntervals: number[];
  /** rMSSD computed over the recent RR window, in ms (null until enough data). */
  hrv: number | null;
  timestamp: number;
}

export interface MonitorCallbacks {
  onSample?: (sample: HeartRateSample) => void;
  onConnected?: (deviceName: string) => void;
  onDisconnected?: () => void;
  onBattery?: (pct: number) => void;
  onError?: (message: string) => void;
}

export function isBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

/**
 * Parse the Heart Rate Measurement characteristic per the BLE spec.
 * Flags byte: bit0 = 16-bit value, bit4 = RR intervals present.
 */
function parseHeartRate(value: DataView): { bpm: number; rr: number[] } {
  const flags = value.getUint8(0);
  const is16bit = (flags & 0x01) !== 0;
  const hasRR = (flags & 0x10) !== 0;

  let index = 1;
  let bpm: number;
  if (is16bit) {
    bpm = value.getUint16(index, true);
    index += 2;
  } else {
    bpm = value.getUint8(index);
    index += 1;
  }

  // Skip energy-expended field if present (bit3).
  if ((flags & 0x08) !== 0) index += 2;

  const rr: number[] = [];
  if (hasRR) {
    for (; index + 1 < value.byteLength; index += 2) {
      // RR is reported in units of 1/1024 second.
      const raw = value.getUint16(index, true);
      rr.push((raw / 1024) * 1000);
    }
  }
  return { bpm, rr };
}

/** rMSSD: root mean square of successive RR-interval differences. */
export function computeRmssd(rr: number[]): number | null {
  if (rr.length < 2) return null;
  let sumSq = 0;
  for (let i = 1; i < rr.length; i++) {
    const diff = rr[i] - rr[i - 1];
    sumSq += diff * diff;
  }
  return Math.sqrt(sumSq / (rr.length - 1));
}

export class HeartRateMonitor {
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private rrWindow: number[] = [];
  private readonly rrWindowMax = 120; // ~last 2 minutes of beats
  private cb: MonitorCallbacks;

  constructor(callbacks: MonitorCallbacks = {}) {
    this.cb = callbacks;
  }

  get connected(): boolean {
    return !!this.device?.gatt?.connected;
  }

  get deviceName(): string | null {
    return this.device?.name ?? null;
  }

  /** Prompt the user to pick any nearby BLE device and connect. */
  async connect(): Promise<void> {
    if (!isBluetoothSupported()) {
      this.cb.onError?.(
        'Web Bluetooth is not available. Use Chrome, Edge or another ' +
          'Chromium browser over HTTPS (or localhost).',
      );
      return;
    }

    try {
      // acceptAllDevices lets the user pick ANY bluetooth device; we then
      // try to use its Heart Rate Service.
      this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [HEART_RATE_SERVICE, BATTERY_SERVICE],
      });

      this.device.addEventListener('gattserverdisconnected', () => {
        this.cb.onDisconnected?.();
      });

      const server = await this.device.gatt!.connect();

      const service = await server.getPrimaryService(HEART_RATE_SERVICE);
      this.characteristic = await service.getCharacteristic(
        HEART_RATE_MEASUREMENT,
      );
      await this.characteristic.startNotifications();
      this.characteristic.addEventListener(
        'characteristicvaluechanged',
        this.handleNotification,
      );

      this.cb.onConnected?.(this.device.name ?? 'Heart rate monitor');
      void this.readBattery(server);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/not found|No Services/i.test(msg)) {
        this.cb.onError?.(
          'That device does not expose a standard Heart Rate Service. ' +
            'Pick a heart-rate strap, watch or band.',
        );
      } else if (!/cancelled|User cancelled/i.test(msg)) {
        this.cb.onError?.(msg);
      }
    }
  }

  private async readBattery(server: BluetoothRemoteGATTServer): Promise<void> {
    try {
      const svc = await server.getPrimaryService(BATTERY_SERVICE);
      const ch = await svc.getCharacteristic(BATTERY_LEVEL);
      const v = await ch.readValue();
      this.cb.onBattery?.(v.getUint8(0));
    } catch {
      // Battery service is optional; ignore if missing.
    }
  }

  private handleNotification = (event: Event): void => {
    const ch = event.target as BluetoothRemoteGATTCharacteristic;
    if (!ch.value) return;
    const { bpm, rr } = parseHeartRate(ch.value);

    if (rr.length) {
      this.rrWindow.push(...rr);
      if (this.rrWindow.length > this.rrWindowMax) {
        this.rrWindow = this.rrWindow.slice(-this.rrWindowMax);
      }
    }

    this.cb.onSample?.({
      bpm,
      rrIntervals: rr,
      hrv: computeRmssd(this.rrWindow),
      timestamp: Date.now(),
    });
  };

  async disconnect(): Promise<void> {
    try {
      if (this.characteristic) {
        this.characteristic.removeEventListener(
          'characteristicvaluechanged',
          this.handleNotification,
        );
        await this.characteristic.stopNotifications().catch(() => {});
      }
      this.device?.gatt?.disconnect();
    } finally {
      this.characteristic = null;
      this.rrWindow = [];
    }
  }
}
