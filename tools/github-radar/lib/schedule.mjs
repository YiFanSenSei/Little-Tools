export const ZONE = 'Asia/Shanghai';
// All schedule arithmetic uses a fixed UTC+8 offset; it does not depend on the host timezone.
export function nextWeekly(after = new Date()) {
  const local = new Date(after.getTime() + 8 * 3600_000);
  const day = local.getUTCDay();
  const candidate = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + (8 - day) % 7, 9) - 8 * 3600_000);
  if (candidate <= after) candidate.setUTCDate(candidate.getUTCDate() + 7);
  return candidate.toISOString();
}
export function lastWeekly(now = new Date()) { return new Date(new Date(nextWeekly(now)).getTime() - 7 * 86400_000).toISOString(); }
