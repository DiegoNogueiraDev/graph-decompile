export interface HypothesisInput {
  id: string;
  type: string;
  value: string;
  confidence: number;
  source: string;
}

export interface RankingConfig {
  threshold: number;
}

export interface RankedHypothesis {
  hypothesis: HypothesisInput;
  score: number;
  accepted: boolean;
  justification: string;
}

export interface RankingResult {
  ranked: RankedHypothesis[];
  accepted: RankedHypothesis[];
  rejected: RankedHypothesis[];
  promoted: HypothesisInput | null;
}

export function rankHypotheses(
  hypotheses: HypothesisInput[],
  config: RankingConfig,
): RankingResult {
  const ranked: RankedHypothesis[] = hypotheses
    .map((h) => {
      const accepted = h.confidence >= config.threshold;
      return {
        hypothesis: h,
        score: h.confidence,
        accepted,
        justification: accepted
          ? `accepted: confidence ${h.confidence} >= threshold ${config.threshold}`
          : `rejected: confidence ${h.confidence} < threshold ${config.threshold}`,
      };
    })
    .sort((a, b) => b.score - a.score);

  const accepted = ranked.filter((r) => r.accepted);
  const rejected = ranked.filter((r) => !r.accepted);
  const promoted = accepted.length > 0 ? accepted[0].hypothesis : null;

  return { ranked, accepted, rejected, promoted };
}
