import { createFileRoute, Link } from "@tanstack/react-router";
import { LEGAL_VERSION, LEGAL_VERSION_LABEL } from "@/lib/legal";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — LaunchPad EIC" },
      {
        name: "description",
        content:
          "What LaunchPad EIC collects, how your career data and AI Coach chats are stored, who can see them, your rights, and how to export or delete everything.",
      },
      { property: "og:title", content: "Privacy Policy — LaunchPad EIC" },
      {
        property: "og:description",
        content:
          "What LaunchPad EIC collects, how it is stored and used, your rights, and how to export or delete your data.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

// The controller is named (not just the product name): every US state privacy
// law expects it, and a university can't contract with a product name.
const ENTITY = "Marina Samuel, a sole proprietor doing business as LaunchPad EIC";
const ENTITY_LOCATION = "New Jersey, USA";
const CONTACT_EMAIL = "launchpadeic@gmail.com";
// Supabase project launchpad-career-hub runs in AWS us-east-1.
const DATA_REGION = "the United States (US East, Virginia)";

// Keep these two in step with src/lib/ai.server.ts. If the AI provider changes,
// update both and bump LEGAL_VERSION.
const AI_PROVIDER_NAME = "Cloudflare Workers AI";
const AI_PROVIDER_TERMS =
  "It runs open AI models (currently Meta's Llama) on Cloudflare's own servers. Cloudflare does not use your content to train AI models and doesn't keep it once the response has been returned.";

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-10 pb-24">
        <Link to="/" className="text-sm text-primary hover:underline">
          ← Back to LaunchPad EIC
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Version {LEGAL_VERSION} · Last updated: {LEGAL_VERSION_LABEL}
        </p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground/90">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Who we are</h2>
            <p>
              LaunchPad EIC is operated by <strong>{ENTITY}</strong>, based in {ENTITY_LOCATION}. We
              are the data controller for the personal data described here. Contact us at{" "}
              <a className="text-primary hover:underline" href="mailto:launchpadeic@gmail.com?subject=Privacy%20request">
                launchpadeic@gmail.com
              </a>
              .
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">The short version</h2>
            <p>
              We collect what we need to run the app: your account details, the profile you set up,
              your goals and roadmap, your daily check-ins and logged wins, and your AI Coach
              conversations. Everything you put in is private to you — other users can't see it.{" "}
              <strong>
                We do not sell your data, we do not share it for advertising, and it is not used to
                train AI models.
              </strong>{" "}
              You can download everything we hold about you, and delete your account and everything
              tied to it, at any time from Profile → Settings.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">What we collect</h2>
            <p className="font-medium">Account information</p>
            <p>
              Your email address and password (stored hashed by our sign-in provider), or — if you
              sign in with Google — your Google account email and the basic profile details Google
              shares with us. We never see your Google password.
            </p>
            <p className="font-medium">Profile information you enter</p>
            <p>
              Name, current role, industry, years of experience, career goal, an optional LinkedIn
              URL, and an optional profile photo.
            </p>
            <p className="font-medium">Your career data</p>
            <p>
              Your goals (with any target date, focus area, and what's in your way), your roadmap
              milestones and tasks, the daily moves you're offered and whether you did or skipped
              them, your daily check-ins (a mood rating and an optional note), your logged wins, the
              weekly actions you check off, your career journey timeline, your LaunchScore history,
              and any self-reviews you generate.
            </p>
            <p className="font-medium">AI Coach conversations</p>
            <p>
              Your messages to the AI Coach and its replies are stored in your account so your chat
              history is there when you come back. You can clear your chat history from the Coach
              screen at any time.
            </p>
            <p className="font-medium">AI feature usage</p>
            <p>
              A record of when you used certain AI features (not what you wrote), so we can keep
              usage fair and within our limits.
            </p>
            <p className="font-medium">Notifications and emails</p>
            <p>
              The in-app notifications we send you, and whether you've asked us to stop the weekly
              email.
            </p>
            <p className="font-medium">Consent records</p>
            <p>
              Which version of our Terms and this Privacy Policy you agreed to, and when, and that you
              confirmed you're 18 or older.
            </p>
            <p className="font-medium">Subscription information</p>
            <p>
              If you subscribe to LaunchPad Premium, we store your subscription status, plan, renewal
              date, and the customer and subscription IDs from our payment processor, Stripe. Stripe
              handles your card details directly — we never see or store your card number.
            </p>
            <p className="font-medium">What we don't collect</p>
            <p>
              We do not run advertising or analytics trackers in the app. We do not collect your
              location, contacts, or browsing activity on other sites. We do not ask for and do not
              want health information, government ID numbers, or financial account numbers. Our
              hosting providers keep standard server logs (things like IP address, timestamp, and
              which page was requested) for security and reliability.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">How we use it</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                To run your account, your daily moves, your roadmap, weekly actions, and your
                subscription.
              </li>
              <li>To personalise the AI features using your profile and career data.</li>
              <li>
                To send you account emails, in-app notifications, and the weekly Action of the Week
                email.
              </li>
              <li>To keep the app safe and prevent abuse.</li>
              <li>To support you when you contact us.</li>
              <li>To meet legal obligations and respond to valid legal process.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">AI features</h2>
            <p>
              When you use an AI feature — the AI Coach, Today's move, roadmap generation, turning a
              check-in into a logged win, or drafting a self-review — the parts of your profile and
              career data that the feature needs are sent to our AI provider, {AI_PROVIDER_NAME}, to
              produce the response. {AI_PROVIDER_TERMS}
            </p>
            <p>
              <strong>Your data is not used to train AI models</strong> — not by us, and not by our AI
              provider.
            </p>
            <p className="font-medium">Automated processing</p>
            <p>
              The AI features produce suggestions from your profile and career data. These are
              suggestions only. Nothing in LaunchPad EIC makes an automated decision with a legal or
              similarly significant effect on you — we do not screen, score, rank, or filter you for
              any employer, school, or third party, and we will not without telling you first and
              asking.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Who can see what</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Private to you:</strong> your profile and everything you create — goals,
                roadmap, check-ins, logged wins, self-reviews, AI Coach conversations, notifications,
                and subscription status. There is no public feed, and other users of LaunchPad EIC
                can't see your profile or anything in it.
              </li>
              <li>
                <strong>Our team:</strong> the operator can access the database to run and support
                the app. Administrative access is limited to named individuals, and privileged
                actions are logged to an append-only record.
              </li>
              <li>
                <strong>Never visible to anyone:</strong> your password.
              </li>
            </ul>
            <p>
              These boundaries are enforced in the database itself with row-level security policies,
              not only in the app's interface.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Where it lives and how it's protected</h2>
            <p>
              Your data is held in a managed cloud database and file storage in {DATA_REGION}. It is
              encrypted in transit (TLS) and encrypted at rest by the hosting provider. Access is
              restricted per account by database-level row security policies. Profile photos are
              stored in a private bucket and served through short-lived signed links.
            </p>
            <p>
              No system is perfectly secure and we won't claim otherwise. If a breach affects your
              personal data we will notify you and the relevant authorities as required by law,
              without undue delay.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Service providers</h2>
            <p>
              We don't sell your data and we don't share it with advertisers. We rely on a small
              number of providers to run the app, and they only process data on our behalf:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Supabase</strong> — database, sign-in, and file storage, in the US.
              </li>
              <li>
                <strong>Cloudflare</strong> — hosts the website, and runs the AI features through{" "}
                {AI_PROVIDER_NAME}, as described above.
              </li>
              <li>
                <strong>Google</strong> — "Continue with Google" sign-in, if you use it, and Gmail,
                which we use to send the weekly email.
              </li>
              <li>
                <strong>Stripe</strong> — payments, if you subscribe to Premium.
              </li>
              <li>
                <strong>YouTube</strong> — episodes and members-only bonus videos play from YouTube
                inside the app; YouTube may set its own cookies when you play one.
              </li>
            </ul>
            <p>
              We may also disclose data where legally required — a subpoena, court order, or other
              valid legal process — or where necessary to protect someone's safety. We will tell you
              when we are permitted to.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Emails</h2>
            <p>
              We send account emails (like confirming your address or resetting your password) and a
              weekly Action of the Week email. To stop the weekly email, reply "unsubscribe" to any of
              them and we'll take you off the list. Account emails continue while you have an account.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">How long we keep it</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Your account, profile, and career data — while your account is open.</li>
              <li>AI Coach conversations — until you clear them, or you delete your account.</li>
              <li>Consent records — while your account is open.</li>
              <li>
                Privacy requests you send us — we keep a record of the request and how we handled it.
              </li>
              <li>
                Server logs and backups kept by our hosting providers — these roll off automatically,
                generally within 30 days.
              </li>
              <li>Payment records — Stripe keeps its own records of payments as the law requires.</li>
            </ul>
            <p>
              Delete your account and we delete it and everything tied to it — your profile and
              photo, goals, roadmap, check-ins, logged wins, self-reviews, AI Coach conversations,
              and notifications — and cancel your Premium subscription if you have one. This is
              enforced by the database, not by a manual process.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Your rights</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Access and take your data elsewhere</strong> — download everything we hold
                about you as a JSON file from <strong>Profile → Settings → Download my data</strong>.
                No request needed.
              </li>
              <li>
                <strong>Correct</strong> — edit your profile and your career data any time.
              </li>
              <li>
                <strong>Delete</strong> — <strong>Profile → Settings → Delete account</strong>.
                Immediate and permanent.
              </li>
              <li>
                <strong>Clear your AI Coach history</strong> — the "Clear" button on the Coach
                screen.
              </li>
              <li>
                <strong>Object or restrict</strong> — email us and tell us what you object to.
              </li>
              <li>
                <strong>Opt out</strong> — we do not sell personal data, do not process it for
                targeted advertising, and do not profile you for decisions with legal or similarly
                significant effects. If that ever changes we will honour universal opt-out signals
                including Global Privacy Control, and tell you before the change takes effect.
              </li>
            </ul>
            <p>
              If you are in New Jersey, the New Jersey Data Privacy Act gives you these rights.
              Residents of California, Colorado, Connecticut, Virginia and other states with
              comprehensive privacy laws have substantially similar rights, and we apply the same
              process to everyone.
            </p>
            <p className="font-medium">How to make a request</p>
            <p>
              Email{" "}
              <a className="text-primary hover:underline" href="mailto:launchpadeic@gmail.com?subject=Privacy%20request">
                launchpadeic@gmail.com
              </a>{" "}
              from the address on your account. We will respond within 45 days, and may extend once
              by a further 45 days where the request is complex, telling you why. We will not charge
              you and will not treat you differently for asking.
            </p>
            <p className="font-medium">If we refuse — your right to appeal</p>
            <p>
              If we decline a request we will tell you why in writing and explain how to appeal. To
              appeal, reply to our decision with "Appeal" in the subject line. A different person
              will review it and respond within 45 days with a written explanation. If we deny the
              appeal we will give you a link to submit a complaint to the New Jersey Division of
              Consumer Affairs, or to your own state's Attorney General.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Age</h2>
            <p>
              LaunchPad EIC is only for people 18 and older, and everyone confirms they're 18 or
              older before using it. Please don't create an account if you're under 18. If we learn
              that someone under 18 has an account, we'll delete it — email us if you believe this
              has happened.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Accessibility</h2>
            <p>
              We are working toward conformance with WCAG 2.1 Level AA. See our{" "}
              <Link to="/accessibility" className="text-primary hover:underline">
                Accessibility Statement
              </Link>
              . If any part of this app is a barrier for you, email{" "}
              <a
                className="text-primary hover:underline"
                href="mailto:launchpadeic@gmail.com?subject=Accessibility"
              >
                launchpadeic@gmail.com
              </a>{" "}
              and we will fix it or give you the information another way.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Institutional users</h2>
            <p>
              If you are using LaunchPad EIC through your university or employer, that institution
              may have a separate agreement with us governing how we handle data about you. Where
              that agreement is stricter than this policy, it wins. Your institution does not have
              access to your AI Coach conversations or your private career data unless we have told
              you otherwise in advance and in plain terms.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Changes</h2>
            <p>
              If we change what we collect or how we use it, we'll update this page and the version
              at the top, and ask you to review and agree in the app when the change is significant.
              We will not apply a materially different use to data we already hold without asking
              you first.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Contact</h2>
            <p>
              Privacy questions, requests, or appeals, and accessibility issues:{" "}
              <a
                className="text-primary hover:underline"
                href={`mailto:${CONTACT_EMAIL}?subject=Privacy%20request`}
              >
                {CONTACT_EMAIL}
              </a>
              . {ENTITY}, {ENTITY_LOCATION}. A postal address for formal legal notices is available
              on request by email.
            </p>
            <p className="text-muted-foreground">
              See also our{" "}
              <Link to="/terms" className="text-primary hover:underline">
                Terms of Service
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
