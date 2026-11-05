/**
 * Has this password shown up in a known data breach?
 *
 * Uses Have I Been Pwned's free "range" lookup, which never sees the password:
 * we scramble it (SHA-1) in the browser, send only the first 5 characters of
 * the result, and compare the matches that come back ourselves.
 * (This is the same check Supabase's paid "leaked password protection" runs.)
 *
 * Returns true if breached, false if not, and null if the check couldn't run
 * (offline, service down) — in that case we let the person carry on rather than
 * block them.
 */
export async function isPasswordBreached(password: string): Promise<boolean | null> {
  try {
    const bytes = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest("SHA-1", bytes);
    const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
    const prefix = hex.slice(0, 5);
    const suffix = hex.slice(5);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5_000);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      // Padding hides how many matches came back.
      headers: { "Add-Padding": "true" },
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timer));
    if (!res.ok) return null;

    const body = await res.text();
    for (const line of body.split("\n")) {
      const [s, count] = line.trim().split(":");
      if (s === suffix && Number(count) > 0) return true;
    }
    return false;
  } catch {
    return null;
  }
}

export const BREACHED_PASSWORD_MESSAGE =
  "This password has appeared in a data breach on another site, so it's easy for hackers to guess. Please choose a different one.";
