# Institutional Rider & Data Processing Addendum

**LaunchPad EIC** · Version 2026-09-11
Template for attachment to an institutional agreement.

> **This is a negotiating position, not a finished contract.** A university will
> almost certainly replace parts of it with its own standard rider, and that is
> normal — the value of having this is that it shows you have thought about the
> right things, and it sets the baseline you negotiate down from rather than up
> from.
>
> **Have a New Jersey attorney review §§ 6–10 before you sign anything.** Those
> are the sections where a bad clause costs real money. The rest you can hold your
> own on.

---

This Rider is entered into by **Marina Samuel (d/b/a LaunchPad EIC)** ("Provider") and
**[INSTITUTION]** ("Institution") and forms part of the agreement between them
dated **[DATE]** (the "Agreement") for LaunchPad EIC (the "Service"). Where this
Rider conflicts with the Agreement or with Provider's published Terms of Service,
this Rider controls.

---

## 1. Definitions

**Institutional Data** — any data Institution or its Authorised Users provide to,
or that is generated in, the Service.

**Education Record** — as defined in FERPA, 20 U.S.C. § 1232g and 34 CFR Part 99.

**Personal Data** — information relating to an identified or identifiable
individual.

**Authorised User** — a student, employee, alumnus, or affiliate whom Institution
permits to use the Service.

**Security Incident** — unauthorised access to, disclosure of, alteration of, or
destruction of Institutional Data.

## 2. Roles and ownership

Institution is the controller of Institutional Data. Provider is a processor and
service provider, acting only on Institution's documented instructions and on the
instructions of Authorised Users acting within the Service.

**Institution owns all Institutional Data.** Provider acquires no ownership
interest and no licence beyond what is necessary to deliver the Service.

## 3. Permitted use — and what is prohibited

Provider will use Institutional Data **only** to provide, secure, support, and
maintain the Service.

Provider will **not**:

- sell, rent, or licence Institutional Data;
- use it for advertising, marketing, or targeted advertising;
- use it to build or improve any product other than the Service for Institution;
- **use it to train, fine-tune, or evaluate any artificial intelligence model,**
  and will contractually prohibit its subprocessors from doing so;
- create de-identified, aggregated, or derived datasets for its own commercial
  purposes without Institution's prior written consent;
- redisclose it to any third party except a subprocessor listed under § 5, or
  where compelled by law under § 11.

## 4. FERPA

To the extent Institutional Data constitutes an Education Record:

1. Provider is designated a **school official with a legitimate educational
   interest** under 34 CFR 99.31(a)(1)(i)(B).
2. Provider performs an institutional service for which Institution would
   otherwise use employees.
3. Provider is under Institution's **direct control** with respect to the use and
   maintenance of Education Records.
4. Provider **will not redisclose** Education Records except as permitted by
   34 CFR 99.33(a), and will use them only for the purpose for which disclosed.
5. Provider will refer any request from a student for access to, or amendment of,
   an Education Record to Institution, and will assist Institution in responding.
6. Provider will notify Institution within **[3] business days** of any subpoena
   or legal process seeking Education Records, unless prohibited by law, so
   Institution may seek protection.

## 5. Subprocessors

Provider's current subprocessors:

| Subprocessor | Purpose | Location |
|---|---|---|
| Supabase Inc. | Database, authentication, storage | **[REGION]** |
| Lovable | Application hosting, AI gateway | **[REGION]** |
| Google LLC | AI inference (Gemini), OAuth | **[REGION]** |
| Stripe, Inc. | Payment processing | United States |
| Cloudflare, Inc. | Edge delivery | Global |

Provider will give Institution **[30] days'** written notice before adding or
replacing a subprocessor, and Institution may object on reasonable data-protection
grounds. Provider remains fully liable for its subprocessors' acts and omissions.

Provider will bind each subprocessor to obligations no less protective than this
Rider, including the AI-training prohibition in § 3.

## 6. Security

Provider will maintain administrative, physical, and technical safeguards
appropriate to the sensitivity of Institutional Data, including at minimum:

- encryption in transit (TLS 1.2+) and at rest (AES-256);
- tenant isolation enforced at the database layer through row-level security;
- least-privilege access, limited to personnel with a business need;
- multi-factor authentication for all administrative access **[by DATE]**;
- append-only logging of privileged actions;
- annual review of access rights;
- secure disposal of media and data.

Provider will notify Institution of any material reduction in these safeguards.

## 7. Security incidents

Provider will notify Institution **within 48 hours** of confirming a Security
Incident affecting Institutional Data — sooner where the Agreement requires it —
including what is known at that time, and will provide updates as the
investigation proceeds. Provider will not delay initial notice to complete its
investigation.

Provider will cooperate with Institution's investigation, preserve relevant logs,
and provide a written post-incident report within **[30] days**. Institution
controls any notification to affected individuals, and Provider will not notify
Authorised Users without Institution's prior written approval except where Provider
is independently required by law to do so.

Provider will bear the reasonable costs of notification, credit monitoring, and
regulatory response to the extent the incident arose from Provider's breach of
this Rider. **[Negotiate the cap. Institutions usually want this uncapped; that is
the clause to take to counsel.]**

## 8. Accessibility

Provider will use commercially reasonable efforts to conform the Service to **WCAG
2.1 Level AA**, consistent with Institution's obligations under Title II of the
ADA (28 CFR Part 35, compliance date 26 April 2027 for entities serving a
population of 50,000 or more) and Section 504.

Provider will:

- maintain a current Accessibility Conformance Report and furnish it on request;
- disclose known non-conformances and a remediation timeline;
- remediate a reported barrier that prevents an Authorised User from completing an
  essential task within **[10] business days**, or provide an equally effective
  alternative means of access while remediation is in progress;
- not introduce known new non-conformances in an update.

## 9. Data return and deletion

On termination or expiry, and at Institution's election, Provider will return
Institutional Data in a structured, commonly used, machine-readable format, or
delete it, within **[30] days**, and will certify deletion in writing on request.
Backups will be purged on their ordinary cycle, not to exceed **[30] days**,
during which they remain subject to this Rider.

Individual Authorised Users may delete their own accounts and data at any time
through the Service; that deletion cascades across all associated records.

## 10. Audit and assurance

Provider will, on reasonable notice and no more than once per year, provide:

- its completed HECVAT;
- its current Accessibility Conformance Report;
- available third-party assurance reports for its subprocessors;
- written responses to Institution's reasonable security questionnaires.

Provider does not currently hold a SOC 2 Type II report and does not represent
otherwise. **[If Institution requires one as a condition, negotiate a timeline and
price it — it is 9–12 months and a material cost.]**

## 11. Compelled disclosure

If Provider receives a subpoena, court order, or government demand for
Institutional Data, Provider will, unless legally prohibited, notify Institution
promptly, disclose only what is legally required, and provide reasonable
cooperation if Institution seeks protective relief.

## 12. Not a healthcare service

The Service is not a healthcare service, is not offered for clinical, diagnostic,
or treatment purposes, and does not process protected health information. Provider
is not a covered entity or business associate under HIPAA, and no Business
Associate Agreement is required or offered. Institution will not use the Service
as part of a treatment pathway or route it through student health or counselling
services without a separate written agreement.

## 13. AI disclosure

The Service includes AI features (an AI career coach and an automated roadmap
generator). Provider represents that:

- AI output is general information, labelled as AI-generated at the point of use,
  and is not professional advice;
- the Service performs **no automated decision-making producing legal or similarly
  significant effects** — no screening, scoring, ranking, eligibility
  determination, or evaluation of Authorised Users for any purpose;
- Institutional Data is not used to train any model, by Provider or its
  subprocessors;
- AI features can be disabled for Institution's tenant on request;
- Provider will give **[30] days'** notice before materially changing the AI model
  or provider.

## 14. Insurance

Provider will maintain, at minimum, for the term:

| Coverage | Limit |
|---|---|
| Commercial general liability | **[$1,000,000]** per occurrence |
| Professional liability / E&O | **[$1,000,000]** per claim |
| Cyber liability / data breach | **[$1,000,000]** per claim |

Certificates on request; Institution named as additional insured where customary.

> **Get quotes before you name numbers.** These limits are typical of what a
> public institution asks a small vendor for, and the premiums are a real line
> item you should know before you price the deal.

## 15. Order of precedence

This Rider controls over the Agreement and over Provider's published Terms of
Service and Privacy Policy as to Institutional Data and Authorised Users.

---

**Marina Samuel (d/b/a LaunchPad EIC)**

Signature: ________________________  Name: ____________  Title: ______  Date: ______

**[INSTITUTION]**

Signature: ________________________  Name: ____________  Title: ______  Date: ______
