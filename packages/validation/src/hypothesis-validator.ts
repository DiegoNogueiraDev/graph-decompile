export interface Hypothesis {
  id: string;
  type: string;
  value: string;
  confidence: number;
  source: string;
}

export interface ValidatorConfig {
  minConfidence: number;
}

export interface HypothesisResult {
  accepted: boolean;
  hypothesis: Hypothesis;
  confidenceSource: "deterministic" | "genai";
  rejectionReason?: string;
}

const GENAI_SOURCES = new Set(["genai", "llm", "ai"]);

export function validateHypothesis(
  hypothesis: Hypothesis,
  config: ValidatorConfig,
): HypothesisResult {
  const confidenceSource: "deterministic" | "genai" = GENAI_SOURCES.has(hypothesis.source)
    ? "genai"
    : "deterministic";

  if (hypothesis.confidence < config.minConfidence) {
    return {
      accepted: false,
      hypothesis,
      confidenceSource,
      rejectionReason: `confidence ${hypothesis.confidence} below minimum ${config.minConfidence}`,
    };
  }

  return {
    accepted: true,
    hypothesis,
    confidenceSource,
  };
}
