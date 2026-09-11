# Security & Privacy Overview

**LaunchPad EIC** · Version 2026-09-11
Companion to HECVAT 4. Prepared for institutional vendor review.

> **How to use this.** Do not send this as your HECVAT answer — download the real
> HECVAT 4 from EDUCAUSE and fill it in, because institutions ingest that file
> format. This document is the narrative that sits behind it and answers the
> questions a reviewer asks after reading the spreadsheet.
>
> **Answer honestly.** HECVAT reviewers assess small vendors constantly. A "No,
> and here is our plan and date" scores better than a blank, and far better than a
> "Yes" that falls apart on a follow-up call. Overstating is the fastest way to
> lose a deal you would otherwise have won.
>
> `[BRACKETS]` mark things only you can confirm.

---

## 1. Company and service

| | |
|---|---|
| Legal entity | **Marina Samuel (d/b/a LaunchPad EIC)**, a sole proprietorship (New Jersey) |
| Address | [MAILING ADDRESS] |
| Service | LaunchPad EIC — career-development web application and PWA |
| Users | Early-career professionals, 1–10 years' experience |
| Data classification | Low-sensitivity personal data. **No PHI, no government IDs, no financial account numbers, no SSNs.** |
| Security contact | `security@launchpadeic.com` |
| Employees with production access | **[N — state the real number, even if it is 1]** |

---

## 2. Architecture

Single-page React application (TanStack Start) served from Cloudflare Workers,
backed by Supabase (managed PostgreSQL, authentication, and object storage).
Payments through Stripe Checkout. AI inference through the Lovable AI gateway to
Google Gemini.

| Component | Provider | Region | Handles |
|---|---|---|---|
| Application hosting | Cloudflare Workers via Lovable | Global edge | Requests; no persistent user data |
| Database, auth, storage | Supabase (AWS) | **[CONFIRM — state the region]** | All application data |
| AI inference | Google Gemini via Lovable AI gateway | **[CONFIRM]** | Prompt + profile/roadmap context |
| Payments | Stripe | US | Card data — **never touches our systems** |
| Video | YouTube (public channel) | Global | Public content only |

---

## 3. Access control and data isolation

Multi-tenant by row, with isolation enforced in the database rather than in
application code.

- **Row-Level Security is enabled on all 21 application tables.** Every policy was
  reviewed individually as part of this assessment. Private data —
  `coach_messages`, `milestones`, `milestone_tasks`, `action_steps`,
  `notifications`, `xp_events`, `subscriptions`, `ai_usage`, `career_journey`,
  `personalized_actions`, `user_action_completions` — is restricted to
  `auth.uid() = user_id`. Social data — `posts`, `comments`, `follows`,
  `post_likes`, `post_reposts`, `profiles` — is readable by authenticated users
  only and writable only by its owner. Nothing is readable anonymously.
- **The `profiles` table contains no email address.** Contact details live only in
  `auth.users`, which application clients cannot read. A signed-in user cannot
  enumerate other users' email addresses.
- **Administrative privilege** is held in a separate `user_roles` table and
  checked through a `SECURITY DEFINER` function, not through a client-supplied
  claim — so a user cannot escalate by editing their own profile row.
- **Object storage**: the `avatars` bucket is private; images are served through
  short-lived signed URLs.
- **Privileged action logging**: an append-only `admin_audit_log` records admin
  actions. There is no UPDATE or DELETE policy on it, so an administrator cannot
  edit or erase their own trail.

## 4. Authentication

| Control | Status |
|---|---|
| Password hashing | Handled by Supabase Auth (bcrypt). Plaintext passwords are never stored or logged. |
| Minimum password length | **8 characters** (raised from 6; NIST SP 800-63B floor) |
| Breached-password screening | **[Enable the HaveIBeenPwned check in Supabase Auth settings, then answer Yes]** |
| Email verification | Required before first sign-in |
| Google OAuth | Supported; we never receive the Google password |
| MFA | **Not yet available. Planned: TOTP, administrators first. Target [DATE].** |
| Session management | JWTs with refresh rotation, managed by Supabase Auth |
| SSO (SAML / Shibboleth) | **Not yet available. Available under an institutional agreement; scope and timeline on request.** |
| Brute-force protection | Provider-level rate limiting on auth endpoints |

## 5. Encryption

- **In transit**: TLS 1.2+ on every connection, browser to edge and edge to
  database. HSTS with `includeSubDomains; preload`.
- **At rest**: AES-256, provided by Supabase/AWS for database and object storage.
- **Key management**: managed by the platform providers. We hold no long-lived
  encryption keys.
- **Secrets**: held in the platform's encrypted environment store, not in source.
  The only credential present in the repository is the Supabase publishable
  (anon) key, which is designed to be public and carries no privilege beyond what
  Row-Level Security permits. **The service-role key is not in source control.**

## 6. Payments — PCI

Card data is collected by **Stripe Checkout** and never transits or rests on our
infrastructure. We store only a Stripe customer ID, a subscription ID, status,
plan, and period end. Our PCI scope is therefore **SAQ A**, the minimum
applicable level.

The Stripe webhook endpoint verifies the HMAC-SHA256 signature using a
constant-time comparison and rejects events with a timestamp older than five
minutes, which prevents both forgery and replay.

## 7. Application security

| Control | Status |
|---|---|
| Input validation | Zod schemas on all server functions, with length bounds |
| SQL injection | Not applicable — parameterised access via PostgREST; no string-built SQL |
| Authorisation | Every server function runs behind `requireSupabaseAuth` under the caller's own JWT, so RLS is the enforcement boundary even if application logic is wrong |
| XSS | React escapes by default; no `dangerouslySetInnerHTML` in application code |
| Security headers | HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` |
| Content Security Policy | **Report-Only, being tuned before enforcement. Target [DATE].** |
| Dependency management | **[State your process — e.g. Dependabot on the GitHub repo. Turn it on if it is off; it is free and it is a HECVAT question.]** |
| Penetration test | **None to date. [State whether one is planned and when.]** |
| Vulnerability disclosure | `security@launchpadeic.com`; we acknowledge within 3 business days |

## 8. Artificial intelligence

HECVAT 4 added a dedicated AI section in February 2025. Expect these questions.

| Question | Answer |
|---|---|
| Does the product use AI? | Yes. An AI career coach and a roadmap generator. |
| Model and provider | Google Gemini 2.5 Flash, accessed through the Lovable AI gateway. |
| What data is sent | The user's message, plus their profile fields (role, industry, years of experience, career goal) and their roadmap. |
| Is institutional data used for training? | **No. [Obtain and attach written confirmation from Lovable and Google covering retention and training. This is the single most-asked AI question in higher-ed procurement — do not answer it from assumption.]** |
| Retention by the provider | **[CONFIRM with the gateway provider]** |
| Human review of outputs | No. Outputs go straight to the user, labelled as AI-generated. |
| Automated decision-making | None with legal or similarly significant effect. No screening, scoring, ranking, or eligibility determination. |
| User disclosure | Disclosed in the Privacy Policy, in the Terms, at signup via a required acknowledgement checkbox, and persistently at the point of use on the Coach screen. |
| Guardrails | System prompt restricts scope to career topics; declines clinical, legal, financial, and immigration questions; routes crisis language to 988 and campus/EAP resources and stops coaching in that reply. |
| Bias assessment | **None performed. [State honestly; describe any planned review.]** |
| Can it be disabled? | Yes — the institution can be provisioned without AI features. |

## 9. Privacy programme

| | |
|---|---|
| Data sold | **None.** No advertising, no data brokerage, no targeted advertising. |
| Trackers | No third-party advertising or analytics trackers in the application. |
| Universal opt-out / GPC | Nothing to opt out of today; committed to honouring GPC if that changes. |
| Rights fulfilment | Self-serve export and self-serve deletion in-product. Other requests via `privacy@launchpadeic.com`, answered within 45 days. |
| Appeals | Documented appeal path; reviewed by a different person; 45-day response; referral to the NJ Division of Consumer Affairs on denial. |
| Deletion | Enforced by `ON DELETE CASCADE` foreign keys from all 20 user-scoped tables to `auth.users`. Deletion is a database guarantee, not a manual checklist. |
| Consent records | Version of Terms and Privacy Policy accepted, plus timestamps, stored per user. |
| Data protection assessment | **[Required under NJDPA for profiling. Write one covering the roadmap generator and keep it on file.]** |
| FERPA | Where an institution supplies education records we act as a school official under 34 CFR 99.31(a)(1), use data only to provide the service, remain under institutional control, and do not redisclose. |
| HIPAA | **Not applicable.** No PHI is processed; we are neither a covered entity nor a business associate. Clinical use is prohibited by the Terms. |

## 10. Retention and disposal

| Data | Retention |
|---|---|
| Account, profile, activity | Life of the account |
| AI Coach conversations | Until cleared by the user, or account deletion |
| Consent records | Account life + 3 years |
| Safety reports and blocks | 2 years after resolution |
| Admin audit log | 2 years |
| Server logs | 30 days |
| Backups | 30 days, rolling |
| On contract termination | Institutional data deleted or returned within **[30]** days at the institution's election; certificate of destruction on request |

## 11. Availability and continuity

| | |
|---|---|
| Uptime commitment | **[None contractually today. State a target — e.g. 99.5% monthly — only if you are prepared to be held to it.]** |
| Backups | Automated daily by Supabase, **[N]**-day retention |
| Restore testing | **[Have you ever restored one? If not, do it this month and record the date. Reviewers ask for your last successful restore, not your backup policy.]** |
| RTO / RPO | **[State targets]** |
| Status page | **[None today]** |

## 12. Incident response

**Definition.** A security incident is any unauthorised access to, disclosure of,
alteration of, or destruction of personal data, or any event that materially
compromises the confidentiality, integrity, or availability of the service.

**Process.**

1. **Detect & triage** — provider alerts, user or researcher report to
   `security@launchpadeic.com`, or internal discovery. Severity assigned within
   **24 hours**.
2. **Contain** — revoke credentials, rotate keys, disable affected functionality.
3. **Assess** — determine what data, whose data, and how much. Preserve logs.
4. **Notify** —
   - **Institutional customers: within 48 hours** of confirming an incident
     affecting their users, with what is known at that point, before the
     investigation is complete.
   - Affected individuals and regulators as required by law, without unreasonable
     delay. New Jersey's breach statute (N.J.S.A. 56:8-163) requires disclosure
     to affected residents and prior notice to the NJ State Police.
   - Institutional agreements frequently require faster than 48 hours. Whatever
     the contract says, wins.
5. **Remediate & review** — fix the root cause; written post-incident report to
   affected institutions within **30 days**.

**Contacts:** `security@launchpadeic.com` · escalation: **[NAME, PHONE]**

## 13. Compliance posture — stated plainly

| Framework | Status |
|---|---|
| SOC 2 Type II | **Not held.** Our infrastructure providers (Supabase, Cloudflare, Stripe) maintain SOC 2 Type II; their reports are available under NDA from them. We can pursue our own if the institution requires it — expect 9–12 months and significant cost. |
| ISO 27001 | Not held. Same position as above. |
| PCI DSS | SAQ A, via Stripe |
| WCAG 2.1 AA | Partial. See the Accessibility Conformance Report; remediation plan attached. |
| FERPA | Addressed contractually; see the Institutional Rider. |
| HIPAA | Not applicable. |
| NJDPA / state privacy laws | Rights, appeals, and retention implemented; DPA assessment pending. |
| GDPR | Not currently offered to EU data subjects. |

A reviewer will not expect SOC 2 from a company this size. They will expect you to
know that you do not have it and to say so without hedging.
