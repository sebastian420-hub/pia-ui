/** Zulu (UTC) time formatting used everywhere in the UI. */
const pad = (n: number) => String(n).padStart(2, '0');

export function zuluTime(d: Date = new Date()): string {
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`;
}

export function zuluShort(iso?: string | null): string {
  if (!iso) return '--:--Z';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--Z';
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}Z`;
}

export function zuluDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}Z`;
}

export function ago(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

export function countdown(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return '00:00';
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
  return `${pad(m)}:${pad(s)}`;
}
