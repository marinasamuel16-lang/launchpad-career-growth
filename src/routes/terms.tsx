import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — LaunchPad EIC" },
      {
        name: "description",
        content:
          "Plain-language terms for using LaunchPad EIC: AI Coach is informational only, no guaranteed outcomes, and how accounts can be terminated.",
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

const UPDATED = "August 18, 2026";

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-10 pb-24">
        <Link to="/" className="text-sm text-primary hover:underline">
          ← Back to LaunchPad EIC
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Terms of Service</h1>
        <p className="mt-1 text-sm text-muted-foreground">Last updated: {UPDATED}</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground/90">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">1. The short version</h2>
            <p>
              LaunchPad EIC is a career growth app for people roughly 1–10 years into their
              careers. You get an AI Coach, a career roadmap, a community feed, and video
              conversations. It's a tool to help you think — it is not a professional advisor, and
              it can't promise you a job, a raise, or a promotion. By creating an account or using
              the app, you agree to these terms.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">2. The AI Coach is informational only</h2>
            <p>
              LaunchPad Coach is an AI assistant. It is <strong>not</strong> a professional career
              counselor, therapist, mental health professional, financial advisor, accountant,
              doctor, or attorney, and using it does not create any professional relationship.
            </p>
            <p>
              Everything the AI Coach, the roadmap generator, and the rest of the app produce is
              general information for your consideration only. AI can be confidently wrong, out of
              date, or missing context about your situation. Don't rely on it as professional
              advice. For anything important — legal questions, money decisions, health or mental
              health concerns, employment disputes, immigration or visa issues, contracts — talk to
              a qualified professional who knows your specific situation.
            </p>
            <p>
              If you are in crisis or experiencing a medical or mental health emergency, contact
              your local emergency services or a crisis line. Do not use this app for that.
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
            <h2 className="text-lg font-semibold">4. Community content is not ours</h2>
            <p>
              Posts, comments, reposts, and profiles are created by individual users. Those views
              are theirs, not LaunchPad EIC's, and we don't verify, endorse, or fact-check them.
              Treat career advice from strangers on the internet accordingly.
            </p>
            <p>
              You're responsible for what you post. Don't post anything unlawful, harassing,
              hateful, sexually explicit, defamatory, misleading, or that infringes someone else's
              rights — and don't post confidential information belonging to your employer or
              anyone else. You keep ownership of what you post, and you give us permission to
              store, display, and distribute it inside the app so the feed works.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">5. Your account</h2>
            <p>
              You need to be at least 16 years old to use LaunchPad EIC. Keep your login details
              secure — you're responsible for activity under your account. Give us accurate
              information when you sign up.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">6. Paid features</h2>
            <p>
              Some AI features may be offered as a paid subscription. Pricing, billing terms, and
              renewal details are shown at the point of purchase. Nothing on this page is a promise
              that a paid feature will produce a particular result.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">7. Termination and misuse</h2>
            <p>
              We may suspend or terminate your account, remove content, or limit features at any
              time if you break these terms, misuse the app, abuse other users, attempt to scrape,
              reverse-engineer, overload, or gain unauthorized access to the service, or use the
              app in a way that creates legal risk for us or others. You can stop using the app and
              delete your account at any time from Profile → Settings.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">8. Service provided "as is"</h2>
            <p>
              LaunchPad EIC is provided "as is" and "as available," without warranties of any kind,
              express or implied, including any implied warranties of merchantability, fitness for
              a particular purpose, accuracy, or non-infringement, to the maximum extent permitted
              by law. We don't promise the app will always be available, error-free, or that
              content or AI output will be accurate or complete.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">9. Limitation of liability</h2>
            <p>
              To the maximum extent permitted by law, LaunchPad EIC and the people who work on it
              are not liable for any indirect, incidental, special, consequential, exemplary, or
              punitive damages, or for any lost profits, lost wages, lost job or business
              opportunities, lost data, or reputational harm, arising out of or related to your use
              of the app — including decisions you make based on AI Coach output, roadmap content,
              or anything another user posts.
            </p>
            <p>
              To the maximum extent permitted by law, our total liability for any claim relating to
              the app is limited to the greater of (a) the amount you paid us in the 12 months
              before the claim, or (b) USD $50. Some jurisdictions don't allow certain limitations,
              so parts of this section may not apply to you.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">10. Indemnity</h2>
            <p>
              You agree to cover us for claims, losses, and reasonable legal costs that come from
              your misuse of the app, your content, or your violation of these terms or someone
              else's rights.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">11. Changes</h2>
            <p>
              We may update these terms as the app evolves. If we make a significant change, we'll
              update the date at the top and, where appropriate, notify you in the app. Continuing
              to use LaunchPad EIC after an update means you accept the new terms.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">12. Contact</h2>
            <p>
              Questions about these terms? Email{" "}
              <a className="text-primary hover:underline" href="mailto:support@launchpadeic.com">
                support@launchpadeic.com
              </a>
              .
            </p>
            <p className="text-muted-foreground">
              See also our{" "}
              <Link to="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
