import { createClient } from '@supabase/supabase-js';
import { config, isSupabaseConfigured } from '../../config/index.js';

let supabaseClient = null;

export function getSupabaseAdmin() {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!supabaseClient) {
    supabaseClient = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseClient;
}

/**
 * Validates a JWT Bearer token against Supabase Auth.
 * Returns the authenticated user object or null.
 */
export async function verifySupabaseToken(token) {
  const supabase = getSupabaseAdmin();
  if (!supabase || !token) return null;

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch (err) {
    console.error('Error verifying token with Supabase:', err.message);
    return null;
  }
}

/**
 * Fetches user profile from public.profiles table.
 */
export async function getUserProfile(userId) {
  const supabase = getSupabaseAdmin();
  if (!supabase || !userId) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user profile:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('Error querying profile:', err.message);
    return null;
  }
}

/**
 * Fetches today's usage for a user (UTC date).
 */
export async function getUserTodayUsage(userId) {
  const supabase = getSupabaseAdmin();
  if (!supabase || !userId) return { requestCount: 0, totalTokens: 0, estimatedCostUsd: 0 };

  const todayStr = new Date().toISOString().slice(0, 10);
  try {
    const { data } = await supabase
      .from('daily_usage')
      .select('request_count, total_tokens, estimated_cost_usd')
      .eq('user_id', userId)
      .eq('usage_date', todayStr)
      .maybeSingle();

    return {
      requestCount: data?.request_count || 0,
      totalTokens: data?.total_tokens || 0,
      estimatedCostUsd: Number(data?.estimated_cost_usd || 0),
    };
  } catch {
    return { requestCount: 0, totalTokens: 0, estimatedCostUsd: 0 };
  }
}
