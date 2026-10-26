export function money(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

/** Minecraft ticks (20 per second) to "3h 12m". */
export function playtime(ticks: number): string {
  const minutes = Math.floor(ticks / 20 / 60);
  const h = Math.floor(minutes / 60);
  return h > 0 ? `${h}h ${minutes % 60}m` : `${minutes}m`;
}

export function number(n: number): string {
  return n.toLocaleString('en-US');
}

export function date(iso: string | null, lang: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(lang === 'en' ? 'en-GB' : 'uz-UZ', { dateStyle: 'medium', timeStyle: 'short' });
}
