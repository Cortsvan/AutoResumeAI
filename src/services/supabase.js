import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Returns the current active session access token for API requests.
 */
export async function getSessionToken() {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
}

/**
 * Fetches the user profile and today's usage from Supabase.
 */
export async function fetchCurrentProfile(userId) {
  if (!supabase || !userId) return null;
  try {
    const todayStr = new Date().toISOString().slice(0, 10);

    const [profileRes, usageRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase
        .from('daily_usage')
        .select('request_count, total_tokens, estimated_cost_usd')
        .eq('user_id', userId)
        .eq('usage_date', todayStr)
        .maybeSingle(),
    ]);

    const profile = profileRes.data || null;
    const usage = usageRes.data || null;

    if (!profile) return null;

    const todayUsed = usage?.request_count || 0;
    const dailyLimit = profile.daily_limit || 10;
    const isUnlimited = Boolean(profile.is_unlimited || profile.role === 'admin');

    return {
      ...profile,
      todayUsed,
      remainingToday: isUnlimited ? null : Math.max(0, dailyLimit - todayUsed),
    };
  } catch (err) {
    console.error('Error fetching profile from Supabase:', err);
    return null;
  }
}
