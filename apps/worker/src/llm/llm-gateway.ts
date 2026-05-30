import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * LlmGateway — bọc 9router (OpenAI-compatible) sau 1 interface (ADR-0005).
 * 9router đã self-host; kết nối qua env LLM_GATEWAY_*. Fallback Claude->OpenAI
 * do 9router xử lý nội bộ (combo) hoặc đổi model qua LLM_MODEL_FALLBACK.
 */
@Injectable()
export class LlmGateway {
  private readonly log = new Logger(LlmGateway.name);
  private readonly client = new OpenAI({
    baseURL: process.env.LLM_GATEWAY_BASE_URL ?? 'http://localhost:20128/v1',
    apiKey: process.env.LLM_GATEWAY_API_KEY ?? 'sk-none',
  });

  async complete(opts: {
    messages: LlmMessage[];
    model?: string;
    json?: boolean;
  }): Promise<string> {
    const model = opts.model ?? process.env.LLM_MODEL_PRIMARY ?? 'claude';
    const res = await this.client.chat.completions.create({
      model,
      messages: opts.messages,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    });
    return res.choices[0]?.message?.content ?? '';
    // TODO: log AIJob (provider, tokens, cost, latency) — Data/AI SD §5.
  }
}
