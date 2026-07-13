/**
 * Omen — core data contracts.
 *
 * The FailureForecast is the spine of the whole app: the grounding engine
 * produces it, Claude fills it in, and both the Slack (Block Kit) and web
 * (React) surfaces render it. Design-first: everything else conforms to this.
 */

export type EvidenceSource = "internal" | "external";

export interface Evidence {
  source: EvidenceSource;
  label: string;
  url?: string;
  snippet: string;
}

export interface FailureMode {
  id: string;
  title: string;
  /** 1 (rare) – 5 (near-certain). */
  likelihood: number;
  /** 1 (minor) – 5 (catastrophic). */
  impact: number;
  narrative: string;
  evidence: Evidence[];
  mitigation: string;
  owner?: string;
}

export interface DriftSignal {
  addition: string;
  addedBy?: string;
  when?: string;
  linkedFailureId?: string;
}

/**
 * A short adversarial take through one of three lenses.
 * Saboteur   = technical worst-case attack vector
 * Customer   = user-facing trust/UX impact
 * Pessimist  = the org dysfunction everyone is pretending not to see
 */
export type PersonaName = "saboteur" | "customer" | "pessimist";
export interface PersonaInsight {
  persona: PersonaName;
  take: string;
}

/** Whether a grounding leg ran against a live source or fell back to demo seed. */
export type LegSource = "live" | "demo";
export interface Provenance {
  conversation: LegSource;   // Slack channel history
  internalHistory: LegSource; // GitHub via MCP
  externalComparables: LegSource; // Tavily real-time search
}

/** What changed between the previous and current forecast for this channel. */
export interface ForecastDiff {
  scoreDelta: number;           // positive = improved, negative = got worse
  newFailureModeIds: string[];
  resolvedFailureModeIds: string[];
  previousGeneratedAt: string;
}

export interface FailureForecast {
  launchName: string;
  channelId: string;
  /** 0 (ship at your peril) – 100 (clear skies). */
  readinessScore: number;
  failureModes: FailureMode[];
  driftSignals: DriftSignal[];
  /** Adversarial takes through three distinct lenses. */
  personaInsights: PersonaInsight[];
  /** Which legs ran live vs demo — surfaced in the UI so seed is never faked as real. */
  provenance: Provenance;
  /**
   * How many items each grounding leg actually returned. Used for the "N incidents /
   * N comparables" counts so they reflect the real legs — not how many pieces of
   * evidence Claude happened to cite (which conflates Slack quotes with GitHub).
   */
  groundingCounts?: { internalHistory: number; externalComparables: number };
  /** Populated on re-runs — what changed since last forecast. */
  diff?: ForecastDiff;
  generatedAt: string;
}

export interface GroundingContext {
  launchName: string;
  channelId: string;
  conversation: { user: string; text: string; ts: string }[];
  specBaseline?: string;
  internalHistory: Evidence[];
  externalComparables: Evidence[];
  provenance: Provenance;
}
