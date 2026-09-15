/** Mirrors the CHECK constraint on intelligence_records.domain (see database/schema + migrations). */
export const DOMAINS = [
  'MILITARY', 'MARITIME', 'AVIATION', 'CYBER', 'FINANCIAL',
  'POLITICAL', 'NATURAL', 'INFRASTRUCTURE', 'PERSONNEL', 'INVESTIGATIVE', 'UNKNOWN',
] as const;

export type Domain = (typeof DOMAINS)[number];
