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
  likelihood: number;
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

export type PersonaName = "saboteur" | "customer" | "pessimist";
export interface PersonaInsight {
  persona: PersonaName;
  take: string;
}

export interface ForecastDiff {
  scoreDelta: number;
  newFailureModeIds: string[];
  resolvedFailureModeIds: string[];
  previousGeneratedAt: string;
}

export type LegSource = "live" | "demo";
export interface Provenance {
  conversation: LegSource;
  internalHistory: LegSource;
  externalComparables: LegSource;
}

export interface FailureForecast {
  launchName: string;
  channelId: string;
  readinessScore: number;
  failureModes: FailureMode[];
  driftSignals: DriftSignal[];
  personaInsights: PersonaInsight[];
  provenance: Provenance;
  diff?: ForecastDiff;
  generatedAt: string;
}
