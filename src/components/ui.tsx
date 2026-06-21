import type { ReactNode } from 'react';

export function Ring({
  value,
  max = 100,
  size = 96,
  color = 'var(--accent)',
  label,
  display,
}: {
  value: number | null;
  max?: number;
  size?: number;
  color?: string;
  label?: string;
  display?: string;
}) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = value == null ? 0 : Math.max(0, Math.min(1, value / max));
  const dash = c * pct;

  return (
    <div className="ring-wrap">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          fill="var(--text)"
          fontSize={size * 0.24}
          fontWeight={700}
          style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}
        >
          {display ?? (value == null ? '—' : Math.round(value))}
        </text>
      </svg>
      {label && <div className="ring-label">{label}</div>}
    </div>
  );
}

export function Sparkline({
  data,
  width = 280,
  height = 70,
  color = 'var(--accent-2)',
  fill = true,
}: {
  data: (number | null)[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
}) {
  const pts = data
    .map((v, i) => ({ v, i }))
    .filter((p): p is { v: number; i: number } => p.v != null);
  if (pts.length < 2) {
    return (
      <div className="muted" style={{ fontSize: 12, padding: '20px 0' }}>
        Not enough data yet.
      </div>
    );
  }
  const xs = pts.map((p) => p.i);
  const ys = pts.map((p) => p.v);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = 6;
  const sx = (x: number) =>
    pad + ((x - minX) / Math.max(1, maxX - minX)) * (width - pad * 2);
  const sy = (y: number) =>
    height -
    pad -
    ((y - minY) / Math.max(1e-9, maxY - minY)) * (height - pad * 2);

  const line = pts.map((p) => `${sx(p.i)},${sy(p.v)}`).join(' ');
  const area =
    `${sx(pts[0].i)},${height - pad} ` +
    line +
    ` ${sx(pts[pts.length - 1].i)},${height - pad}`;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {fill && (
        <polygon points={area} fill={color} opacity={0.12} />
      )}
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Bar({
  value,
  max,
  color = 'var(--accent)',
}: {
  value: number;
  max: number;
  color?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className="bar-track">
      <div
        className="bar-fill"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

export function Stat({
  value,
  label,
  sub,
}: {
  value: ReactNode;
  label: string;
  sub?: ReactNode;
}) {
  return (
    <div className="stat">
      <div className="value">{value}</div>
      <div className="label">{label}</div>
      {sub && <div className="muted" style={{ fontSize: 12 }}>{sub}</div>}
    </div>
  );
}
