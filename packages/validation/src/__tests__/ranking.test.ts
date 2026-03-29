import { describe, it, expect } from "vitest";
import {
  rankHypotheses,
  type RankedHypothesis,
  type RankingConfig,
} from "../ranking.js";

const defaultConfig: RankingConfig = { threshold: 0.6 };

describe("rankHypotheses", () => {
  it("ranks hypotheses by score descending", () => {
    const hypotheses = [
      { id: "h1", type: "name", value: "foo", confidence: 0.7, source: "genai" },
      { id: "h2", type: "name", value: "bar", confidence: 0.9, source: "genai" },
      { id: "h3", type: "name", value: "baz", confidence: 0.5, source: "genai" },
    ];
    const result = rankHypotheses(hypotheses, defaultConfig);
    expect(result.ranked[0].hypothesis.id).toBe("h2");
    expect(result.ranked[1].hypothesis.id).toBe("h1");
  });

  it("discards hypotheses below threshold", () => {
    const hypotheses = [
      { id: "h1", type: "name", value: "good", confidence: 0.8, source: "genai" },
      { id: "h2", type: "name", value: "bad", confidence: 0.3, source: "genai" },
      { id: "h3", type: "name", value: "meh", confidence: 0.5, source: "genai" },
    ];
    const result = rankHypotheses(hypotheses, defaultConfig);
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toHaveLength(2);
  });

  it("promotes best hypothesis", () => {
    const hypotheses = [
      { id: "h1", type: "name", value: "main", confidence: 0.95, source: "genai" },
      { id: "h2", type: "name", value: "entry", confidence: 0.7, source: "genai" },
    ];
    const result = rankHypotheses(hypotheses, defaultConfig);
    expect(result.promoted?.id).toBe("h1");
  });

  it("records justification for each hypothesis", () => {
    const hypotheses = [
      { id: "h1", type: "name", value: "ok", confidence: 0.8, source: "genai" },
      { id: "h2", type: "name", value: "bad", confidence: 0.2, source: "genai" },
    ];
    const result = rankHypotheses(hypotheses, defaultConfig);
    expect(result.ranked[0].justification).toContain("accepted");
    expect(result.ranked[1].justification).toContain("rejected");
  });

  it("returns null promoted when all rejected", () => {
    const hypotheses = [
      { id: "h1", type: "name", value: "bad", confidence: 0.1, source: "genai" },
    ];
    const result = rankHypotheses(hypotheses, defaultConfig);
    expect(result.promoted).toBeNull();
  });

  it("uses custom threshold", () => {
    const hypotheses = [
      { id: "h1", type: "name", value: "ok", confidence: 0.7, source: "genai" },
    ];
    const result = rankHypotheses(hypotheses, { threshold: 0.8 });
    expect(result.accepted).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
  });
});
