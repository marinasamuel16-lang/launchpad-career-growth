import { createFileRoute, Link } from "@tanstack/react-router";
import { LEGAL_VERSION, LEGAL_VERSION_LABEL } from "@/lib/legal";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — LaunchPad EIC" },
      {
        name: "description",
        content:
          "Plain-language terms for using LaunchPad EIC: AI Coach is informational only, no guaranteed outcomes, acceptable use, and how accounts can be terminated.",
      },
      { property: "og:title", content: "Terms of Service — LaunchPad EIC" },
      {
        property: "og:description",
        content:
          "Plain-language terms for using LaunchPad EIC, including AI Coach limitations and liability terms.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

// TODO before this is the published agreement: fill in [MAILING ADDRESS].
// Note: the app no longer hosts user-generated content (the community feed was
// removed), so no DMCA designated agent is required.
const ENTITY = "Marina Samuel, a sole proprietor doing business as LaunchPad EIC";
const ENTITY_ADDRESS = "[MAILING ADDRESS]";
const VENUE_COUNTY = "Essex";

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-10 pb-24">
        <Link to="/" className="text-sm text-primary hover:underline">
          ← Back to LaunchPad EIC
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Terms of Service</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Version {LEGAL_VERSION} · Last updated: {LEGAL_VERSION_LABEL}
        </p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground/90">
          <p>
            These Terms are between you and <strong>{ENTITY}</strong>, at {ENTITY_ADDRESS} ("we,"
            "us"). By creating an account or using LaunchPad EIC (the "Service"), you agree to them.
          </p>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">1. The short version</h2>
            <p>
              LaunchPad EIC is a career growth app for people roughly 1–10 years into their careers.
              You get an AI Coach, a career roadmap, video episodes, and a community feed. It's a
              tool to help you think — it is not a professional advisor, and it can't promise you a
              job, a raise, or a promotion.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">2. The AI Coach is informational only</h2>
            <p>
              LaunchPad Coach is an AI assistant. It is <strong>not</strong> a career counselor,
              therapist, mental health professional, financial advisor, accountant, physician, or
              attorney, and using it does not create any professional relationship.
            </p>
            <p>
              Everything the AI Coach, the roadmap generator, and the rest of the Service produce is
              general information for your consideration. AI can be confidently wrong, out of date,
              or missing context about your situation. For anything that matters — legal questions,
              money decisions, health or mental health concerns, employment disputes, immigration or
              visa issues, contracts — talk to a qualified professional who knows your specific
              situation.
            </p>
            <p>
              <strong>
                The Service is not for clinical, diagnostic, or treatment purposes and must not be
                used as part of any healthcare service.
              </strong>{" "}
              It does not collect, and is not designed to receive, protected health information.
            </p>
            <p>
              If you are in crisis or experiencing a medical or mental health emergency, contact
              your local emergency services, or in the US call or text <strong>988</strong> for the
              Suicide &amp; Crisis Lifeline. Do not use this app for that.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">3. No guaranteed outcomes</h2>
            <p>
              We don't promise results. Completing milestones, earning XP, following action steps,
              or chatting with the AI Coach does not guarantee a job offer, an interview, a
              promotion, a raise, or any other career outcome. Your results depend on you, your
              employer, your market, and plenty of things none of us control.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">4. What you create is yours</h2>
            <p>
              Your roadmap, your milestones and tasks, your weekly action steps, and your
              conversations with the AI Coach belong to you. They are private to your account — no
              other user of LaunchPad EIC can see them. We store them so the app works and so your
              history is there when you come back, and we delete them when you delete your account.
            </p>
            <p>
              We do not publish your content, show it to other users, or use it to train AI models.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">5. Acceptable use</h2>
            <p>
              Use the app for your own career development. Don't share your account with other
              people, don't scrape, reverse engineer, probe, or overload the Service, don't try to
              access accounts or data that aren't yours, and don't use the AI Coach to generate
              unlawful, harassing, or deliberately deceptive material. Don't use the Service to
              build a competing product.
            </p>
            <p>
              If something in the app concerns you — an AI response that seems harmful, a bug that
              exposes something it shouldn't — tell us at{" "}
              <a className="text-primary hover:underline" href="mailto:safety@launchpadeic.com">
                safety@launchpadeic.com
              </a>
              .
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">6. Copyright</h2>
            <p>
              LaunchPad EIC does not host content posted by users. The episodes, written material,
              and app itself are ours or licensed to us. If you believe something in the Service
              infringes your copyright, email{" "}
              <a className="text-primary hover:underline" href="mailto:support@launchpadeic.com">
                support@launchpadeic.com
              </a>{" "}
              with enough detail to identify the work and where it appears, and we will look into it
              promptly.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">7. Your account</h2>
            <p>
              You need to be at least 16 years old to use LaunchPad EIC. Keep your login details
              secure — you're responsible for activity under your account. Tell us promptly if you
              think someone else has access. Give us accurate information when you sign up.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">8. Paid features</h2>
            <p>
              Some AI features may be offered as a paid subscription. Pricing, billing terms, and
              renewal details are shown at the point of purchase and billed through our payment
              processor. Subscriptions renew automatically until cancelled; you can cancel any time
              and keep access until the end of the period you've paid for. Fees already paid are
              non-refundable except where the law requires otherwise or where we have failed to
              provide the Service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">9. Termination and misuse</h2>
            <p>
              You can stop using the app and delete your account at any time from Profile →
              Settings. We may suspend or terminate your account, remove content, or limit features
              if you break these terms, misuse the app, abuse other users, or use the app in a way
              that creates legal risk for us or others. Where it's reasonable to do so we'll tell you
              why and give you a chance to respond. Sections 4, 10, 11, 12 and 16–18 survive
              termination.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">10. Service provided "as is"</h2>
            <p>
              LaunchPad EIC is provided "as is" and "as available," without warranties of any kind,
              express or implied, including any implied warranties of merchantability, fitness for a
              particular purpose, accuracy, or non-infringement, to the maximum extent permitted by
              law. We don't promise the app will always be available, error-free, or that content or
              AI output will be accurate or complete.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">11. Limitation of liability</h2>
            <p>
              To the maximum extent permitted by law, LaunchPad EIC and the people who work on it
              are not liable for any indirect, incidental, special, consequential, exemplary, or
              punitive damages, or for any lost profits, lost wages, lost job or business
              opportunities, lost data, or reputational harm, arising out of or related to your use
              of the app — including decisions you make based on AI Coach output, roadmap content,
              or anything another user posts.
            </p>
            <p>
              For individual consumer users, our total liability for any claim relating to the app
              is limited to the greater of (a) the amount you paid us in the 12 months before the
              claim, or (b) USD $100. For institutional customers, liability is governed by the
              written agreement between us and the institution, not by this section. Nothing here
              limits liability for gross negligence, wilful misconduct, fraud, or anything else that
              cannot be limited by law. Some jurisdictions don't allow certain limitations, so parts
              of this section may not apply to you.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">12. Indemnity</h2>
            <p>
              You agree to cover us for claims, losses, and reasonable legal costs that come from
              your content, your misuse of the app, or your violation of these terms or someone
              else's rights.
            </p>
            <p>
              We will cover you for third-party claims that the Service itself, as we provide it,
              infringes a US patent, copyright, or trademark — excluding claims arising from your
              content, your use of the Service in combination with something we didn't supply, or
              your use after we've told you to stop.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">13. Accessibility</h2>
            <p>
              We are working toward conformance with WCAG 2.1 Level AA. See our{" "}
              <Link to="/accessibility" className="text-primary hover:underline">
                Accessibility Statement
              </Link>
              . If any part of the Service is a barrier for you, email{" "}
              <a
                className="text-primary hover:underline"
                href="mailto:accessibility@launchpadeic.com"
              >
                accessibility@launchpadeic.com
              </a>{" "}
              and we will fix it or provide the information another way.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">14. Privacy</h2>
            <p>
              Our{" "}
              <Link to="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>{" "}
              explains what we collect and why. Using the Service means you have read it.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">15. Institutional and educational use</h2>
            <p>
              If you access the Service through a university, college, or employer, a separate
              written agreement between us and that institution may apply, and where it conflicts
              with these terms, that agreement controls for those users.
            </p>
            <p>
              <strong>Education records.</strong> Where an institution provides us with data that
              constitutes an education record under FERPA (20 U.S.C. § 1232g; 34 CFR Part 99), we
              act as a school official with a legitimate educational interest under 34 CFR
              99.31(a)(1). We use that data only to provide the Service, remain under the
              institution's direct control as to its use and maintenance, and do not redisclose it
              except to subprocessors bound by equivalent terms. We do not use education records to
              train AI models, for advertising, or for any purpose of our own.
            </p>
            <p>
              <strong>Not a healthcare service.</strong> The Service is not offered for clinical use
              and does not process protected health information. Institutions must not route the
              Service through student health or counselling services as part of a treatment pathway
              without a separate written agreement.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">16. Governing law and venue</h2>
            <p>
              These terms are governed by the laws of the State of New Jersey, without regard to its
              conflict-of-laws rules. Any dispute will be brought exclusively in the state or
              federal courts located in {VENUE_COUNTY} County, New Jersey, and both sides consent to
              that jurisdiction.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">17. Changes</h2>
            <p>
              We may update these terms as the app evolves. For significant changes we'll update the
              version at the top, notify you in the app, and where the change materially reduces
              your rights, give you at least 30 days' notice before it takes effect. Continuing to
              use LaunchPad EIC after that means you accept the new terms. If you don't, delete your
              account.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">18. General</h2>
            <p>
              <strong>Severability</strong> — if any part of these terms is unenforceable, the rest
              stays in force. <strong>No waiver</strong> — not enforcing something once doesn't
              waive it. <strong>Assignment</strong> — you may not assign these terms; we may assign
              them to a successor in a merger or sale of substantially all our assets, on notice to
              you. <strong>Force majeure</strong> — neither side is liable for failures caused by
              events outside its reasonable control. <strong>Entire agreement</strong> — these terms
              and the Privacy Policy are the whole agreement between us about the Service, except
              where an institutional agreement applies. <strong>No third-party beneficiaries.</strong>
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">19. Contact</h2>
            <p>
              General and terms questions:{" "}
              <a className="text-primary hover:underline" href="mailto:support@launchpadeic.com">
                support@launchpadeic.com
              </a>
              . Safety and content reports:{" "}
              <a className="text-primary hover:underline" href="mailto:safety@launchpadeic.com">
                safety@launchpadeic.com
              </a>
              . Privacy:{" "}
              <a className="text-primary hover:underline" href="mailto:privacy@launchpadeic.com">
                privacy@launchpadeic.com
              </a>
              . Accessibility:{" "}
              <a
                className="text-primary hover:underline"
                href="mailto:accessibility@launchpadeic.com"
              >
                accessibility@launchpadeic.com
              </a>
              .
            </p>
            <p className="text-muted-foreground">Postal: {ENTITY}, {ENTITY_ADDRESS}.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
