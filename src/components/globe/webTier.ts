/** Semantic zoom for the web layer on the globe: tier 0 = far … 2 = near. */
export type WebTier = 0 | 1 | 2;
export const TIER_RULES: Record<WebTier, { minEvents: number; minVerified: number; labels: number; orgActivity: number }> = {
  0: { minEvents: 20, minVerified: 3, labels: 18, orgActivity: 20 },   // far: only well-attested pairs
  1: { minEvents: 5, minVerified: 2, labels: 100, orgActivity: 5 },
  2: { minEvents: 1, minVerified: 1, labels: 400, orgActivity: 1 },
};
export function tierForHeight(metres: number): WebTier {
  return metres > 8_000_000 ? 0 : metres > 2_000_000 ? 1 : 2;
}


/** Arc entities carry their pair in the entity id: "web_link:<a>|<b>" (or web_link2 for the thin second stroke). */
export function webLinkFromEntityId(id: string): [string, string] | null {
  const m = /^web_link2?:([^|]+)\|(.+)$/.exec(id);
  return m ? [m[1], m[2]] : null;
}
