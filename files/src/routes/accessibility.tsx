import { createFileRoute, Link } from "@tanstack/react-router";
import { LEGAL_VERSION_LABEL } from "@/lib/legal";

export const Route = createFileRoute("/accessibility")({
  head: () => ({
    meta: [
      { title: "Accessibility Statement — LaunchPad EIC" },
      {
        name: "description",
        content:
          "How LaunchPad EIC measures up against WCAG 2.1 Level AA, what we know is not yet conformant, and how to report a barrier.",
      },
      { property: "og:title", content: "Accessibility Statement — LaunchPad EIC" },
      {
        property: "og:description",
        content:
          "Our WCAG 2.1 AA conformance status, known gaps, remediation plan, and how to report a barrier.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccessibilityPage,
});

// TODO: this page currently states "partially conformant" honestly. Update the
// status and the known-issues list as items are fixed and verified with a real
// automated scan plus assistive-technology testing. An accessibility statement
// that overstates conformance is worse than one that does not exist — it is a
// representation a public institution will rely on.
const ENTITY = "Marina Samuel, a sole proprietor doing business as LaunchPad EIC";

function AccessibilityPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-10 pb-24">
        <Link to="/" className="text-sm text-primary hover:underline">
          ← Back to LaunchPad EIC
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Accessibility Statement</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Last reviewed: {LEGAL_VERSION_LABEL}
        </p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground/90">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Our commitment</h2>
            <p>
              {ENTITY} is working to make LaunchPad EIC usable by everyone, including people who
              navigate with a keyboard, a screen reader, magnification, or voice control. We treat
              accessibility as part of building the product, not as a step at the end.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Standard we measure against</h2>
            <p>
              <strong>Web Content Accessibility Guidelines (WCAG) 2.1, Level AA</strong> — the
              standard set by the US Department of Justice for Title II entities and the one most
              institutions require of their vendors. We also track Section 508 (which incorporates
              WCAG by reference) and the Level AA criteria added in WCAG 2.2.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Current status</h2>
            <p>
              <strong>Partially conformant.</strong> Most of the app meets WCAG 2.1 Level AA. Some
              parts do not yet, and they are listed below rather than left for you to discover.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">What we have verified</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Text contrast is above the 4.5:1 minimum throughout — body text measures 16.6:1,
                secondary text 5.7:1, links 6.4:1, and primary buttons 6.7:1.
              </li>
              <li>
                Control borders meet the 3:1 non-text contrast minimum in both light and dark
                appearance.
              </li>
              <li>Every form field has a real label and the correct autocomplete behaviour.</li>
              <li>
                Form errors appear next to the field that caused them and are announced, rather than
                only in a notification that disappears.
              </li>
              <li>A "Skip to main content" link is the first thing keyboard focus reaches.</li>
              <li>Keyboard focus is always visible, with a clear outline on every control.</li>
              <li>The active navigation tab is conveyed to assistive technology, not by colour alone.</li>
              <li>Page changes are announced to screen readers when you move between tabs.</li>
              <li>The page can be zoomed and pinch-zoom is not blocked.</li>
              <li>Animation is reduced automatically if your device asks for reduced motion.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Known issues we are still working on</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Video captions.</strong> Episodes are hosted on YouTube and caption coverage
                is not yet complete across the back catalogue. We are adding captions and
                transcripts to every episode.
              </li>
              <li>
                <strong>Assistive-technology testing.</strong> Our review so far is based on code
                inspection and measured colour values. A full screen-reader and keyboard-only pass
                across every screen is scheduled, and this page will be updated with what it finds.
              </li>
              <li>
                <strong>Reflow and text spacing.</strong> Layout at 400% zoom and with custom text
                spacing has not yet been formally verified.
              </li>
              <li>
                <strong>Finding content.</strong> Bottom navigation is currently the only way to
                reach each section; there is no search.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Third-party content</h2>
            <p>
              The Watch tab embeds videos from YouTube. The player is controlled by YouTube, and its
              accessibility is theirs rather than ours. If the embedded player is a barrier for you,
              every episode is also available directly on our YouTube channel, where you can use
              YouTube's own accessibility settings.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Tell us about a barrier</h2>
            <p>
              If something in LaunchPad EIC stops you completing a task, email{" "}
              <a
                className="text-primary hover:underline"
                href="mailto:accessibility@launchpadeic.com"
              >
                accessibility@launchpadeic.com
              </a>
              . Tell us the page, what you were trying to do, and what happened — and your device,
              browser, and assistive technology if you know them.
            </p>
            <p>
              We aim to acknowledge within 2 business days. Where a barrier prevents you from
              completing an essential task, we aim to fix it or provide another way to do the same
              thing within 10 business days.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">For institutions</h2>
            <p>
              A detailed Accessibility Conformance Report in VPAT format, covering each WCAG 2.1
              success criterion with our conformance level and remarks, is available from{" "}
              <a
                className="text-primary hover:underline"
                href="mailto:accessibility@launchpadeic.com"
              >
                accessibility@launchpadeic.com
              </a>
              , along with our remediation schedule.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Related</h2>
            <p className="text-muted-foreground">
              <Link to="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>{" "}
              ·{" "}
              <Link to="/terms" className="text-primary hover:underline">
                Terms of Service
              </Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
