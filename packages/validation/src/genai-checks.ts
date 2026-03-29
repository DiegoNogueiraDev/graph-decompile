import type { ValidationResult, HypothesisValidation, ConfidenceSource } from "./types.js";

const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;

export function validateConfidenceThreshold(
  confidence: number,
  threshold: number = DEFAULT_CONFIDENCE_THRESHOLD,
): boolean {
  return confidence >= threshold;
}

export function validateGenAiOutput(
  data: unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: { safeParse: (data: unknown) => any },
): ValidationResult {
  const parsed = schema.safeParse(data);

  if (parsed.success) {
    return { valid: true, errors: [], warnings: [] };
  }

  const errors = (parsed.error?.issues ?? []).map(
    (issue: { message: string; path: PropertyKey[] }) => ({
      code: "SCHEMA_VALIDATION_FAILED",
      message: issue.message,
      path: issue.path.map(String).join("."),
    }),
  );

  return { valid: false, errors, warnings: [] };
}

export function createHypothesisValidation(
  confidence: number,
  source: ConfidenceSource,
  threshold: number = DEFAULT_CONFIDENCE_THRESHOLD,
): HypothesisValidation {
  if (source === "deterministic") {
    return { accepted: true, confidence, confidenceSource: source };
  }

  const accepted = validateConfidenceThreshold(confidence, threshold);

  return {
    accepted,
    confidence,
    confidenceSource: source,
    ...(accepted
      ? {}
      : {
          rejectionReason: `Confidence ${confidence} is below threshold ${threshold}`,
        }),
  };
}
