import type { StarHistoryPoint } from '@/lib/history';

interface Props {
  data: StarHistoryPoint[];
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Tiny inline SVG line chart of star history — no charting library. Renders
 * nothing when fewer than 2 points are available (a single point can't draw
 * a line, and callers already gate on length >= 2 before mounting this, but
 * we guard again here so it's safe to use standalone too).
 */
export default function Sparkline({ data, width = 96, height = 28, className }: Props) {
  if (!data || data.length < 2) return null;

  const stars = data.map((d) => d.stars);
  const min = Math.min(...stars);
  const max = Math.max(...stars);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data
    .map((d, i) => {
      const x = i * stepX;
      const y = height - ((d.stars - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const first = data[0];
  const last = data[data.length - 1];
  const title = `${first.date} → ${last.date}: ${first.stars.toLocaleString()}★ → ${last.stars.toLocaleString()}★`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <polyline
        points={points}
        fill="none"
        stroke="#3ecfc5"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
    </svg>
  );
}
