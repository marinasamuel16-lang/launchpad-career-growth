/**
 * Single source of truth for the version of the Terms of Service and Privacy
 * Policy currently published.
 *
 * The signup flow stores this string against the user's profile, and the legal
 * pages display it. Keeping both from one constant means the version a user is
 * recorded as accepting can never drift from the version they were shown —
 * which is the whole point of keeping a consent record.
 *
 * Bump this whenever either document changes materially. Anyone whose recorded
 * version doesn't match is asked to agree again by <ConsentGate /> the next
 * time they open the app.
 */
export const LEGAL_VERSION = "2026-11-05";

/** Human-readable form of LEGAL_VERSION, for display on the legal pages. */
export const LEGAL_VERSION_LABEL = "November 5, 2026";
