import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Clock, RefreshCw, Target } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.png";

/**
 * The public front door. People who've never heard of LaunchPad see what it is
 * in one screen and can sign up; people who are already signed in skip past it
 * straight to Today.
 */

const TITLE = "LaunchPad EIC — Your career, one move a day";
const DESCRIPTION =
  "A free career app for people 1–10 years in. Set where you're headed and get one small, specific move a day to get there, built on advice from real leaders.";

// Runs in <head> before the page paints: if this browser already holds a
// sign-in, go straight to Today so returning members never see the overview.
const SIGNED_IN_SKIP = `try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&/^sb-.+-auth-token$/.test(k)&&localStorage.getItem(k)){location.replace("/today");break}}}catch(e){}`;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [
      {
        rel: "preload",
        href: "/fonts/anton-latin.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      {
        rel: "preload",
        href: "/fonts/instrument-sans-latin.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
    ],
    scripts: [{ children: SIGNED_IN_SKIP }],
  }),
  component: Landing,
});

const DISPLAY = "landing-display";

const STEPS = [
  {
    title: "Pick where you're headed",
    body: "Your role now and the one you want next. LaunchPad maps the milestones in between.",
  },
  {
    title: "Do today's move",
    body: "One small, specific action, usually 5 to 15 minutes. Not feeling it? Swap it for another.",
  },
  {
    title: "Keep the receipts",
    body: "Log wins as they happen, so when review season comes the proof is already written down.",
  },
];

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Fallback for in-app links to "/" (the head script only runs on a full load).
  useEffect(() => {
    if (!loading && user) navigate({ to: "/today", replace: true });
  }, [loading, user, navigate]);

  return (
    <div className="landing-body min-h-screen text-[oklch(0.2_0.08_295)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2" aria-label="LaunchPad EIC home">
          <img src={logo} alt="" className="h-10 w-10 scale-[1.9] object-contain" />
          <span className="text-lg font-bold tracking-tight">LaunchPad EIC</span>
        </Link>
        <Link
          to="/auth"
          className="rounded-full px-4 py-2 text-sm font-semibold text-[oklch(0.42_0.22_295)] hover:bg-white/60"
        >
          Sign in
        </Link>
      </header>

      {/* ---------- Hero: the one loud thing on the page ---------- */}
      <section aria-labelledby="hero-heading" className="mx-auto max-w-6xl px-3 sm:px-6">
        <div className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(150deg,#2A0D63_0%,#4A1A91_55%,#7B2DB8_100%)] px-5 pt-10 pb-6 text-white shadow-[0_30px_60px_-30px_rgba(42,13,99,0.7)] sm:px-10 sm:pt-14 sm:pb-10 lg:grid lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-10 lg:px-14 lg:py-16">
          {/* Soft orchid glow, the same colour as the top corner of the logo */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#C04BD6] opacity-40 blur-3xl"
          />

          <div className="relative">
            <h1
              id="hero-heading"
              className={`${DISPLAY} text-[clamp(2.75rem,11vw,4.5rem)] leading-[0.95] whitespace-nowrap`}
            >
              <span className="landing-block inline-block -skew-x-6 bg-white px-3 pt-1 pb-0.5 text-[#1B1446]">
                Your career,
              </span>
              <br />
              <span className="landing-block mt-2 inline-block -skew-x-6 bg-[#15123B] px-3 pt-1 pb-0.5 text-white [animation-delay:120ms]">
                one move a day.
              </span>
            </h1>

            <p className="mt-6 max-w-[34rem] text-[1.0625rem] leading-relaxed text-white/85 sm:text-lg">
              LaunchPad is a free career app for people 1–10 years in. Tell it where you want to go,
              and every day it gives you one small, specific thing to do to get there, built on
              advice from real leaders.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="inline-flex min-h-12 items-center rounded-full bg-white px-6 text-base font-semibold text-[#2A0D63] shadow-lg shadow-black/20 transition-transform hover:-translate-y-0.5"
              >
                Create free account
              </Link>
              <Link
                to="/auth"
                className="inline-flex min-h-12 items-center rounded-full px-4 text-base font-medium text-white/90 underline-offset-4 hover:underline"
              >
                I already have one
              </Link>
            </div>
          </div>

          <div className="relative mt-10 lg:mt-0">
            <MoveDemo />
          </div>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section
        aria-labelledby="how-heading"
        className="mx-auto max-w-6xl px-4 pt-16 sm:px-6 sm:pt-20"
      >
        <h2 id="how-heading" className={`${DISPLAY} text-3xl sm:text-4xl`}>
          How it works
        </h2>
        <ol className="mt-8 grid gap-8 sm:grid-cols-3 sm:gap-10">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-4 sm:block">
              <span
                aria-hidden="true"
                className={`${DISPLAY} block w-8 shrink-0 text-5xl sm:w-auto leading-none text-[oklch(0.55_0.24_300)] sm:text-6xl`}
              >
                {i + 1}
              </span>
              <div className="sm:mt-3">
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="mt-1.5 max-w-[30ch] leading-relaxed text-[oklch(0.42_0.06_295)]">
                  {s.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- Where the advice comes from ---------- */}
      <section
        aria-labelledby="leaders-heading"
        className="mx-auto mt-16 max-w-6xl px-4 sm:mt-20 sm:px-6"
      >
        <div className="flex flex-col gap-4 border-y border-[oklch(0.85_0.05_300)] py-8 sm:flex-row sm:items-center sm:gap-10">
          <h2
            id="leaders-heading"
            className={`${DISPLAY} shrink-0 text-2xl leading-tight text-[#2A0D63] sm:text-3xl`}
          >
            3 questions. 5 minutes.
            <br />
            Years of experience.
          </h2>
          <p className="max-w-[46ch] leading-relaxed text-[oklch(0.42_0.06_295)]">
            Short episodes where working leaders answer the career questions nobody explains early
            on. Watch them in the app, then turn what they said into your next move.
          </p>
        </div>
      </section>

      {/* ---------- Price + last call ---------- */}
      <section
        aria-labelledby="price-heading"
        className="mx-auto max-w-6xl px-4 pt-16 pb-12 sm:px-6 sm:pt-20"
      >
        <div className="max-w-2xl">
          <h2 id="price-heading" className={`${DISPLAY} text-3xl sm:text-4xl`}>
            Free to start
          </h2>
          <p className="mt-3 text-lg leading-relaxed text-[oklch(0.42_0.06_295)]">
            Your roadmap, daily moves, check-ins and episodes are free. Premium is $4.99 a month and
            adds an AI coach that knows your goals, a playbook for every episode, and a Review
            Season Pack that turns your wins into a self-review.
          </p>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="brand-gradient mt-7 inline-flex min-h-12 items-center rounded-full px-7 text-base font-semibold text-white shadow-lg shadow-[oklch(0.5_0.24_300/0.35)] transition-transform hover:-translate-y-0.5"
          >
            Create free account
          </Link>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-sm text-[oklch(0.45_0.06_295)] sm:px-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[oklch(0.88_0.04_300)] pt-6">
          <span>© {new Date().getFullYear()} LaunchPad EIC</span>
          <a
            href="https://www.youtube.com/@LaunchPadEIC"
            target="_blank"
            rel="noreferrer"
            className="hover:text-[oklch(0.42_0.22_295)] hover:underline"
          >
            YouTube
          </a>
          <Link to="/terms" className="hover:text-[oklch(0.42_0.22_295)] hover:underline">
            Terms
          </Link>
          <Link to="/privacy" className="hover:text-[oklch(0.42_0.22_295)] hover:underline">
            Privacy
          </Link>
          <Link to="/accessibility" className="hover:text-[oklch(0.42_0.22_295)] hover:underline">
            Accessibility
          </Link>
        </div>
      </footer>
    </div>
  );
}

/**
 * A working copy of the Today card, so the page shows the product instead of
 * describing it. The move and its "why" are real ones the app hands out.
 */
const DEMO_MOVES = [
  {
    action: "Send your manager a three-line status update on your main project, unprompted.",
    why: "Visibility on work in progress beats a reveal at the end.",
    minutes: 10,
  },
  {
    action: "Ask your manager what would move you from good to excellent in your next 1:1.",
    why: "Most managers only give the real answer when asked directly.",
    minutes: 5,
  },
  {
    action:
      "Add one result you delivered this month to your Career Memory, with the number attached.",
    why: "Numbers survive re-tellings. Adjectives do not.",
    minutes: 10,
  },
];

function MoveDemo() {
  const [done, setDone] = useState(false);
  const [which, setWhich] = useState(0);
  const move = DEMO_MOVES[which];

  return (
    <div className="mx-auto max-w-md rotate-1 lg:mr-0">
      <div className="overflow-hidden rounded-3xl bg-white text-[#1B1446] shadow-[0_24px_50px_-20px_rgba(10,4,40,0.6)]">
        <div className="brand-gradient h-1.5" aria-hidden="true" />
        <div className="p-5 sm:p-6">
          <p className="flex items-center gap-1.5 text-sm text-[oklch(0.45_0.06_295)]">
            <Target className="h-4 w-4 text-[oklch(0.5_0.24_300)]" aria-hidden="true" />
            Goal: <span className="font-semibold text-[#1B1446]">Senior Analyst by next fall</span>
          </p>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-[oklch(0.94_0.03_300)]"
            aria-hidden="true"
          >
            <div className="brand-gradient h-full w-[40%] rounded-full" />
          </div>

          <p className="mt-5 text-sm font-semibold text-[oklch(0.5_0.24_300)]">Today's move</p>
          <div key={which} className="landing-swap">
            <p className="mt-1.5 text-xl font-semibold leading-snug">{move.action}</p>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-[oklch(0.45_0.06_295)]">
              {move.why}
            </p>
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-[oklch(0.45_0.06_295)]">
              <Clock className="h-4 w-4" aria-hidden="true" /> {move.minutes} min
            </p>
          </div>

          <div aria-live="polite">
            {done ? (
              <div className="mt-5 rounded-2xl bg-[oklch(0.96_0.03_300)] p-4">
                <p className="flex items-center gap-2 font-semibold">
                  <span className="landing-pop flex h-6 w-6 items-center justify-center rounded-full bg-[oklch(0.5_0.24_300)] text-white">
                    <Check className="h-4 w-4" aria-hidden="true" />
                  </span>
                  Done. That's one.
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-[oklch(0.42_0.06_295)]">
                  That's the whole idea: one move a day, aimed at your goal.{" "}
                  <Link
                    to="/auth"
                    search={{ mode: "signup" }}
                    className="font-semibold text-[oklch(0.45_0.24_300)] underline underline-offset-2"
                  >
                    Get your first real one
                  </Link>
                </p>
              </div>
            ) : (
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDone(true)}
                  className="brand-gradient inline-flex min-h-11 items-center gap-1.5 rounded-full px-5 text-sm font-semibold text-white"
                >
                  <Check className="h-4 w-4" aria-hidden="true" /> Mark done
                </button>
                <button
                  type="button"
                  onClick={() => setWhich((w) => (w + 1) % DEMO_MOVES.length)}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[oklch(0.8_0.06_300)] px-4 text-sm font-medium text-[oklch(0.4_0.08_295)] hover:bg-[oklch(0.97_0.02_300)]"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" /> Give me another
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-sm text-white/70">
        Try it. This is what Today looks like.
      </p>
    </div>
  );
}
