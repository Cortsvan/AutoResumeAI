import 'dotenv/config';

function int(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function float(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// OpenRouter key takes precedence, then legacy AI_API_KEY
const openrouterKey = process.env.OPENROUTER_API_KEY || '';
const rawApiKey = openrouterKey || process.env.AI_API_KEY || '';
const openrouterModel = process.env.OPENROUTER_MODEL || '';
const rawModel = openrouterModel || process.env.AI_MODEL || 'deepseek/deepseek-v4.1-flash';

// Determine provider: if OPENROUTER_API_KEY or OPENROUTER_MODEL is set, default to openrouter
let provider = (process.env.AI_PROVIDER || '').trim().toLowerCase();
if (!provider && (openrouterKey || openrouterModel)) {
  provider = 'openrouter';
} else if (!provider && rawApiKey) {
  provider = 'openrouter';
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: int('PORT', 8787),
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  limits: {
    maxUploadBytes: int('MAX_UPLOAD_MB', 5) * 1024 * 1024,
    maxMessageChars: int('MAX_MESSAGE_CHARS', 12000),
    maxJobDescriptionChars: int('MAX_JOB_DESCRIPTION_CHARS', 15000),
    maxResumeChars: int('MAX_RESUME_CHARS', 40000),
    maxParagraphs: 1500,
    maxZipEntries: 2000,
    maxUncompressedBytes: 80 * 1024 * 1024,
    maxXmlPartBytes: 25 * 1024 * 1024,
    jsonBodyLimit: '10mb',
  },

  rateLimit: {
    windowMs: int('RATE_LIMIT_WINDOW_MS', 60_000),
    general: int('RATE_LIMIT_GENERAL', 120),
    ai: int('RATE_LIMIT_AI', 20),
    documents: int('RATE_LIMIT_DOCUMENTS', 40),
  },

  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '',
  },

  budget: {
    totalBudgetUsd: float('GLOBAL_BUDGET_USD', 5.0),
    thresholdUsd: float('GLOBAL_THRESHOLD_USD', 4.0),
    reservedBalanceUsd: float('GLOBAL_RESERVED_USD', 1.0),
    defaultDailyLimit: int('DEFAULT_DAILY_REQUEST_LIMIT', 10),
    maxOutputTokens: int('MAX_OUTPUT_TOKENS', 8000),
  },

  ai: {
    provider,
    apiKey: rawApiKey,
    model: rawModel,
    baseUrl: (process.env.AI_BASE_URL || (provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : '')).replace(/\/+$/, ''),
    timeoutMs: int('AI_TIMEOUT_MS', 60_000),
    maxOutputTokens: int('MAX_OUTPUT_TOKENS', 8000),
  },
};

export function isAiConfigured() {
  const { provider: p, apiKey, model } = config.ai;
  if (!p || !apiKey) return false;
  if (p === 'openrouter' || p === 'openai-compatible' || p === 'anthropic') {
    return Boolean(apiKey && model);
  }
  return false;
}

export function isSupabaseConfigured() {
  return Boolean(config.supabase.url && config.supabase.serviceRoleKey);
}
