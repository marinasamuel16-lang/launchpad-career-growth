# Accessibility Conformance Report — LaunchPad EIC

**Based on VPAT® Version 2.5 Rev · WCAG 2.1 edition**

**Name of product:** LaunchPad EIC (web application / PWA)
**Version:** commit `a4eea16` · evaluated 11 September 2026
**Report date:** 11 September 2026
**Contact:** accessibility@launchpadeic.com
**Vendor:** Marina Samuel, sole proprietor t/a LaunchPad EIC — New Jersey

---

## ⚠️ Read this before sending it to anyone

**This is a draft, not a signed conformance report.** It is based on source-code
review and on contrast ratios computed directly from the application's design
tokens. It is **not** based on a scan of the running application or on assistive-
technology testing, because the deployed app was not reachable from the
evaluation environment.

An ACR is a representation you make in a procurement. An inaccurate one is worse
than none — under ADA Title II it is the document a university will point to if a
student files a complaint. Before this goes to anyone:

1. Apply the remediations in `CODE-CHANGES.md`.
2. Run **axe DevTools** or **WAVE** (both free) over every screen, signed in.
3. Do a **keyboard-only pass** — unplug the mouse, tab through every flow.
4. Test with **one screen reader** — VoiceOver on macOS/iOS is free and is what
   most of your users on iPhone will have.
5. Correct every row below to match what you actually find, then date and sign it.

---

## Evaluation methods

| | |
|---|---|
| **Method** | Static source review of all routes, components, and design tokens; programmatic computation of WCAG 1.4.3 / 1.4.11 contrast ratios from the app's oklch colour tokens |
| **Not yet performed** | Automated DOM scan of the running app; screen-reader testing; keyboard-only walkthrough; zoom/reflow testing at 320 CSS px and 400% |
| **Scope** | Sign-in, Privacy, Terms, Home feed, Watch, Coach, Profile/Roadmap, Onboarding, Admin |
| **Standard** | WCAG 2.1 Level AA (the standard set by DOJ's ADA Title II rule) |

**Conformance terms** — *Supports*: meets the criterion. *Partially Supports*:
some functionality does not meet it. *Does Not Support*: the majority does not
meet it. *Not Applicable*: the criterion does not apply.

---

## Summary of what was found

**Strengths.** The colour palette is, with two exceptions, well above minimum —
body text at 16.6:1, secondary text at 5.73:1, links at 6.42:1, primary buttons at
6.65:1. Forms use real `<label for>` associations and correct `autocomplete`
tokens. The document declares `lang="en"`. Images carry alt text. The viewport
meta permits pinch-zoom. None of that is typical for an app built this quickly,
and it means remediation is small.

**The two measured failures.**

| Criterion | What fails | Measured | Required |
|---|---|---|---|
| **1.4.11 Non-text Contrast** | `--input` border against page background | **1.27:1** | 3:1 |
| **1.4.11 Non-text Contrast** | `--input` border against white card | **1.36:1** | 3:1 |
| **1.4.3 Contrast (Minimum)** | White label on destructive button | **4.31:1** | 4.5:1 |

The first is systemic: it is the visible boundary of every text input in the
product, including the two fields on the sign-in screen. A reviewer hits it on
screen one.

**The four structural gaps.**

- No `<main>` landmark anywhere in the route tree (1.3.1).
- No "skip to main content" link (2.4.1) — keyboard users traverse the header and
  bottom nav on every navigation.
- Active bottom-nav tab is conveyed by colour and a gradient pill only, with no
  `aria-current` (1.3.1, 1.4.1).
- Form validation errors are delivered only as a transient toast, never
  programmatically associated with the field that caused them (3.3.1).

All six items are addressed in `CODE-CHANGES.md` and are roughly one day of work.

---

## Table 1 — WCAG 2.1 Level A

| Criterion | Level | Conformance | Remarks |
|---|---|---|---|
| 1.1.1 Non-text Content | A | **Partially Supports** | Logo has alt text. Decorative inline SVGs (Google mark, nav icons) are not `aria-hidden`, so they are announced as unlabeled graphics. Fixed in remediation. |
| 1.2.1 Audio-only / Video-only | A | Not Applicable | Video is hosted on YouTube and played there. |
| 1.2.2 Captions (Prerecorded) | A | **Partially Supports** | Episodes are YouTube-hosted. Captions depend on the channel. **Action: enable captions on every LaunchPad EIC episode** — a public university will check this, and auto-captions alone are usually judged insufficient. |
| 1.2.3 Audio Description or Media Alternative | A | **Partially Supports** | Same as above. Provide episode transcripts. |
| 1.3.1 Info and Relationships | A | **Partially Supports** | Labels and headings are correct. Missing `<main>`; nav list is a `<div>` of links rather than a list; no `aria-current`. Fixed in remediation. |
| 1.3.2 Meaningful Sequence | A | Supports | DOM order matches visual order. |
| 1.3.3 Sensory Characteristics | A | Supports | No instruction relies on shape, position, or colour alone. |
| 1.4.1 Use of Colour | A | **Partially Supports** | Active nav state is colour + gradient only. Fixed by `aria-current` plus the label weight change. |
| 1.4.2 Audio Control | A | Not Applicable | Nothing auto-plays. |
| 2.1.1 Keyboard | A | Supports | All controls are native elements or Radix primitives, which are keyboard-operable. Confirm in manual testing. |
| 2.1.2 No Keyboard Trap | A | Supports | Radix dialogs manage focus correctly. Confirm in manual testing. |
| 2.1.4 Character Key Shortcuts | A | Not Applicable | No single-character shortcuts. |
| 2.2.1 Timing Adjustable | A | **Partially Supports** | Sonner toasts carry the only copy of form-validation errors and dismiss on a timer. Resolved by moving errors inline. |
| 2.2.2 Pause, Stop, Hide | A | Supports | No auto-updating content beyond the feed, which is user-initiated. |
| 2.3.1 Three Flashes | A | Supports | No flashing content. |
| 2.4.1 Bypass Blocks | A | **Does Not Support** | No skip link and no landmarks. Fixed in remediation. |
| 2.4.2 Page Titled | A | Supports | Route-level `<title>` on every page. |
| 2.4.3 Focus Order | A | Supports | Follows DOM order. Confirm in manual testing. |
| 2.4.4 Link Purpose (In Context) | A | Supports | Link text is descriptive. |
| 2.5.1 Pointer Gestures | A | Supports | No path-based or multipoint gestures. |
| 2.5.2 Pointer Cancellation | A | Supports | Standard activation behaviour. |
| 2.5.3 Label in Name | A | Supports | Visible labels match accessible names. |
| 2.5.4 Motion Actuation | A | Not Applicable | No motion-actuated functionality. |
| 3.1.1 Language of Page | A | Supports | `<html lang="en">`. |
| 3.2.1 On Focus | A | Supports | No context change on focus. |
| 3.2.2 On Input | A | Supports | No unexpected context change on input. |
| 3.3.1 Error Identification | A | **Does Not Support** | Errors appear only in a toast, are not associated with the field, and disappear on a timer. Fixed in remediation. |
| 3.3.2 Labels or Instructions | A | Supports | Every input has a `<label for>` and an `autocomplete` token. |
| 4.1.2 Name, Role, Value | A | **Partially Supports** | `<nav>` has no accessible name; active state not exposed; decorative SVGs not hidden. Fixed in remediation. |
| 4.1.3 Status Messages | A | **Partially Supports** | Toasts announce, but route changes are not announced. Fixed by the route announcer. |

## Table 2 — WCAG 2.1 Level AA

| Criterion | Level | Conformance | Remarks |
|---|---|---|---|
| 1.2.4 Captions (Live) | AA | Not Applicable | No live media. |
| 1.2.5 Audio Description | AA | **Partially Supports** | Depends on YouTube episodes. See 1.2.3. |
| 1.3.4 Orientation | AA | Supports | Responsive; no orientation lock. |
| 1.3.5 Identify Input Purpose | AA | Supports | Correct `autocomplete` on name, email, and both password fields. |
| 1.4.3 Contrast (Minimum) | AA | **Partially Supports** | All body, muted, link, primary, secondary, and accent text pass (5.73:1 – 17.7:1). White label on `--destructive` measures **4.31:1** against the required 4.5:1. Fixed by changing the token to `oklch(0.55 0.22 27)` → 5.27:1. |
| 1.4.4 Resize Text | AA | Supports | Relative units; viewport permits zoom. Confirm at 200%. |
| 1.4.5 Images of Text | AA | Supports | No images of text other than the logo. |
| 1.4.10 Reflow | AA | **Not Yet Verified** | Layout is mobile-first and looks sound in source, but 320 CSS px / 400% zoom reflow must be verified in a browser before this row is claimed. |
| 1.4.11 Non-text Contrast | AA | **Does Not Support** | Input and control borders measure **1.27:1** vs background and **1.36:1** vs card, against a 3:1 requirement. Affects every form field in the product. Fixed by changing `--input` to `oklch(0.64 0.04 300)` → 3.12:1 / 3.33:1, and dark-mode `--input` to `oklch(0.51 0.03 300)` → 3.39:1 / 3.03:1. |
| 1.4.12 Text Spacing | AA | **Not Yet Verified** | Requires a browser test with the standard text-spacing bookmarklet. |
| 1.4.13 Content on Hover or Focus | AA | Supports | Radix tooltips and popovers are dismissible and hoverable. |
| 2.4.5 Multiple Ways | AA | **Partially Supports** | Bottom navigation is the only route to content; there is no search and no sitemap. Acceptable for a three-tab app, but note it. |
| 2.4.6 Headings and Labels | AA | Supports | Descriptive headings and labels throughout. |
| 2.4.7 Focus Visible | AA | **Partially Supports** | Relies on shadcn defaults, which are inconsistent across the custom `brand-gradient` buttons. Fixed by the global `:focus-visible` rule in remediation. |
| 3.1.2 Language of Parts | AA | Not Applicable | Single language. |
| 3.2.3 Consistent Navigation | AA | Supports | Bottom nav is consistent across routes. |
| 3.2.4 Consistent Identification | AA | Supports | Components are used consistently. |
| 3.3.3 Error Suggestion | AA | **Partially Supports** | Messages are helpful ("Enter a valid email") but are not attached to the field. Resolved with 3.3.1. |
| 3.3.4 Error Prevention (Legal, Financial, Data) | AA | **Partially Supports** | Account deletion is irreversible and cascades across all user data. Confirm it is behind an explicit confirmation dialog that names what will be lost; add one if not. |
| 4.1.1 Parsing | AA | Not Applicable | Obsolete and removed in WCAG 2.2. |

---

## Additional standards a university may ask about

- **Section 508 (Revised, 36 CFR Part 1194)** — incorporates WCAG 2.0 AA by
  reference. Conformance to WCAG 2.1 AA satisfies it. Federal-funding questions
  route here.
- **EN 301 549** — the EU equivalent. Same WCAG core. Relevant only if the
  institution has European operations.
- **WCAG 2.2** — not yet the Title II standard, but 2.5.8 Target Size (Minimum,
  24×24 CSS px) is worth meeting now. The remediation adds `min-h-11` to the
  bottom-nav links, which clears it.

## Remediation commitment

Suggested language for the procurement response:

> We have identified the conformance gaps above through internal review and are
> remediating them on the following schedule. We will provide an updated ACR based
> on automated and manual assistive-technology testing before go-live, and we
> will respond to accessibility defects reported by the institution or its users
> within [X] business days for barriers that prevent task completion.

| Item | Criteria | Effort | Target |
|---|---|---|---|
| Input border and destructive-button contrast tokens | 1.4.11, 1.4.3 | < 1 hour | Immediate |
| Skip link + `<main>` landmark + route announcer | 2.4.1, 1.3.1, 4.1.3 | 2 hours | Immediate |
| Bottom nav semantics and `aria-current` | 1.3.1, 1.4.1, 4.1.2 | 1 hour | Immediate |
| Inline form errors with `aria-invalid` / `aria-describedby` | 3.3.1, 3.3.3 | 3 hours | Immediate |
| Global `:focus-visible` + reduced-motion | 2.4.7, 2.3.3 | 1 hour | Immediate |
| Decorative SVGs hidden from a11y tree | 1.1.1, 4.1.2 | 1 hour | Immediate |
| Captions and transcripts on all episodes | 1.2.2, 1.2.3, 1.2.5 | Ongoing | Before pilot |
| Automated scan + keyboard + VoiceOver testing, ACR reissued | All | 1–2 days | Before pilot |
| Reflow / text-spacing verification | 1.4.10, 1.4.12 | 2 hours | Before pilot |

---

*VPAT® is a registered trademark of the Information Technology Industry Council
(ITI). This report follows the VPAT 2.5 structure; obtain the current official
template from ITI at `itic.org/policy/accessibility/vpat` before issuing a signed
version.*
