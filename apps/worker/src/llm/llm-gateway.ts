import { Injectable, Logger } from '@nestjs/common';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * LlmGateway — 9router (OpenAI-compatible) qua 1 interface (ADR-0005).
 * Dùng plain `fetch` (KHÔNG dùng OpenAI SDK): SDK gắn header User-Agent/x-stainless-* khiến
 * WAF trước 9router chặn (403 "request blocked"). Plain fetch + 2 header tối thiểu thì qua được —
 * khớp đúng cách @wc/ai `createGatewayFromEnv` gọi. Fallback model qua LLM_MODEL_FALLBACK.
 */
@Injectable()
export class LlmGateway {
  private readonly log = new Logger(LlmGateway.name);
  private readonly baseUrl = process.env.LLM_GATEWAY_BASE_URL ?? 'http://localhost:20128/v1';
  private readonly apiKey = process.env.LLM_GATEWAY_API_KEY ?? 'sk-none';

  private async call(messages: LlmMessage[], model: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model, messages }),
    });
    if (!res.ok) throw new Error(`LLM gateway ${res.status}`);
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    return data.choices[0]?.message?.content ?? '';
  }

  async complete(opts: { messages: LlmMessage[]; model?: string; json?: boolean }): Promise<string> {
    const primary = opts.model ?? process.env.LLM_MODEL_PRIMARY ?? 'claude';
    try {
      return await this.call(opts.messages, primary);
    } catch (err) {
      const fallback = process.env.LLM_MODEL_FALLBACK;
      if (!fallback || fallback === primary) throw err;
      this.log.warn(`LLM ${primary} failed (${(err as Error).message}); retrying ${fallback}`);
      return this.call(opts.messages, fallback);
    }
  }
}
