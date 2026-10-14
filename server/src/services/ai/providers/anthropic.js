import { config } from '../../../config/index.js';
import { AppError } from '../../../utils/errors.js';
import { mapStatus } from './openaiCompatible.js';

/** Provider adapter for Anthropic's Messages API. */
export async function complete({ system, messages, maxTokens, temperature = 0.3 }) {
  const { apiKey, model, baseUrl, timeoutMs } = config.ai;
  const base = baseUrl || 'https://api.anthropic.com/v1';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`${base}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, temperature, system, messages }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw new AppError(504, 'AI_TIMEOUT', 'The AI provider took too long to respond. Please try again.');
    throw new AppError(502, 'AI_UNREACHABLE', 'The AI provider could not be reached.');
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) throw mapStatus(res.status);

  let data;
  try {
    data = await res.json();
  } catch {
    throw new AppError(502, 'AI_BAD_RESPONSE', 'The AI provider returned an unreadable response.');
  }
  const text = (data?.content || [])
    .filter((b) => b?.type === 'text')
    .map((b) => b.text)
    .join('');
  if (!text.trim()) throw new AppError(502, 'AI_BAD_RESPONSE', 'The AI provider returned an empty response.');
  return {
    text,
    usage: {
      promptTokens: data?.usage?.input_tokens || 0,
      completionTokens: data?.usage?.output_tokens || 0,
      totalTokens: (data?.usage?.input_tokens || 0) + (data?.usage?.output_tokens || 0),
    },
  };
}
