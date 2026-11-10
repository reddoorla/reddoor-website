// At most LEAD_LIMIT Leads per client per LEAD_WINDOW_MS, where a client is an
// IPv4 address or an IPv6 /64 (see limitKey). In memory, per function instance.
// A Netlify instance is reused while warm and runs one request at a time, so
// this bounds a run of sequential posts that reuse a warm instance, not a
// parallel burst, which can land on fresh instances with empty maps. The real
// fix is reddoorla/reddoor-maintenance#2027 (ingest returns its verdict).
export const LEAD_LIMIT = 3;
export const LEAD_WINDOW_MS = 10 * 60 * 1000;
const MAX_TRACKED = 10_000;
const hits = new Map<string, number[]>();

const HEX_GROUP = /^[0-9a-f]{1,4}$/i;

/** The eight 16-bit groups of an IPv6 address, expanded and lower-cased; null if malformed. */
function expandIPv6(addr: string): string[] | null {
  const halves = addr.split("::");
  if (halves.length > 2) return null;
  const parts = (s: string) => (s === "" ? [] : s.split(":"));
  const head = parts(halves[0]);
  let groups: string[];
  if (halves.length === 2) {
    // "::" stands for one or more zero groups, so at most seven explicit ones.
    const zeros = 8 - head.length - parts(halves[1]).length;
    if (zeros < 1) return null;
    groups = [...head, ...Array<string>(zeros).fill("0"), ...parts(halves[1])];
  } else {
    groups = head;
  }
  if (groups.length !== 8 || !groups.every((g) => HEX_GROUP.test(g))) return null;
  return groups.map((g) => parseInt(g, 16).toString(16));
}

/**
 * The key a client's Leads are counted under. An IPv6 client holds a whole /64
 * (it can send each post from a fresh address in it), so every address in one
 * /64 shares a key. An IPv4 address, or an IPv4-mapped IPv6 one in its dotted
 * form (`::ffff:1.2.3.4`, which is how Node and Netlify print it), is its own key.
 * Anything unparseable is returned unchanged, and this never throws.
 */
export function limitKey(ip: string): string {
  const bare = ip.split("%")[0];
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(bare);
  if (mapped) return mapped[1];
  if (!bare.includes(":")) return ip;
  const groups = expandIPv6(bare);
  if (!groups) return ip;
  return `${groups.slice(0, 4).join(":")}::/64`;
}

/** True, and counts the Lead, when this client is under the limit; false otherwise. */
export function takeLeadSlot(ip: string, now = Date.now()): boolean {
  const key = limitKey(ip);
  const cutoff = now - LEAD_WINDOW_MS;
  const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);
  if (recent.length >= LEAD_LIMIT) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
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
