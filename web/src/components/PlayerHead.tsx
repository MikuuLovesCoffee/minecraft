/** A player's face (with hat layer) cut straight out of their 64x64 skin with CSS — no canvas needed. */
export function PlayerHead({ name, size = 32, className = '' }: { name: string; size?: number; className?: string }) {
  const url = `/api/skins/${encodeURIComponent(name)}`;
  // Face is at (8,8) and the hat overlay at (40,8) on the skin, each 8x8 skin pixels.
  const layer = (x: number) => ({
    backgroundImage: `url(${url})`,
    backgroundSize: `${size * 8}px ${size * 8}px`,
    backgroundPosition: `-${size * x}px -${size}px`,
  });
  return (
    <span
      className={`pixelated relative inline-block shrink-0 overflow-hidden rounded-sm bg-panel ${className}`}
      style={{ width: size, height: size, ...layer(1) }}
      role="img"
      aria-label={name}
    >
      <span className="pixelated absolute inset-0" style={layer(5)} />
    </span>
  );
}
