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

/**
 * Build a lightweight fetch-based LlmGateway pointing at the 9router OpenAI-compatible
 * endpoint. Returns null when required env vars are absent so callers can fall back to
 * the deterministic preview without crashing.
 *
 * Primary model: env.LLM_MODEL_PRIMARY. On failure retries once with env.LLM_MODEL_FALLBACK.
 */
export function createGatewayFromEnv(env: Record<string, string | undefined>): LlmGateway | null {
  const baseUrl = env['LLM_GATEWAY_BASE_URL'];
  const apiKey = env['LLM_GATEWAY_API_KEY'];
  if (!baseUrl || !apiKey) return null;

  const url = `${baseUrl}/chat/completions`;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };

  async function callModel(messages: LlmMessage[], model: string): Promise<string> {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, messages }),
    });
    if (!res.ok) throw new Error(`LLM gateway ${res.status}`);
    const data = await res.json() as { choices: { message: { content: string } }[] };
    return data.choices[0]?.message?.content ?? '';
  }

  return {
    async complete(opts: { messages: LlmMessage[]; model?: string }): Promise<string> {
      const primary = opts.model ?? env['LLM_MODEL_PRIMARY'] ?? 'claude';
      try {
        return await callModel(opts.messages, primary);
      } catch {
        const fallback = env['LLM_MODEL_FALLBACK'];
        if (!fallback || fallback === primary) throw new Error('LLM primary call failed, no fallback');
        return await callModel(opts.messages, fallback);
      }
    },
  };
}
