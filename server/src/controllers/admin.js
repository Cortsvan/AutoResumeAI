import { getSupabaseAdmin } from '../services/supabase/client.js';
import { getGlobalBudgetStatus } from '../services/ai/budgetGuard.js';
import { adminUpdateUserSchema, adminUpdateBudgetSchema } from '../validators/schemas.js';
import { AppError } from '../utils/errors.js';

function parseBody(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new AppError(400, 'INVALID_REQUEST', `Invalid request: ${first?.path?.join('.') || 'body'} ${first?.message || ''}`.trim());
  }
  return result.data;
}

/**
 * Audit log helper
 */
async function logAdminAction(supabase, { adminId, adminEmail, targetUserId, targetUserEmail, action, details }) {
  try {
    await supabase.from('admin_audit_logs').insert({
      admin_id: adminId,
      admin_email: adminEmail,
      target_user_id: targetUserId || null,
      target_user_email: targetUserEmail || null,
      action,
      details: details || {},
    });
  } catch (err) {
    console.error('Failed to write admin audit log:', err);
  }
}

/**
 * GET /api/admin/overview
 * High-level system statistics, global budget guard status, aggregate AI spend.
 */
export async function getOverview(_req, res, next) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return next(new AppError(503, 'DATABASE_UNAVAILABLE', 'Supabase is not configured.'));

  try {
    const budgetStatus = await getGlobalBudgetStatus();

    // Aggregate user counts
    const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: activeUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('account_status', 'active');
    const { count: suspendedUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('account_status', 'suspended');
    const { count: unlimitedUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_unlimited', true);

    // Aggregate AI usage stats
    const { data: usageAgg } = await supabase
      .from('daily_usage')
      .select('request_count, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd');

    let totalRequests = 0;
    let totalTokens = 0;
    let totalCalculatedCost = 0;

    if (Array.isArray(usageAgg)) {
      for (const row of usageAgg) {
        totalRequests += row.request_count || 0;
        totalTokens += row.total_tokens || 0;
        totalCalculatedCost += Number(row.estimated_cost_usd || 0);
      }
    }

    res.json({
      budget: budgetStatus,
      users: {
        total: totalUsers || 0,
        active: activeUsers || 0,
        suspended: suspendedUsers || 0,
        unlimited: unlimitedUsers || 0,
      },
      usage: {
        totalRequests,
        totalTokens,
        totalCalculatedCost: Number(totalCalculatedCost.toFixed(4)),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/users
 * Paginated, searchable, filterable list of registered users.
 */
export async function listUsers(req, res, next) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return next(new AppError(503, 'DATABASE_UNAVAILABLE', 'Supabase is not configured.'));

  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const search = String(req.query.search || '').trim().toLowerCase();
    const status = String(req.query.status || '').trim().toLowerCase();
    const role = String(req.query.role || '').trim().toLowerCase();
    const unlimited = req.query.unlimited;

    let query = supabase.from('profiles').select('*', { count: 'exact' });

    if (search) {
      query = query.or(`email.ilike.%${search}%,id.eq.${search.includes('-') ? search : '00000000-0000-0000-0000-000000000000'}`);
    }
    if (status && (status === 'active' || status === 'suspended')) {
      query = query.eq('account_status', status);
    }
    if (role && (role === 'admin' || role === 'user')) {
      query = query.eq('role', role);
    }
    if (unlimited === 'true') query = query.eq('is_unlimited', true);
    if (unlimited === 'false') query = query.eq('is_unlimited', false);

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data: profiles, count, error } = await query;
    if (error) throw error;

    // Fetch aggregate usage for these user IDs
    const userIds = (profiles || []).map((p) => p.id);
    let usageByUser = {};
    let todayUsageByUser = {};
    const todayStr = new Date().toISOString().slice(0, 10);

    if (userIds.length > 0) {
      const { data: usageData } = await supabase
        .from('daily_usage')
        .select('user_id, usage_date, request_count, total_tokens, estimated_cost_usd')
        .in('user_id', userIds);

      if (Array.isArray(usageData)) {
        for (const row of usageData) {
          if (!usageByUser[row.user_id]) {
            usageByUser[row.user_id] = { requests: 0, tokens: 0, cost: 0 };
          }
          usageByUser[row.user_id].requests += row.request_count || 0;
          usageByUser[row.user_id].tokens += row.total_tokens || 0;
          usageByUser[row.user_id].cost += Number(row.estimated_cost_usd || 0);

          if (row.usage_date === todayStr) {
            todayUsageByUser[row.user_id] = row.request_count || 0;
          }
        }
      }
    }

    const items = (profiles || []).map((p) => {
      const u = usageByUser[p.id] || { requests: 0, tokens: 0, cost: 0 };
      return {
        id: p.id,
        email: p.email,
        role: p.role,
        accountStatus: p.account_status,
        isUnlimited: p.is_unlimited,
        dailyLimit: p.daily_limit,
        createdAt: p.created_at,
        todayRequests: todayUsageByUser[p.id] || 0,
        totalRequests: u.requests,
        totalTokens: u.tokens,
        totalCostUsd: Number(u.cost.toFixed(4)),
      };
    });

    res.json({
      items,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/admin/users/:userId
 * Modify user quotas, unlimited status, or account status.
 */
export async function updateUser(req, res, next) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return next(new AppError(503, 'DATABASE_UNAVAILABLE', 'Supabase is not configured.'));

  const { userId } = req.params;
  const { is_unlimited, daily_limit, account_status, role } = parseBody(adminUpdateUserSchema, req.body);

  try {
    // 1. Verify target user exists
    const { data: targetUser, error: findError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (findError || !targetUser) {
      return next(new AppError(404, 'USER_NOT_FOUND', 'Target user does not exist.'));
    }

    const updates = {};
    const auditDetails = {};

    if (typeof is_unlimited === 'boolean') {
      updates.is_unlimited = is_unlimited;
      auditDetails.is_unlimited = { from: targetUser.is_unlimited, to: is_unlimited };
    }

    if (typeof daily_limit === 'number' && daily_limit >= 0) {
      updates.daily_limit = Math.floor(daily_limit);
      auditDetails.daily_limit = { from: targetUser.daily_limit, to: updates.daily_limit };
    }

    if (account_status === 'active' || account_status === 'suspended') {
      // Prevent admin from suspending themselves
      if (userId === req.user.id && account_status === 'suspended') {
        return next(new AppError(400, 'CANNOT_SUSPEND_SELF', 'You cannot suspend your own administrator account.'));
      }
      updates.account_status = account_status;
      auditDetails.account_status = { from: targetUser.account_status, to: account_status };
    }

    if (role === 'admin' || role === 'user') {
      // Prevent admin from demoting themselves
      if (userId === req.user.id && role === 'user') {
        return next(new AppError(400, 'CANNOT_DEMOTE_SELF', 'You cannot revoke your own administrator role.'));
      }
      updates.role = role;
      auditDetails.role = { from: targetUser.role, to: role };
    }

    // Prevent removal or demotion of the last active administrator
    if (
      (role === 'user' && targetUser.role === 'admin') ||
      (account_status === 'suspended' && targetUser.role === 'admin')
    ) {
      const { count: activeAdminCount, error: countError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin')
        .eq('account_status', 'active');

      if (countError) throw countError;

      if ((activeAdminCount || 0) <= 1) {
        return next(
          new AppError(
            400,
            'CANNOT_DEMOTE_LAST_ADMIN',
            'Cannot demote or suspend the last active administrator. At least one active admin must remain in the system.',
          ),
        );
      }
    }

    if (Object.keys(updates).length === 0) {
      return next(new AppError(400, 'NO_UPDATES', 'No valid update fields provided.'));
    }

    updates.updated_at = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Log administrative action
    await logAdminAction(supabase, {
      adminId: req.user.id,
      adminEmail: req.user.email,
      targetUserId: targetUser.id,
      targetUserEmail: targetUser.email,
      action: 'UPDATE_USER',
      details: auditDetails,
    });

    res.json({
      success: true,
      user: {
        id: updated.id,
        email: updated.email,
        role: updated.role,
        accountStatus: updated.account_status,
        isUnlimited: updated.is_unlimited,
        dailyLimit: updated.daily_limit,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/users/:userId/revoke-sessions
 * Revokes all active sessions for a user via Supabase admin auth.
 */
export async function revokeUserSessions(req, res, next) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return next(new AppError(503, 'DATABASE_UNAVAILABLE', 'Supabase is not configured.'));

  const { userId } = req.params;

  try {
    const { data: targetUser } = await supabase.from('profiles').select('email').eq('id', userId).maybeSingle();
    if (!targetUser) return next(new AppError(404, 'USER_NOT_FOUND', 'Target user does not exist.'));

    // Invalidate refresh tokens and sign out of all devices
    const { error } = await supabase.auth.admin.signOut(userId, 'global');
    if (error) {
      console.warn('Supabase admin signOut warning:', error.message);
    }

    await logAdminAction(supabase, {
      adminId: req.user.id,
      adminEmail: req.user.email,
      targetUserId: userId,
      targetUserEmail: targetUser.email,
      action: 'REVOKE_SESSIONS',
      details: { scope: 'global' },
    });

    res.json({ success: true, message: `Active sessions for ${targetUser.email} revoked.` });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/audit-logs
 * List recent administrative actions.
 */
export async function getAuditLogs(req, res, next) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return next(new AppError(503, 'DATABASE_UNAVAILABLE', 'Supabase is not configured.'));

  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const { data, error } = await supabase
      .from('admin_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    res.json({ logs: data || [] });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/admin/budget
 * Update global budget and threshold settings.
 */
export async function updateBudget(req, res, next) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return next(new AppError(503, 'DATABASE_UNAVAILABLE', 'Supabase is not configured.'));

  const { threshold_usd, hard_stop_threshold_usd, total_budget_usd, reserved_balance_usd, is_paused } = parseBody(
    adminUpdateBudgetSchema,
    req.body,
  );

  try {
    const updates = {};
    const finalThreshold = hard_stop_threshold_usd || threshold_usd;
    if (typeof finalThreshold === 'number' && finalThreshold > 0) updates.threshold_usd = finalThreshold;
    if (typeof total_budget_usd === 'number' && total_budget_usd > 0) updates.total_budget_usd = total_budget_usd;
    if (typeof reserved_balance_usd === 'number' && reserved_balance_usd >= 0) updates.reserved_balance_usd = reserved_balance_usd;
    if (typeof is_paused === 'boolean') updates.is_paused = is_paused;

    if (Object.keys(updates).length === 0) {
      return next(new AppError(400, 'NO_UPDATES', 'No valid budget fields provided.'));
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('global_budget')
      .update(updates)
      .eq('id', 1)
      .select()
      .single();

    if (error) throw error;

    await logAdminAction(supabase, {
      adminId: req.user.id,
      adminEmail: req.user.email,
      action: 'UPDATE_BUDGET',
      details: updates,
    });

    res.json({ success: true, budget: data });
  } catch (err) {
    next(err);
  }
}
