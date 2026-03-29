import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import {
  type LLMProvider,
  type LLMRequestOptions,
  createLLMClient,
  withRetry,
  validateResponse,
} from "../provider.js";

const TestOutputSchema = z.object({
  answer: z.string(),
  confidence: z.number().min(0).max(1),
});

const mockProvider: LLMProvider = {
  name: "mock",
  generate: vi.fn().mockResolvedValue('{"answer":"test","confidence":0.9}'),
};

describe("LLMProvider interface", () => {
  it("has name and generate method", () => {
    expect(mockProvider.name).toBe("mock");
    expect(typeof mockProvider.generate).toBe("function");
  });
});

describe("createLLMClient", () => {
  it("creates client with default options", () => {
    const client = createLLMClient(mockProvider);
    expect(client.provider).toBe("mock");
    expect(client.options.timeoutMs).toBe(30_000);
    expect(client.options.maxRetries).toBe(3);
  });

  it("accepts custom options", () => {
    const client = createLLMClient(mockProvider, { timeoutMs: 60_000, maxRetries: 5 });
    expect(client.options.timeoutMs).toBe(60_000);
    expect(client.options.maxRetries).toBe(5);
  });
});

describe("validateResponse", () => {
  it("returns parsed data for valid response", () => {
    const result = validateResponse('{"answer":"hello","confidence":0.8}', TestOutputSchema);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.answer).toBe("hello");
      expect(result.data.confidence).toBe(0.8);
    }
  });

  it("returns error for invalid JSON", () => {
    const result = validateResponse("not json{{{", TestOutputSchema);
    expect(result.ok).toBe(false);
  });

  it("returns error for schema mismatch", () => {
    const result = validateResponse('{"wrong":"fields"}', TestOutputSchema);
    expect(result.ok).toBe(false);
  });

  it("returns error for confidence out of range", () => {
    const result = validateResponse('{"answer":"test","confidence":1.5}', TestOutputSchema);
    expect(result.ok).toBe(false);
  });
});

describe("withRetry", () => {
  it("returns on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, 3);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure up to maxRetries", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("fail1"))
      .mockRejectedValueOnce(new Error("fail2"))
      .mockResolvedValue("ok");
    const result = await withRetry(fn, 3);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws after exhausting retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));
    await expect(withRetry(fn, 2)).rejects.toThrow("always fails");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
