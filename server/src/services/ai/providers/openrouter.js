import { config } from '../../../config/index.js';
import { AppError } from '../../../utils/errors.js';

let cachedModels = null;
let lastCatalogFetch = 0;
const CATALOG_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Fetches and caches the active OpenRouter models catalog to verify configured model IDs.
 */
export async function getOpenRouterModels() {
  const now = Date.now();
  if (cachedModels && now - lastCatalogFetch < CATALOG_CACHE_TTL_MS) {
    return cachedModels;
  }

  const apiKey = config.ai.apiKey;
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.data)) {
        cachedModels = json.data;
        lastCatalogFetch = now;
        return cachedModels;
      }
    }
  } catch (err) {
    console.warn('Could not fetch OpenRouter models catalog:', err.message);
  }
  return cachedModels || [];
}

/**
 * Verifies that the configured model exists in OpenRouter's catalog.
 */
export async function verifyModelId(modelId) {
  const models = await getOpenRouterModels();
  if (!models.length) return true; // Catalog unavailable, assume valid
  const found = models.some((m) => m.id === modelId || m.id.toLowerCase() === modelId.toLowerCase());
  return found;
}

/**
 * Provider adapter for OpenRouter with token controls and usage extraction.
 */
export async function complete({ system, messages, maxTokens = 8000, temperature = 0.3, json = true }) {
  const apiKey = config.ai.apiKey;
  const model = config.ai.model || 'deepseek/deepseek-v4.1-flash';
  const timeoutMs = config.ai.timeoutMs || 60000;
  const baseUrl = config.ai.baseUrl || 'https://openrouter.ai/api/v1';

  if (!apiKey) {
    throw new AppError(503, 'AI_NOT_CONFIGURED', 'OPENROUTER_API_KEY is not configured on the server.');
  }

  // Allow up to 8,000 max output tokens for full resume JSON structures
  const effectiveMaxTokens = Math.min(Number(maxTokens) || 8000, 8000);

  const makeBody = (useJsonMode) => {
    const body = {
      model,
      messages: [{ role: 'system', content: system }, ...messages],
      max_tokens: effectiveMaxTokens,
      temperature,
      // For reasoning models (e.g. DeepSeek V4.1 Flash), keep reasoning focused so output tokens aren't consumed by thought traces
      reasoning: { effort: 'low' },
    };
    if (json && useJsonMode) {
      body.response_format = { type: 'json_object' };
    }
    return body;
  };

  const call = async (useJsonMode) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': config.clientOrigins[0] || 'http://localhost:5173',
          'X-Title': 'AutoResumeAI',
        },
        body: JSON.stringify(makeBody(useJsonMode)),
        signal: controller.signal,
      });
    } catch (err) {
      if (err?.name === 'AbortError') {
        throw new AppError(504, 'AI_TIMEOUT', 'OpenRouter took too long to respond. Please try again.');
      }
      throw new AppError(502, 'AI_UNREACHABLE', 'OpenRouter could not be reached.');
    } finally {
      clearTimeout(timer);
    }
  };

  let res = await call(true);
  if (res.status === 400 && json) {
    // Some models on OpenRouter do not support response_format: { type: 'json_object' }
    res = await call(false);
  }

  if (!res.ok) {
    throw mapOpenRouterStatus(res.status, await res.text().catch(() => ''));
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new AppError(502, 'AI_BAD_RESPONSE', 'OpenRouter returned an unreadable response.');
  }

  let text = data?.choices?.[0]?.message?.content;

  // Fallback 1: check if output was returned in reasoning or reasoning_content with JSON
  if (typeof text !== 'string' || !text.trim()) {
    const reasoningText = data?.choices?.[0]?.message?.reasoning || data?.choices?.[0]?.message?.reasoning_content;
    if (typeof reasoningText === 'string' && reasoningText.includes('{')) {
      text = reasoningText;
    }
  }

  // Fallback 2: if response_format json_object produced empty text, retry without response_format constraint
  if ((typeof text !== 'string' || !text.trim()) && json) {
    console.warn(`OpenRouter model ${model} returned empty content with response_format json_object. Retrying without json_object constraint...`);
    const retryRes = await call(false);
    if (retryRes.ok) {
      try {
        const retryData = await retryRes.json();
        const retryText =
          retryData?.choices?.[0]?.message?.content ||
          retryData?.choices?.[0]?.message?.reasoning ||
          retryData?.choices?.[0]?.message?.reasoning_content;
        if (typeof retryText === 'string' && retryText.trim()) {
          text = retryText;
          data = retryData;
        }
      } catch {
        /* ignore retry json parse error */
      }
    }
  }

  if (typeof text !== 'string' || !text.trim()) {
    console.error('OpenRouter empty response diagnostics:', {
      model,
      finishReason: data?.choices?.[0]?.finish_reason,
      message: data?.choices?.[0]?.message,
      usage: data?.usage,
    });
    throw new AppError(502, 'AI_BAD_RESPONSE', 'OpenRouter returned an empty response. Please try again.');
  }

  const promptTokens = data?.usage?.prompt_tokens || 0;
  const completionTokens = data?.usage?.completion_tokens || 0;
  const totalTokens = data?.usage?.total_tokens || promptTokens + completionTokens;
  const cost = typeof data?.usage?.cost === 'number' ? data.usage.cost : (typeof data?.usage?.total_cost === 'number' ? data.usage.total_cost : null);

  return {
    text,
    usage: {
      promptTokens,
      completionTokens,
      totalTokens,
      cost,
    },
  };
}

export function mapOpenRouterStatus(status, responseBodyText = '') {
  if (status === 401 || status === 403) {
    return new AppError(502, 'AI_AUTH', 'OpenRouter rejected the configured API credentials. Check OPENROUTER_API_KEY in server/.env.');
  }
  if (status === 402) {
    return new AppError(503, 'INSUFFICIENT_CREDITS', 'OpenRouter API balance is depleted. Please top up your OpenRouter account.');
  }
  if (status === 429) {
    return new AppError(429, 'AI_RATE_LIMITED', 'OpenRouter rate limit reached. Please wait a moment and try again.');
  }
  if (status === 404) {
    return new AppError(502, 'AI_MODEL', `The configured OpenRouter model (${config.ai.model}) was not found or is currently unavailable.`);
  }

  let errorMsg = 'OpenRouter returned an error. Please try again.';
  try {
    const parsed = JSON.parse(responseBodyText);
    if (parsed?.error?.message) {
      errorMsg = `OpenRouter error: ${parsed.error.message}`;
    }
  } catch {
    // Keep default message
  }

  return new AppError(502, 'AI_PROVIDER_ERROR', errorMsg);
}
