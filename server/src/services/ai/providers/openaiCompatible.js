import { config } from '../../../config/index.js';
import { AppError } from '../../../utils/errors.js';

/**
 * Provider adapter for any OpenAI-compatible Chat Completions endpoint
 * (OpenAI, OpenRouter, Ollama, LM Studio, Gemini's OpenAI endpoint, ...).
 */
export async function complete({ system, messages, maxTokens, temperature = 0.3, json = true }) {
  const { apiKey, model, baseUrl, timeoutMs } = config.ai;
  const base = baseUrl || 'https://api.openai.com/v1';
  const isOpenAI = base.includes('api.openai.com');

  const makeBody = (useJsonMode) => {
    const body = {
      model,
      messages: [{ role: 'system', content: system }, ...messages],
    };
    if (isOpenAI) body.max_completion_tokens = maxTokens;
    else {
      body.max_tokens = maxTokens;
      body.temperature = temperature;
    }
    if (json && useJsonMode) body.response_format = { type: 'json_object' };
    return body;
  };

  const call = async (useJsonMode) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify(makeBody(useJsonMode)),
        signal: controller.signal,
      });
    } catch (err) {
      if (err?.name === 'AbortError') throw new AppError(504, 'AI_TIMEOUT', 'The AI provider took too long to respond. Please try again.');
      throw new AppError(502, 'AI_UNREACHABLE', 'The AI provider could not be reached.');
    } finally {
      clearTimeout(timer);
    }
  };

  let res = await call(true);
  if (res.status === 400 && json) {
    // Some compatible servers do not support response_format; retry once without it.
    res = await call(false);
  }

  if (!res.ok) throw mapStatus(res.status);

  let data;
  try {
    data = await res.json();
  } catch {
    throw new AppError(502, 'AI_BAD_RESPONSE', 'The AI provider returned an unreadable response.');
  }
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) {
    throw new AppError(502, 'AI_BAD_RESPONSE', 'The AI provider returned an empty response.');
  }
  return {
    text,
    usage: {
      promptTokens: data?.usage?.prompt_tokens || 0,
      completionTokens: data?.usage?.completion_tokens || 0,
      totalTokens: data?.usage?.total_tokens || 0,
    },
  };
}

export function mapStatus(status) {
  if (status === 401 || status === 403) {
    return new AppError(502, 'AI_AUTH', 'The AI provider rejected the configured credentials. Check the server configuration.');
  }
  if (status === 429) return new AppError(429, 'AI_RATE_LIMITED', 'The AI provider is rate limiting requests. Please try again shortly.');
  if (status === 404) return new AppError(502, 'AI_MODEL', 'The AI provider could not find the configured model or endpoint.');
  return new AppError(502, 'AI_PROVIDER_ERROR', 'The AI provider returned an error. Please try again.');
}
