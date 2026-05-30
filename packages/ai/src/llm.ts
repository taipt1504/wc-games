/**
 * LlmGateway — provider-agnostic interface for the 9router LLM gateway (ADR-0005).
 * Concrete impl (OpenAI-compatible client -> 9router; Claude primary, OpenAI fallback)
 * lives in the worker. Content generators here depend only on this interface so they
 * are unit-testable with a fake gateway.
 */
export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmGateway {
  complete(opts: { messages: LlmMessage[]; model?: string; json?: boolean }): Promise<string>;
}

export const AI_DISCLAIMER = 'For entertainment only — not betting advice.';
