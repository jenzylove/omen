/**
 * Demo fixtures — realistic seeded forecasts for the demo workspace.
 *
 * Three forecasts at different readiness levels so the dashboard looks
 * lived-in from second one. The seed script loads these into the store on startup.
 */
import type { FailureForecast, GroundingContext } from "../types.js";

// ── Grounding context (used as fallback when live Slack read fails) ──────────

export const SAMPLE_CONTEXT: GroundingContext = {
  launchName: "Payments v2 launch",
  channelId: "C0DEMO",
  conversation: [
    { user: "maya", text: "Kickoff: Payments v2 = swap Stripe for the new processor. Scope is JUST the checkout path.", ts: "1" },
    { user: "raj",  text: "While we're in there can we add SSO for the merchant dashboard?", ts: "2" },
    { user: "maya", text: "sure, makes sense", ts: "3" },
    { user: "lee",  text: "and SCIM provisioning so enterprise can self-serve", ts: "4" },
    { user: "raj",  text: "we're shipping Friday btw", ts: "5" },
  ],
  specBaseline: "Payments v2: replace payment processor on the checkout path only. No auth changes.",
  internalHistory: [
    {
      source: "internal",
      label: "March 14 auth outage",
      url: "https://github.com/acme/infra/issues/482",
      snippet: "Last-minute auth change shipped Friday; token refresh bug took checkout down for 3h.",
    },
    {
      source: "internal",
      label: "PR #1203 — processor swap",
      url: "https://github.com/acme/payments/pull/1203",
      snippet: "No integration tests on the refund path; reviewer flagged it, merged anyway.",
    },
  ],
  externalComparables: [
    {
      source: "external",
      label: "Stripe→Adyen migration postmortem (2023)",
      snippet: "Dual-writing during cutover missed edge-case currencies; 0.4% of charges silently failed.",
    },
  ],
  provenance: { conversation: "demo", internalHistory: "demo", externalComparables: "demo" },
};

/** Every seed forecast is demo data. */
const DEMO_PROVENANCE = {
  conversation: "demo",
  internalHistory: "demo",
  externalComparables: "demo",
} as const;

// ── Seed forecasts ───────────────────────────────────────────────────────────

export const SAMPLE_FORECAST: FailureForecast = {
  launchName: "Payments v2 launch",
  channelId: "C0DEMO",
  readinessScore: 28,
  driftSignals: [
    { addition: "SSO for merchant dashboard", addedBy: "raj", when: "2", linkedFailureId: "fm-auth" },
    { addition: "SCIM provisioning", addedBy: "lee", when: "4", linkedFailureId: "fm-auth" },
  ],
  failureModes: [
    {
      id: "fm-auth",
      title: "Auth changes bundled into a payments launch",
      likelihood: 4,
      impact: 5,
      narrative:
        "Scope started as checkout-only, but SSO + SCIM quietly pulled auth into the release. Your March 14 outage started exactly this way — a Friday auth change with a token-refresh bug that took checkout down for 3 hours. Shipping both at once repeats that pattern.",
      evidence: [
        { source: "internal", label: "March 14 auth outage", url: "https://github.com/acme/infra/issues/482", snippet: "Friday auth change → token refresh bug → 3h checkout outage." },
      ],
      mitigation: "Split SSO/SCIM into a separate release after payments cutover. Do not ship auth + payments on the same day.",
      owner: "maya",
    },
    {
      id: "fm-refund",
      title: "Untested refund path during processor swap",
      likelihood: 3,
      impact: 4,
      narrative:
        "PR #1203 shipped with no integration tests on refunds — a reviewer flagged it and it merged anyway. Comparable migrations silently failed a fraction of charges on edge-case currencies during cutover.",
      evidence: [
        { source: "internal", label: "PR #1203", url: "https://github.com/acme/payments/pull/1203", snippet: "No integration tests on the refund path; merged despite reviewer flag." },
        { source: "external", label: "Stripe→Adyen postmortem (2023)", snippet: "Cutover missed edge-case currencies; 0.4% of charges silently failed." },
      ],
      mitigation: "Add integration tests for refunds + a dual-write reconciliation check before cutover.",
    },
    {
      id: "fm-friday",
      title: "Friday ship with no rollback window",
      likelihood: 4,
      impact: 3,
      narrative:
        "The launch is set for Friday. Your last Friday-ship incident had nobody around to roll back over the weekend, extending impact. A Friday payments cutover concentrates risk when the fewest people are watching.",
      evidence: [
        { source: "internal", label: "March 14 auth outage", snippet: "Friday ship; limited weekend coverage extended time-to-recovery." },
      ],
      mitigation: "Move cutover to Tuesday, or staff a weekend on-call with a tested one-command rollback.",
    },
  ],
  personaInsights: [
    {
      persona: "saboteur",
      take: "My attack vector is the Friday SSO cutover. I'd wait for the token-refresh to propagate, hit checkout at 6pm, and watch the on-call rotation scramble to find someone who understands both the new processor and the auth layer. Nobody will. The blast radius is total checkout for the weekend.",
    },
    {
      persona: "customer",
      take: "I'm a merchant trying to process a refund on Saturday morning and getting a 500. No error message, no ETA, no support response until Monday. I'm filing a chargeback and never using this processor again. The silent refund failure is the one that ends relationships.",
    },
    {
      persona: "pessimist",
      take: "The real problem isn't the code — it's that Raj said 'shipping Friday' in a Slack message and everyone silently agreed because nobody wants to be the one who delays a launch. The scope tripled and the date didn't move. That's the dysfunction. The technical failures are just the receipt.",
    },
  ],
  provenance: DEMO_PROVENANCE,
  generatedAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(), // 18 min ago
};

export const SEED_FORECAST_2: FailureForecast = {
  launchName: "Mobile app v3.2 release",
  channelId: "C0DEMO2",
  readinessScore: 61,
  driftSignals: [
    { addition: "Dark mode (requested by CEO on Tuesday)", addedBy: "priya", linkedFailureId: "fm-dark" },
  ],
  failureModes: [
    {
      id: "fm-dark",
      title: "Dark mode added 3 days before release with no QA pass",
      likelihood: 3,
      impact: 3,
      narrative:
        "Dark mode was scoped in after CEO request — no QA cycle, no accessibility audit, no regression test against the existing theme system. Last-minute UI changes have caused visual regressions in v3.0 and v3.1. The pattern is consistent.",
      evidence: [
        { source: "internal", label: "v3.1 regression", snippet: "Last-minute theme change caused colour contrast failures on iOS 16; 2.3k users reported unreadable text." },
      ],
      mitigation: "Gate dark mode behind a feature flag; ship it in v3.3 with a full QA pass.",
      owner: "priya",
    },
    {
      id: "fm-store",
      title: "App Store review latency may miss the launch window",
      likelihood: 3,
      impact: 4,
      narrative:
        "Apple's average review time is 24-48h, but the team is targeting a Monday announcement. If the binary is submitted Friday, a review rejection pushes the launch past the announced date — a public commitment already made.",
      evidence: [
        { source: "external", label: "App Store review SLA (2024)", snippet: "Average 24h but spikes to 48-72h around holiday weekends and major iOS releases." },
      ],
      mitigation: "Submit the binary by Wednesday to build in a 48h rejection/resubmission buffer before Monday.",
    },
  ],
  personaInsights: [
    {
      persona: "saboteur",
      take: "I'd time my attack to the App Store submission window. Submit one rejection-triggering flag in the binary on Thursday — the team resubmits Friday, Apple reviews Monday, the launch announcement lands before the app is actually live. The damage is reputational, not technical.",
    },
    {
      persona: "customer",
      take: "I see the announcement, go to the App Store, and the update isn't there. I come back the next day — still nothing. By the time it ships, the moment is gone and I've already forgotten why I was excited.",
    },
    {
      persona: "pessimist",
      take: "The CEO asked for dark mode in a Slack message on Tuesday and it's now in the release. Nobody said no. That's the org problem — a verbal request in a channel becomes a committed feature with zero process. This will happen again in v3.3.",
    },
  ],
  provenance: DEMO_PROVENANCE,
  generatedAt: new Date(Date.now() - 1000 * 60 * 52).toISOString(), // 52 min ago
};

export const SEED_FORECAST_3: FailureForecast = {
  launchName: "API rate limiting rollout",
  channelId: "C0DEMO3",
  readinessScore: 79,
  driftSignals: [],
  failureModes: [
    {
      id: "fm-partner",
      title: "High-volume partners not notified — will hit limits on day one",
      likelihood: 3,
      impact: 4,
      narrative:
        "Rate limiting will be enforced at 1000 req/min. Three partners (Zapier, Make, Pipedream) currently spike above this during business hours. They were not in the notification list. Day-one enforced limits will break their integrations silently — no 429 handling in their connectors.",
      evidence: [
        { source: "internal", label: "Partner traffic analysis #PR-892", snippet: "Zapier peaks at 1400 req/min between 9-11am EST; Make at 1100 req/min." },
      ],
      mitigation: "Email the three high-volume partners 72h before enforcement with their current usage, the new limit, and a grace-period extension offer.",
    },
  ],
  personaInsights: [
    {
      persona: "saboteur",
      take: "I don't need to do anything — Zapier's connector already doesn't handle 429s. When limits enforce, their users' zaps will silently fail and they'll blame Zapier, who will blame you. The support escalation writes itself.",
    },
    {
      persona: "customer",
      take: "My automation stops working with no explanation. I file a ticket with Zapier, they say it's your API, I file a ticket with you. Three days later I get an email saying I need to 'optimise my usage.' I churn.",
    },
    {
      persona: "pessimist",
      take: "The partner list was pulled from the CRM, but the CRM hasn't been updated since Q2. The three partners who will be most affected aren't in the system as 'high-volume' because that field was never filled in. The process broke before the limits even went live.",
    },
  ],
  provenance: DEMO_PROVENANCE,
  generatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2h ago
};
