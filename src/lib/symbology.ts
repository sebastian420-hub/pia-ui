/**
 * One place for meaning → colour. NORMAL is neutral on purpose: colour is reserved
 * for things that need attention (HIGH amber, CRITICAL red).
 */
export const PRIORITY_HEX: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f59e0b',
  NORMAL: '#9aa3ad',
  LOW: '#6b7280',
};

export const CAMERA_HEX = { online: '#38bdf8', unknown: '#7dd3fc', offline: '#475569' };

export function priorityHex(priority?: string): string {
  return PRIORITY_HEX[(priority || '').toUpperCase()] ?? PRIORITY_HEX.NORMAL;
}

/** Tailwind classes for text-only priority labels. */
export function priorityText(priority?: string): string {
  switch ((priority || '').toUpperCase()) {
    case 'CRITICAL': return 'text-prio-critical';
    case 'HIGH': return 'text-prio-high';
    default: return 'text-text-2';
  }
}

export const DOMAIN_ABBR: Record<string, string> = {
  MILITARY: 'MIL', MARITIME: 'MAR', AVIATION: 'AVN', CYBER: 'CYB', FINANCIAL: 'FIN',
  POLITICAL: 'POL', NATURAL: 'NAT', INFRASTRUCTURE: 'INF', PERSONNEL: 'PER', INVESTIGATIVE: 'INV', UNKNOWN: 'UNK',
};

export const KIND_HEX: Record<string, string> = {
  PERSON: '#60a5fa', ORG: '#f59e0b', COUNTRY: '#a78bfa', PLACE: '#34d399',
  VESSEL: '#f87171', AIRCRAFT: '#fb7185', EVENT: '#e879f9', UNKNOWN: '#6b7280',
};
export const RELATION_HEX: Record<string, string> = {
  HOSTILE: '#ef4444', COOPERATIVE: '#22c55e', ROLE: '#60a5fa', OWNERSHIP: '#f59e0b',
  MEMBERSHIP: '#a78bfa', LOCATED: '#34d399', MENTIONED_WITH: '#4b5563',
};
export function toneHex(tone: number | null | undefined): string {
  if (tone == null) return '#9aa3ad';
  if (tone <= -5) return '#ef4444';
  if (tone < 0) return '#f59e0b';
  if (tone >= 3) return '#22c55e';
  return '#9aa3ad';
}
