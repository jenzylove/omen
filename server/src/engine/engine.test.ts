/**
 * Unit tests for the scoring + diff logic — the two pure functions that decide
 * what the whole UI shows. Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeReadinessScore } from "./forecast.js";
import { computeDiff } from "./index.js";
import type { FailureForecast, FailureMode } from "../types.js";

function mode(id: string, likelihood: number, impact: number): FailureMode {
  return { id, title: id, likelihood, impact, narrative: "", evidence: [], mitigation: "" };
}

// ── computeReadinessScore ─────────────────────────────────────────────────────

test("readiness is 100 when there are no failure modes", () => {
  assert.equal(computeReadinessScore([]), 100);
});

test("readiness drops as severity rises", () => {
  const low = computeReadinessScore([mode("a", 1, 1)]);
  const high = computeReadinessScore([mode("a", 5, 5)]);
  assert.ok(high < low, "more severe risk => lower readiness");
});

test("readiness is clamped to the 0–100 range", () => {
  const many = Array.from({ length: 10 }, (_, i) => mode(`m${i}`, 5, 5));
  const score = computeReadinessScore(many);
  assert.ok(score >= 0 && score <= 100, `score ${score} within bounds`);
  assert.equal(score, 0, "overwhelming risk floors at 0");
});

test("readiness is a whole number", () => {
  const score = computeReadinessScore([mode("a", 3, 4)]);
  assert.equal(Number.isInteger(score), true);
});

// ── computeDiff ───────────────────────────────────────────────────────────────

function forecast(score: number, ids: string[], generatedAt = "2026-07-01T00:00:00Z"): FailureForecast {
  return {
    launchName: "x",
    channelId: "c",
    readinessScore: score,
    failureModes: ids.map((id) => mode(id, 3, 3)),
    driftSignals: [],
    personaInsights: [],
    provenance: { conversation: "demo", internalHistory: "demo", externalComparables: "demo" },
    generatedAt,
  };
}

test("diff reports a positive delta when readiness improves", () => {
  const d = computeDiff(forecast(40, ["a"]), forecast(70, ["a"]));
  assert.equal(d.scoreDelta, 30);
});

test("diff reports a negative delta when readiness worsens", () => {
  const d = computeDiff(forecast(70, ["a"]), forecast(40, ["a"]));
  assert.equal(d.scoreDelta, -30);
});

test("diff detects new and resolved failure modes", () => {
  const prev = forecast(50, ["a", "b"]);
  const next = forecast(50, ["b", "c"]);
  const d = computeDiff(prev, next);
  assert.deepEqual(d.newFailureModeIds, ["c"], "c is new");
  assert.deepEqual(d.resolvedFailureModeIds, ["a"], "a was resolved");
});

test("diff carries the previous timestamp", () => {
  const prev = forecast(50, ["a"], "2026-06-30T12:00:00Z");
  const d = computeDiff(prev, forecast(50, ["a"]));
  assert.equal(d.previousGeneratedAt, "2026-06-30T12:00:00Z");
});
