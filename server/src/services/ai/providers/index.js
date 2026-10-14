import { config, isAiConfigured } from '../../../config/index.js';
import { AppError } from '../../../utils/errors.js';
import * as openai from './openaiCompatible.js';
import * as anthropic from './anthropic.js';
import * as openrouter from './openrouter.js';

const PROVIDERS = {
  openrouter,
  'openai-compatible': openai,
  anthropic,
};

/**
 * Single entry point for model calls. To add a provider, create an adapter exporting
 * `complete({ system, messages, maxTokens, temperature, json })` and register it above.
 * Returns { text, usage: { promptTokens, completionTokens, totalTokens, cost } }.
 */
export async function completeJson({ system, messages, maxTokens }) {
  if (!isAiConfigured()) {
    throw new AppError(503, 'AI_NOT_CONFIGURED', 'No AI provider is configured on the server.');
  }
  const provider = PROVIDERS[config.ai.provider];
  if (!provider) throw new AppError(503, 'AI_NOT_CONFIGURED', 'The configured AI provider is not supported.');
  return provider.complete({
    system,
    messages,
    maxTokens: maxTokens || config.ai.maxOutputTokens,
    json: true,
  });
}

export function providerInfo() {
  return isAiConfigured()
    ? { configured: true, provider: config.ai.provider, model: config.ai.model }
    : { configured: false };
}
