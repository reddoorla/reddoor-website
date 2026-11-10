// At most LEAD_LIMIT Leads per client IP per LEAD_WINDOW_MS. In memory, per
// function instance: a Netlify function instance is reused while warm and a
// cold start begins empty, so this bounds a burst, not a day. That is enough
// for its job (a forged post pumping Leads); a durable store would be a vendor
// or a database for a measurement guard, which this does not warrant.
export const LEAD_LIMIT = 3;
export const LEAD_WINDOW_MS = 10 * 60 * 1000;
const MAX_TRACKED = 10_000;
const hits = new Map<string, number[]>();

/** True, and counts the Lead, when this IP is under the limit; false otherwise. */
export function takeLeadSlot(ip: string, now = Date.now()): boolean {
  const cutoff = now - LEAD_WINDOW_MS;
  const recent = (hits.get(ip) ?? []).filter((t) => t > cutoff);
  if (recent.length >= LEAD_LIMIT) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > MAX_TRACKED) {
    // Bounded memory: drop every IP whose newest hit is outside the window.
    for (const [key, times] of hits) {
      if (times.every((t) => t <= cutoff)) hits.delete(key);
    }
  }
  return true;
}

/** Tests only. */
export function resetLeadLimit(): void {
  hits.clear();
}
