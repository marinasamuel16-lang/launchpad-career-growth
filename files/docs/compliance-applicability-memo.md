# What actually applies to LaunchPad EIC — and what doesn't

**Prepared:** 11 September 2026
**Subject:** Regulatory scope for selling LaunchPad EIC to a public university in New Jersey
**Status:** Working analysis for the vendor, not legal advice. See the note at the end.

---

## The short answer

**HIPAA does not apply to LaunchPad EIC, and you should stop putting it in the pitch.**

Claiming HIPAA alignment for a career-coaching app is not a neutral overstatement.
A university's privacy officer reads it as a sign the vendor does not know which
regime governs their own product, and it invites a line of questioning — BAAs,
minimum necessary, breach notification under 45 CFR 164.400 — that you will fail
because the framework was never built for what you do.

What *does* apply, in order of how likely it is to kill the deal:

| # | Requirement | Why it bites | Where you stand |
|---|---|---|---|
| 1 | **ADA Title II / Section 504 — WCAG 2.1 AA** | A public university cannot procure an inaccessible digital service. This is the hard gate. | Two measured failures, both fixable in an afternoon. No conformance report exists. |
| 2 | **FERPA** | Applies to the *university*, not to you — but it flows down to you by contract as a "school official." | No contractual language exists yet. |
| 3 | **Vendor security review (HECVAT 4)** | The actual procurement mechanism. Not a law; the thing that gates the PO. | No HECVAT completed. Architecture is genuinely good; documentation is absent. |
| 4 | **NJ Data Privacy Act (NJDPA)** | Probably below the statutory threshold today, but campuses require compliance by contract regardless. | Deletion is solid. Portability and appeal rights are missing. |
| 5 | **Accessibility + AI disclosure in the contract** | HECVAT 4 added an AI section in Feb 2025. You have an LLM in the product. | Disclosed in the privacy policy; not documented at review depth. |

---

## 1. Why HIPAA is out of scope

HIPAA binds **covered entities** — health plans, healthcare clearinghouses, and
healthcare providers who transmit health information electronically in connection
with a covered transaction — and the **business associates** who handle protected
health information on their behalf.

LaunchPad EIC is neither. It is a career-development app. I read the full schema:
the tables are `profiles`, `posts`, `comments`, `milestones`, `milestone_tasks`,
`coach_messages`, `xp_events`, `subscriptions`. There is no clinical data, no
provider relationship, no billing code, no covered transaction. You are not
acting on behalf of any covered entity.

**Two edge cases worth naming out loud, because a careful reviewer will raise them:**

**The AI Coach free-text field.** A user can type anything into it, including
something about their mental health. That does not make the data PHI — PHI is
defined by *who holds it and in what relationship*, not by topic. A user telling
a career app they are burned out is no more PHI than the same sentence in an
email. But it *does* mean the free-text column should be treated as sensitive in
your own handling, and it means the coach needs the crisis-routing guardrails
described in the code changes. That is a duty-of-care and reputational issue, not
a HIPAA one.

**If the university ever routes the app through student health or counselling
services.** If a campus counselling centre were to recommend or embed the tool as
part of a treatment pathway, the analysis changes — and note that at a university,
student treatment records are usually governed by FERPA's exclusion at
34 CFR 99.3 rather than by HIPAA in the first place. Keep the sale inside career
services, the alumni office, or student success, and this never arises. Put a
line in your contract saying the service is not for clinical use.

**What to say when procurement asks "are you HIPAA compliant?"** — and they will,
because it is on a checklist:

> LaunchPad EIC does not process protected health information and is not a
> covered entity or business associate under HIPAA, so HIPAA does not apply to
> the service. The app collects career and professional-development data only.
> Our Terms prohibit clinical use, and the AI Coach is instructed to decline
> clinical topics and route users to appropriate support resources. We have
> documented our privacy and security posture against HECVAT 4 instead, which is
> the applicable framework for this category.

That answer is better than a "yes." It shows you know the difference.

---

## 2. ADA Title II — the real gate, and it has a date on it

This is the requirement that most directly threatens the sale, and it is the one
nobody in your position expects.

DOJ's Title II web accessibility rule requires state and local government
entities — which includes public universities — to conform their websites and
mobile apps to **WCAG 2.1 Level AA**. The original compliance date was
24 April 2026. DOJ issued an interim final rule on 20 April 2026 extending it:

- Entities in a population of **50,000 or more**: **26 April 2027**
- Entities under 50,000, and special districts: **26 April 2028**

A New Jersey public university sits in the first bucket, so the operative date is
**26 April 2027**. Critically, the rule reaches services the entity offers
"including when a state or local government has an arrangement with another
organization" — i.e. it reaches *you*, through the contract. Universities are
already writing WCAG 2.1 AA conformance and indemnity into standard vendor terms
ahead of the date, because a procurement in 2026 is a system they will still be
running in 2027.

**Practical consequence:** you will be asked for a VPAT / Accessibility
Conformance Report. Not having one is the most common reason a small ed-tech
vendor gets stopped before a security review even begins.

**Where you actually stand.** I computed contrast ratios directly from your oklch
design tokens rather than eyeballing them. The palette is mostly well-chosen —
body text 16.6:1, muted text 5.73:1, primary links 6.42:1, all comfortably
passing. Two things fail:

- Input and control borders sit at **1.27:1** against the page background where
  WCAG 1.4.11 requires **3:1**. Every text field in the app, starting with the
  sign-in form.
- White text on the destructive/delete button sits at **4.31:1** where 1.4.3
  requires **4.5:1**. A near miss, but a miss.

Structurally there is also no `<main>` landmark, no skip link, no `aria-current`
on the active nav tab, and form errors are delivered only by a disappearing
toast that is never associated with the field that caused it.

None of this is expensive. It is roughly a day of work, and it moves the
conformance report from "does not support" to "supports" on the criteria a
reviewer actually spot-checks.

**One caution on the conformance report I drafted for you:** it is based on
source review and computed contrast values. I could not reach the deployed app
from my environment to run an automated scan against the live DOM. Before you
send an ACR to a university, run an actual scan (axe DevTools or WAVE, free) and
do a manual keyboard-only pass over every screen. Signing an inaccurate ACR is
worse than not having one — it is a representation you are making in a
procurement, and Title II liability flows from it.

---

## 3. FERPA — flows down to you, and is mostly a contract problem

FERPA governs education records held by the institution. You are not directly
regulated by it. But the moment the university gives you a roster, a student
identifier, or SSO attributes, you are handling data that is a FERPA record in
their hands, and they will designate you a **school official with a legitimate
educational interest** under 34 CFR 99.31(a)(1) so the disclosure to you is
lawful without individual consent.

That designation carries three conditions the university must impose on you, and
therefore three things your contract must say:

1. You perform a service the institution would otherwise use employees for.
2. You are under the institution's **direct control** as to use and maintenance
   of the education records.
3. You **do not redisclose** the information to anyone else, and you use it only
   for the purpose it was disclosed for.

The redisclosure clause is the one to look at hard, because of your AI Coach.
Sending student data to a third-party model provider is a disclosure. It is
permissible if the provider is your subprocessor acting under contract and does
not use the data for its own purposes — but you must be able to state that in
writing, and you must be able to show the model provider is contractually barred
from training on it. Get that confirmation from Lovable in writing about the
Gemini gateway before you sign anything. If you cannot get it, that is a material
fact you need to disclose, and it may force you to a different AI provider with
a zero-retention commitment.

Practical note: a pilot scoped to *self-registered* users, where the university
gives you no roster and no SSO, keeps FERPA almost entirely out of the picture.
That is the cheapest way to start, and worth proposing.

---

## 4. NJDPA — probably doesn't apply yet, but you'll be held to it anyway

The New Jersey Data Privacy Act took effect 15 January 2025. Its 30-day
right-to-cure expired **1 July 2026**, so the Division of Consumer Affairs can now
enforce without giving you a chance to fix first. Penalties run $10,000 for a
first violation and $20,000 for each subsequent one.

**Applicability**: a controller processing the personal data of at least 100,000
consumers, or at least 25,000 consumers where it derives revenue from selling that
data. You are almost certainly under both today. Nonprofits are *not* exempt,
and there is no higher-education carve-out.

So why care? Because every campus privacy addendum requires you to comply with
applicable state privacy law as if you were in scope, and because you will cross
the threshold quietly if the product works. Build it in now while the app is
small.

**Where you stand:**

Good — better than most apps at this stage:

- Row-level security is enabled on all 21 tables, and I reviewed every policy
  individually. They are correct. No table leaks across users.
- The `profiles` table deliberately contains no email address, so the
  authenticated-read policy on it exposes only what a social profile should.
- Account deletion genuinely works. Every user-scoped table carries a foreign key
  to `auth.users` with `ON DELETE CASCADE` — I verified all 20 of them. When you
  delete a user, the data actually goes. Many apps that promise this do not
  deliver it, and yours does.
- Avatars are in a private bucket served through signed URLs.
- The Stripe webhook verifies HMAC signatures with a timing-safe comparison and
  rejects events older than five minutes. That is a correctly implemented
  webhook, which is rarer than it should be.

Missing:

- **Portability.** Users cannot export their data themselves; the policy tells
  them to send an email. NJDPA grants a portability right with a 45-day clock.
- **Appeal process.** NJDPA requires a mechanism to appeal a refused privacy
  request, and requires you to describe it. Nothing exists.
- **Universal opt-out / Global Privacy Control.** Required since the effective
  date. You currently run no advertising or analytics trackers, so there is
  nothing to opt out *of* — say so explicitly rather than staying silent, and
  commit to honouring GPC if that ever changes.
- **Data protection assessment.** Required for high-risk processing, which
  includes profiling. Your AI roadmap generator profiles users to produce career
  recommendations. One needs to be written and kept on file.
- **Consent records.** The signup checkbox gates the button and is then thrown
  away. You cannot currently prove which version of the Terms any user accepted.

---

## 5. The things nobody warns you about

**The documents now name a sole proprietor, and that has consequences.** As of
11 September 2026 the decision is that LaunchPad EIC operates as a **sole
proprietorship in Marina Samuel's name**, with the LLC deferred until the product
earns money. Every document in this package has been updated to say so. That is a
defensible call while there is no revenue and no contract — forming an LLC to hold
a thing that makes nothing is a cost with no matching benefit. Three things follow
from it that are worth knowing before anyone signs anything.

*There is no liability shield.* A sole proprietorship is not separate from the
person. Marina personally is the business: a claim against LaunchPad EIC is a
claim against her, reaching her personal assets. With six users and no contract,
the practical exposure is close to nothing. The moment a university's students are
using it under an agreement with accessibility warranties and breach-cost clauses,
it is not close to nothing, and the LLC stops being optional.

*A trade name has to be registered.* Operating under "LaunchPad EIC" rather than
"Marina Samuel" requires a Trade Name Certificate filed with the **County Clerk**
in each New Jersey county where the business operates — it is not a state-level
filing, and it is not automatic. Registration is mandatory for a sole proprietor
using a name other than their own. Fees are set per county and are modest. The
free NJ Business Action Center helpline (1-800-JERSEY-7) will walk through it.

*Some universities will not contract with a sole proprietor at all.* Many
procurement offices require an incorporated entity, a federal EIN, and a W-9
before they will set a vendor up in their payment system. This is not a legal
barrier, it is a policy one, and it varies by institution. Worth asking early:
"does your vendor onboarding accept a sole proprietor, or do you require an
incorporated entity?" — the answer tells you whether the LLC is needed before the
pitch or after the handshake.

The practical sequence: register the trade name now (cheap, required, unblocks the
documents), and form the LLC the moment a university says yes — before signing,
not after. An LLC formed at that point can take over the agreement cleanly.

**Your liability cap is $50.** That is section 9 of the current Terms. No
university procurement office will sign it. Public institutions typically require
liability at the greater of contract value or a fixed floor, plus vendor-side
indemnity for IP infringement and for data breach. Expect to negotiate up, expect
to carry insurance (general liability, professional liability / E&O, and cyber
— usually $1–2M each), and price the deal accordingly. This is often the single
biggest surprise cost in a first institutional sale.

**Your indemnity runs one way — from the user to you.** Institutions require the
opposite direction for IP and breach. Section 10 as written will be struck.

**There is no governing law or dispute resolution clause at all.** Add New Jersey
law and venue. A public university will likely insist on its own state's law and
may refuse arbitration outright, since state entities often cannot agree to it.

**You host user-generated content and have no DMCA agent.** The 17 U.S.C. § 512
safe harbour is only available if you designate an agent with the Copyright
Office and publish the contact. It is a $6 filing. Without it you are directly
liable for infringing material users post.

**You have no way for a user to report content or block another user.** For a
social feed being sold to a university whose students will be the users, this is
a genuine blocker — not a paperwork gap. The migration I wrote creates the tables
and enforces blocking in the database; the buttons and the admin queue still need
building.

**No SSO.** Campuses do not want students creating another password. Shibboleth
or Entra SAML will come up, and it is usually the largest engineering item in a
higher-ed deal. Not needed for a pilot; needed for a real contract.

---

## 6. What I'd actually do, in order

**Before you email anyone at the university:**

1. Register the trade name with the County Clerk. Confirm the mailing address
   that goes in the documents. (LLC deferred by decision — see section 5.)
2. Apply the accessibility fixes — roughly one day — then run a real axe scan and
   a keyboard-only pass, and correct the conformance report to match what you
   find.
3. Publish the revised Privacy Policy, Terms, and a new Accessibility Statement.
4. Ship the data-export button and the consent-record columns.
5. Turn on leaked-password protection in Supabase. One toggle.

**Before a pilot with real students:**

6. Build report / block / admin moderation queue on top of the migration.
7. Add the AI Coach crisis guardrails.
8. Complete HECVAT 4 honestly. "No, and here is our timeline" scores better than
   a blank or an overstatement — reviewers are used to small vendors and are
   looking for candour and a plan, not perfection.
9. Get written confirmation from Lovable that prompts through the AI gateway are
   not retained or used for model training. This is the answer to a question you
   will definitely be asked.
10. Get insurance quotes so you know your floor before you negotiate the cap.

**Before signing anything:**

11. **Have a New Jersey attorney review the final contract.** Not the policies —
     those you can publish on your own judgment — the *contract*. A university
     master agreement with indemnity, liability, data-breach, and accessibility
     warranties is a document you can lose real money on, and the clauses that
     hurt are the ones that look boring. The documents in this package are
     drafted to be a strong starting position and to survive a vendor review;
     they are not a substitute for counsel signing off on what you actually
     execute.

---

*Prepared by Claude for Steven Ghatas. I am not a lawyer and this is not legal
advice. The regulatory citations were verified against current sources on
11 September 2026 and are listed in the accompanying sources file; deadlines and
enforcement postures change, so re-check the ADA Title II date and NJDPA
thresholds before relying on them in a negotiation.*
