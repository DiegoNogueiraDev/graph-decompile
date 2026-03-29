import type { z } from "zod";

export interface LLMProvider {
  name: string;
  generate(prompt: string, options?: LLMRequestOptions): Promise<string>;
}

export interface LLMRequestOptions {
  timeoutMs?: number;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMClientOptions {
  timeoutMs: number;
  maxRetries: number;
}

export interface LLMClient {
  provider: string;
  options: LLMClientOptions;
}

const DEFAULT_OPTIONS: LLMClientOptions = {
  timeoutMs: 30_000,
  maxRetries: 3,
};

export function createLLMClient(
  provider: LLMProvider,
  options?: Partial<LLMClientOptions>,
): LLMClient {
  return {
    provider: provider.name,
    options: { ...DEFAULT_OPTIONS, ...options },
  };
}

type ValidateResult<T> = { ok: true; data: T } | { ok: false; error: string };

export function validateResponse<T>(raw: string, schema: z.ZodType<T>): ValidateResult<T> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Invalid JSON response" };
  }

  const result = schema.safeParse(parsed);
  if (result.success) {
    return { ok: true, data: result.data };
  }

  return {
    ok: false,
    error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
  };
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  baseDelayMs = 100,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt));
      }
    }
  }

  throw lastError;
}
