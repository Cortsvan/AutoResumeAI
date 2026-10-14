import { getSupabaseAdmin } from '../supabase/client.js';
import { config, isSupabaseConfigured } from '../../config/index.js';
import { AppError } from '../../utils/errors.js';

// Default model pricing rates per 1,000,000 tokens (USD)
const MODEL_PRICING = {
  'anthropic/claude-3.5-sonnet': { prompt: 3.0, completion: 15.0 },
  'anthropic/claude-3-5-sonnet-20241022': { prompt: 3.0, completion: 15.0 },
  'anthropic/claude-3-haiku': { prompt: 0.25, completion: 1.25 },
  'meta-llama/llama-3.3-70b-instruct': { prompt: 0.12, completion: 0.3 },
  'meta-llama/llama-3.1-8b-instruct': { prompt: 0.05, completion: 0.05 },
  'openai/gpt-4o': { prompt: 2.5, completion: 10.0 },
  'openai/gpt-4o-mini': { prompt: 0.15, completion: 0.6 },
  'google/gemini-flash-1.5': { prompt: 0.075, completion: 0.3 },
  'deepseek/deepseek-chat': { prompt: 0.14, completion: 0.28 },
  'deepseek/deepseek-v4.1-flash': { prompt: 0.14, completion: 0.28 },
};

const DEFAULT_RATES = { prompt: 1.5, completion: 5.0 };

export function estimateCost({ model, promptTokens = 0, completionTokens = 0, explicitCost = null }) {
  if (typeof explicitCost === 'number' && explicitCost >= 0) {
    return explicitCost;
  }
  const cleanModel = String(model || '').toLowerCase().trim();
  const rates = MODEL_PRICING[cleanModel] || DEFAULT_RATES;
  const promptCost = (promptTokens / 1_000_000) * rates.prompt;
  const completionCost = (completionTokens / 1_000_000) * rates.completion;
  return Number((promptCost + completionCost).toFixed(6));
}

/**
 * Atomically validates budget, user quota, and reserves estimated cost.
 * Prevents concurrent requests from overspending the $4 threshold or daily limits.
 */
export async function reserveQuotaAndBudget({ userId, estimatedCost = 0.005 }) {
  if (!isSupabaseConfigured()) {
    // If Supabase is not configured, we cannot verify budget/quota.
    // By requirement: fail safely rather than bypassing the guard.
    throw new AppError(
      503,
      'BUDGET_GUARD_UNAVAILABLE',
      'Database / budget tracking is not configured on the server. AI features cannot proceed safely.',
    );
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new AppError(
      503,
      'BUDGET_GUARD_UNAVAILABLE',
      'Database connection could not be established. Failing safely to protect API budget.',
    );
  }

  try {
    const { data, error } = await supabase.rpc('reserve_quota_and_budget', {
      p_user_id: userId,
      p_estimated_cost: estimatedCost,
    });

    if (error) {
      console.error('Error executing reserve_quota_and_budget:', error);
      throw new AppError(
        503,
        'BUDGET_GUARD_UNAVAILABLE',
        'Could not verify spending budget and quota. Failing safely to protect API budget.',
      );
    }

    if (!data.allowed) {
      if (data.reason === 'GLOBAL_BUDGET_EXCEEDED') {
        throw new AppError(503, 'GLOBAL_BUDGET_EXCEEDED', data.message);
      }
      if (data.reason === 'ACCOUNT_SUSPENDED') {
        throw new AppError(403, 'ACCOUNT_SUSPENDED', data.message);
      }
      if (data.reason === 'QUOTA_EXHAUSTED') {
        throw new AppError(429, 'QUOTA_EXHAUSTED', data.message);
      }
      throw new AppError(403, data.reason || 'FORBIDDEN', data.message || 'Request not permitted.');
    }

    return {
      isAdmin: Boolean(data.is_admin),
      isUnlimited: Boolean(data.is_unlimited || data.is_admin),
      dailyLimit: data.daily_limit,
      todayUsed: data.today_used,
      reservedCost: Number(data.reserved_cost || estimatedCost),
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    console.error('Unexpected reservation error:', err);
    throw new AppError(
      503,
      'BUDGET_GUARD_UNAVAILABLE',
      'Could not verify spending guard status. Failing safely to protect OpenRouter balance.',
    );
  }
}

/**
 * Finalizes actual token usage and estimated/actual cost.
 */
export async function finalizeAiUsage({
  userId,
  model,
  promptTokens = 0,
  completionTokens = 0,
  explicitCost = null,
  reservedCost = 0.005,
  requestType = 'chat',
}) {
  const supabase = getSupabaseAdmin();
  if (!supabase || !userId) return;

  const actualCost = estimateCost({
    model,
    promptTokens,
    completionTokens,
    explicitCost,
  });

  try {
    const { error } = await supabase.rpc('finalize_ai_usage', {
      p_user_id: userId,
      p_model: model,
      p_prompt_tokens: promptTokens,
      p_completion_tokens: completionTokens,
      p_actual_cost: actualCost,
      p_reserved_cost: reservedCost,
      p_request_type: requestType,
    });

    if (error) {
      console.error('Error finalizing AI usage:', error);
    }
  } catch (err) {
    console.error('Error in finalizeAiUsage RPC:', err);
  }
}

/**
 * Releases reserved in-flight cost if an AI call failed before execution.
 */
export async function releaseReservedCost(reservedCost = 0.005) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  try {
    await supabase.rpc('release_reserved_cost', {
      p_reserved_cost: reservedCost,
    });
  } catch (err) {
    console.error('Error releasing reserved cost:', err);
  }
}

/**
 * Retrieves the current status of the global budget guard.
 */
export async function getGlobalBudgetStatus() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return {
      configured: false,
      totalBudgetUsd: config.budget.totalBudgetUsd,
      thresholdUsd: config.budget.thresholdUsd,
      reservedBalanceUsd: config.budget.reservedBalanceUsd,
      totalSpentUsd: 0,
      remainingBeforeThreshold: config.budget.thresholdUsd,
      isPaused: false,
    };
  }

  try {
    const { data, error } = await supabase
      .from('global_budget')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error || !data) {
      return {
        configured: false,
        totalBudgetUsd: config.budget.totalBudgetUsd,
        thresholdUsd: config.budget.thresholdUsd,
        reservedBalanceUsd: config.budget.reservedBalanceUsd,
        totalSpentUsd: 0,
        remainingBeforeThreshold: config.budget.thresholdUsd,
        isPaused: false,
      };
    }

    const totalSpent = Number(data.total_spent_usd || 0);
    const threshold = Number(data.threshold_usd || 4.0);
    const totalBudget = Number(data.total_budget_usd || 5.0);
    const reservedBalance = Number(data.reserved_balance_usd || 1.0);
    const reservedInflight = Number(data.reserved_inflight_usd || 0);
    const remaining = Math.max(0, Number((threshold - totalSpent).toFixed(4)));

    return {
      configured: true,
      totalBudgetUsd: totalBudget,
      thresholdUsd: threshold,
      reservedBalanceUsd: reservedBalance,
      totalSpentUsd: totalSpent,
      reservedInflightUsd: reservedInflight,
      remainingBeforeThreshold: remaining,
      isPaused: Boolean(data.is_paused),
      isThresholdReached: (totalSpent + reservedInflight) >= threshold,
    };
  } catch (err) {
    console.error('Error fetching budget status:', err);
    return {
      configured: false,
      totalBudgetUsd: config.budget.totalBudgetUsd,
      thresholdUsd: config.budget.thresholdUsd,
      reservedBalanceUsd: config.budget.reservedBalanceUsd,
      totalSpentUsd: 0,
      remainingBeforeThreshold: config.budget.thresholdUsd,
      isPaused: false,
    };
  }
}

/**
 * Synchronizes custom budget and threshold limits from server/.env to Supabase.
 */
export async function syncBudgetConfigFromEnv() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  try {
    const { totalBudgetUsd, thresholdUsd, reservedBalanceUsd } = config.budget;
    const { data: existing } = await supabase
      .from('global_budget')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (!existing) {
      await supabase.from('global_budget').insert({
        id: 1,
        total_budget_usd: totalBudgetUsd,
        threshold_usd: thresholdUsd,
        reserved_balance_usd: reservedBalanceUsd,
      });
    } else if (
      existing.total_budget_usd !== totalBudgetUsd ||
      existing.threshold_usd !== thresholdUsd ||
      existing.reserved_balance_usd !== reservedBalanceUsd
    ) {
      await supabase
        .from('global_budget')
        .update({
          total_budget_usd: totalBudgetUsd,
          threshold_usd: thresholdUsd,
          reserved_balance_usd: reservedBalanceUsd,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1);
    }
  } catch (err) {
    // Non-fatal if database is temporarily unavailable during boot
    console.warn('Note: Could not sync budget settings from .env to database:', err.message);
  }
}

