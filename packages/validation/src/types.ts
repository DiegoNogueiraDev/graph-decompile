export interface ValidationError {
  code: string;
  message: string;
  path?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  path?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export type ConfidenceSource = "deterministic" | "genai";

export interface HypothesisValidation {
  accepted: boolean;
  confidence: number;
  confidenceSource: ConfidenceSource;
  rejectionReason?: string;
}
