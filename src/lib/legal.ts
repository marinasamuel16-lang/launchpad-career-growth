/**
 * Single source of truth for the version of the Terms of Service and Privacy
 * Policy currently published.
 *
 * The signup flow stores this string against the user's profile, and the legal
 * pages display it. Keeping both from one constant means the version a user is
 * recorded as accepting can never drift from the version they were shown —
 * which is the whole point of keeping a consent record.
 *
 * Bump this whenever either document changes materially, and consider
 * re-prompting existing users when you do.
 */
export const LEGAL_VERSION = "2026-09-11";

/** Human-readable form of LEGAL_VERSION, for display on the legal pages. */
export const LEGAL_VERSION_LABEL = "September 11, 2026";
