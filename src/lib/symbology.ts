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
