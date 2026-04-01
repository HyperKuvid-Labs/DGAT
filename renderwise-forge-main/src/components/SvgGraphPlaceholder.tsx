interface SvgGraphPlaceholderProps {
  seed: number;
  width?: number;
  height?: number;
}

export function SvgGraphPlaceholder({ seed, width = 300, height = 172 }: SvgGraphPlaceholderProps) {
  let s = seed * 9301 + 49297;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };

  const N = 14 + Math.floor(rand() * 8);
  const nodes = Array.from({ length: N }, (_, i) => {
    const angle = (i / N) * Math.PI * 2 + rand() * 0.6;
    const r = 44 + rand() * 36;
    return {
      x: width / 2 + Math.cos(angle) * r + (rand() - 0.5) * 18,
      y: height / 2 + Math.sin(angle) * r * 0.6 + (rand() - 0.5) * 14,
      radius: 2.8 + rand() * 2.6,
    };
  });

  const edges: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const targets = [(i + 1) % N, (i + 3) % N, (i + 2 + Math.floor(rand() * 4)) % N];
    targets.forEach(j => { if (i !== j) edges.push([i, j]); });
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width={width} height={height} className="fill-raised" />
      <defs>
        <pattern id={`gd${seed}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="0" cy="0" r="0.7" className="fill-dgat-border2" opacity="0.5" />
          <circle cx="20" cy="0" r="0.7" className="fill-dgat-border2" opacity="0.5" />
          <circle cx="0" cy="20" r="0.7" className="fill-dgat-border2" opacity="0.5" />
          <circle cx="20" cy="20" r="0.7" className="fill-dgat-border2" opacity="0.5" />
        </pattern>
      </defs>
      <rect width={width} height={height} fill={`url(#gd${seed})`} />
      {edges.map(([i, j], idx) => (
        <line
          key={idx}
          x1={nodes[i].x.toFixed(1)}
          y1={nodes[i].y.toFixed(1)}
          x2={nodes[j].x.toFixed(1)}
          y2={nodes[j].y.toFixed(1)}
          className="stroke-dgat-border2"
          strokeWidth="0.8"
          opacity="0.7"
        />
      ))}
      {nodes.map((n, i) => (
        <circle
          key={i}
          cx={n.x.toFixed(1)}
          cy={n.y.toFixed(1)}
          r={n.radius.toFixed(1)}
          className={i === 0 ? "fill-dgat-text" : i < 4 ? "fill-dgat-muted" : "fill-dgat-subtle"}
          style={{
            animation: `node-breathe ${(2.5 + rand() * 1.5).toFixed(1)}s ease-in-out ${(rand() * 1.5).toFixed(2)}s infinite`,
          }}
        />
      ))}
    </svg>
  );
}
