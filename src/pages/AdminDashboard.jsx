import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, toast, setAuthModalOpen } from '../app/store.js';
import { api } from '../services/api.js';
import { Button } from '../components/ui/Button.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Users,
  DollarSign,
  Cpu,
  RefreshCw,
  Search,
  Filter,
  ArrowLeft,
  Infinity as InfinityIcon,
  Ban,
  CheckCircle,
  KeyRound,
  LogOut,
  AlertTriangle,
  Sliders,
  History,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export function AdminDashboard() {
  const navigate = useNavigate();
  const auth = useStore((s) => s.auth);
  const user = auth.user;
  const profile = auth.profile;

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [userTotal, setUserTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [auditLogs, setAuditLogs] = useState([]);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [unlimitedFilter, setUnlimitedFilter] = useState('');

  // Modals & Action States
  const [actionLoading, setActionLoading] = useState(false);
  const [editLimitUser, setEditLimitUser] = useState(null);
  const [newLimitVal, setNewLimitVal] = useState(10);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [budgetForm, setBudgetForm] = useState({
    total_budget_usd: 5.0,
    hard_stop_threshold_usd: 4.0,
    reserved_balance_usd: 1.0,
  });

  const isAdmin = profile?.role === 'admin';

  // Load all dashboard data
  const fetchData = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const [ovData, usersData, logsData] = await Promise.all([
        api.admin.getOverview(),
        api.admin.listUsers({
          page,
          limit: 10,
          search: search.trim() || undefined,
          status: statusFilter || undefined,
          unlimited: unlimitedFilter || undefined,
        }),
        api.admin.getAuditLogs(30),
      ]);

      setOverview(ovData);
      setUsers(usersData.users || []);
      setUserTotal(usersData.total || 0);
      setTotalPages(usersData.totalPages || 1);
      setAuditLogs(logsData.logs || []);

      if (ovData?.budget) {
        setBudgetForm({
          total_budget_usd: ovData.budget.total_budget_usd,
          hard_stop_threshold_usd: ovData.budget.hard_stop_threshold_usd,
          reserved_balance_usd: ovData.budget.reserved_balance_usd,
        });
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
      toast(err.message || 'Error loading administrator dashboard.', 'error');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, page, search, statusFilter, unlimitedFilter]);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [fetchData, isAdmin]);

  // Handle User Entitlement: Toggle Unlimited
  const handleToggleUnlimited = async (targetUser) => {
    const nextVal = !targetUser.is_unlimited;
    const confirmMsg = nextVal
      ? `Grant unlimited personal AI usage to ${targetUser.email}? They will bypass daily request limits (global spending guard remains active).`
      : `Revoke unlimited usage from ${targetUser.email}? They will immediately return to their daily limit of ${targetUser.daily_limit} requests.`;

    if (!window.confirm(confirmMsg)) return;

    setActionLoading(true);
    try {
      await api.admin.updateUser(targetUser.id, { is_unlimited: nextVal });
      toast(
        nextVal
          ? `Granted unlimited access to ${targetUser.email}`
          : `Revoked unlimited access from ${targetUser.email}`,
        'ok',
      );
      fetchData();
    } catch (err) {
      toast(err.message || 'Failed to update entitlement', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle User Status: Suspend or Reactivate
  const handleToggleSuspend = async (targetUser) => {
    const nextStatus = targetUser.account_status === 'suspended' ? 'active' : 'suspended';
    const confirmMsg =
      nextStatus === 'suspended'
        ? `Suspend account ${targetUser.email}? They will be blocked from making all AI requests.`
        : `Reactivate account ${targetUser.email}?`;

    if (!window.confirm(confirmMsg)) return;

    setActionLoading(true);
    try {
      await api.admin.updateUser(targetUser.id, { account_status: nextStatus });
      toast(`User status updated to ${nextStatus}`, 'ok');
      fetchData();
    } catch (err) {
      toast(err.message || 'Failed to update user status', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Role Change: Promote / Demote admin
  const handleToggleRole = async (targetUser) => {
    const nextRole = targetUser.role === 'admin' ? 'user' : 'admin';
    const confirmMsg =
      nextRole === 'admin'
        ? `Promote ${targetUser.email} to administrator? They will gain full control of this dashboard.`
        : `Remove administrator role from ${targetUser.email}?`;
    if (!window.confirm(confirmMsg)) return;

    setActionLoading(true);
    try {
      await api.admin.updateUser(targetUser.id, { role: nextRole });
      toast(`${targetUser.email} is now ${nextRole === 'admin' ? 'an administrator' : 'a standard user'}`, 'ok');
      fetchData();
    } catch (err) {
      toast(err.message || 'Failed to update role', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Daily Quota Save
  const handleSaveDailyLimit = async () => {
    if (!editLimitUser) return;
    const limitNum = parseInt(newLimitVal, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
      toast('Please enter a valid limit between 1 and 1000.', 'warn');
      return;
    }

    setActionLoading(true);
    try {
      await api.admin.updateUser(editLimitUser.id, { daily_limit: limitNum });
      toast(`Updated daily limit to ${limitNum} for ${editLimitUser.email}`, 'ok');
      setEditLimitUser(null);
      fetchData();
    } catch (err) {
      toast(err.message || 'Failed to update quota', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Session Revocation
  const handleRevokeSessions = async (targetUser) => {
    if (!window.confirm(`Revoke all active sessions for ${targetUser.email}?`)) return;

    setActionLoading(true);
    try {
      await api.admin.revokeSessions(targetUser.id);
      toast(`Sessions revoked for ${targetUser.email}`, 'ok');
      fetchData();
    } catch (err) {
      toast(err.message || 'Failed to revoke sessions', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Budget Settings Save
  const handleSaveBudget = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await api.admin.updateBudget({
        total_budget_usd: parseFloat(budgetForm.total_budget_usd),
        hard_stop_threshold_usd: parseFloat(budgetForm.hard_stop_threshold_usd),
        reserved_balance_usd: parseFloat(budgetForm.reserved_balance_usd),
      });
      toast('Global spending guard settings updated successfully.', 'ok');
      setBudgetModalOpen(false);
      fetchData();
    } catch (err) {
      toast(err.message || 'Failed to update budget settings', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Unauthorized view
  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-danger-bg border border-danger/30 flex items-center justify-center text-danger mb-4 shadow-panel">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold text-ink mb-2">Administrator Access Required</h1>
        <p className="text-xs text-ink-muted max-w-md mb-6 leading-relaxed">
          The administrator dashboard is restricted to verified administrator accounts. Ordinary users cannot view or modify user accounts, quotas, or API spending guards.
        </p>

        <div className="flex items-center gap-3">
          <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate('/app')}>
            Back to Studio
          </Button>
          {!user ? (
            <Button variant="primary" icon={KeyRound} onClick={() => setAuthModalOpen(true)}>
              Sign In
            </Button>
          ) : (
            <div className="text-[11px] text-ink-soft bg-surface border border-line p-2 rounded-md">
              Current account: <strong>{user.email}</strong> (Role: {profile?.role || 'user'})
              <div className="mt-1 text-ink-muted">
                Run <code>npm run make-admin --workspace server -- {user.email}</code> in your server directory to designate this account as administrator.
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const budget = overview?.budget;
  const stats = overview?.stats;

  const totalSpent = Number(budget?.total_spent_usd || 0);
  const threshold = Number(budget?.hard_stop_threshold_usd || 4.0);
  const totalBudget = Number(budget?.total_budget_usd || 5.0);
  const percentSpent = Math.min(100, Math.round((totalSpent / (threshold || 1)) * 100));

  return (
    <div className="min-h-screen bg-paper text-ink pb-16">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur-md border-b border-line px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            icon={ArrowLeft}
            onClick={() => navigate('/app')}
            className="text-xs text-ink-muted hover:text-ink"
          >
            Studio
          </Button>
          <div className="h-4 w-px bg-line" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-ink text-paper flex items-center justify-center font-bold text-xs">
              <Shield className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-ink">AutoResumeAI Control Center</span>
                <Badge variant="ok">Admin Verified</Badge>
              </div>
              <span className="text-[10.5px] text-ink-muted">
                Signed in as {profile?.email} (Unlimited Personal Access Active)
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={fetchData}
            disabled={loading}
            className="text-xs h-8"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={Sliders}
            onClick={() => setBudgetModalOpen(true)}
            className="text-xs h-8"
          >
            Spending Guard Config
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-6 space-y-6">
        {/* Global Spending Guard Notice & Status */}
        <section className="bg-surface border border-line-strong rounded-xl p-5 shadow-panel space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  budget?.status === 'ok'
                    ? 'bg-ok-bg text-ok border border-ok/30'
                    : 'bg-danger-bg text-danger border border-danger/30'
                }`}
              >
                {budget?.status === 'ok' ? (
                  <ShieldCheck className="w-5 h-5" />
                ) : (
                  <ShieldAlert className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-sm text-ink">Global OpenRouter Spending Guard</h2>
                  <Badge variant={budget?.status === 'ok' ? 'ok' : 'danger'}>
                    {budget?.status === 'ok' ? 'Spending Guard Active' : 'Hard Stop Triggered'}
                  </Badge>
                </div>
                <p className="text-[11px] text-ink-muted">
                  Enforced server-side for all requests (including administrator and unlimited tier).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="bg-sunken px-3 py-1.5 rounded-md border border-line">
                <span className="text-ink-muted block text-[10px]">Estimated Spent</span>
                <span className="font-semibold text-ink">${totalSpent.toFixed(4)}</span>
              </div>
              <div className="bg-sunken px-3 py-1.5 rounded-md border border-line">
                <span className="text-ink-muted block text-[10px]">Internal Threshold</span>
                <span className="font-semibold text-ink">${threshold.toFixed(2)}</span>
              </div>
              <div className="bg-sunken px-3 py-1.5 rounded-md border border-line">
                <span className="text-ink-muted block text-[10px]">Total API Budget</span>
                <span className="font-semibold text-ink">${totalBudget.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-[11px] text-ink-soft mb-1.5">
              <span>
                Threshold Consumption: <strong>{percentSpent}%</strong>
              </span>
              <span>
                Safety Cushion Remaining: <strong>${Math.max(0, threshold - totalSpent).toFixed(4)}</strong> (plus ${Number(budget?.reserved_balance_usd || 1).toFixed(2)} hard reserve)
              </span>
            </div>
            <div className="w-full h-2.5 bg-sunken rounded-full overflow-hidden border border-line">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  percentSpent >= 90 ? 'bg-danger' : percentSpent >= 70 ? 'bg-warn' : 'bg-accent'
                }`}
                style={{ width: `${Math.min(100, Math.max(2, percentSpent))}%` }}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-[11px] text-ink-muted gap-2 pt-2 border-t border-line">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-warn shrink-0" />
              Costs are estimated based on token metadata and per-request reservations. Actual OpenRouter billing may vary slightly.
            </span>
            <a
              href="https://openrouter.ai/settings/keys"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline flex items-center gap-1 font-medium shrink-0"
            >
              Configure OpenRouter Key Credit Limit <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </section>

        {/* 4 Overview Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-surface border border-line rounded-xl shadow-panel">
            <div className="flex items-center justify-between text-ink-muted mb-2">
              <span className="text-xs font-medium">Registered Accounts</span>
              <Users className="w-4 h-4 text-accent" />
            </div>
            <div className="text-2xl font-bold text-ink">{stats?.totalUsers ?? '—'}</div>
            <div className="text-[11px] text-ink-muted mt-1 flex items-center gap-2">
              <span>{stats?.activeUsers ?? 0} active</span>
              <span>•</span>
              <span className="text-accent font-medium">{stats?.unlimitedUsers ?? 0} unlimited</span>
              {stats?.suspendedUsers > 0 && (
                <>
                  <span>•</span>
                  <span className="text-danger">{stats.suspendedUsers} suspended</span>
                </>
              )}
            </div>
          </div>

          <div className="p-4 bg-surface border border-line rounded-xl shadow-panel">
            <div className="flex items-center justify-between text-ink-muted mb-2">
              <span className="text-xs font-medium">Today's AI Requests</span>
              <Cpu className="w-4 h-4 text-accent" />
            </div>
            <div className="text-2xl font-bold text-ink">{stats?.todayRequests ?? 0}</div>
            <div className="text-[11px] text-ink-muted mt-1">
              {stats?.todayTokens ? Number(stats.todayTokens).toLocaleString() : 0} tokens generated today (UTC)
            </div>
          </div>

          <div className="p-4 bg-surface border border-line rounded-xl shadow-panel">
            <div className="flex items-center justify-between text-ink-muted mb-2">
              <span className="text-xs font-medium">Today's Estimated Cost</span>
              <DollarSign className="w-4 h-4 text-ok" />
            </div>
            <div className="text-2xl font-bold text-ink">
              ${Number(stats?.todayCostUsd || 0).toFixed(4)}
            </div>
            <div className="text-[11px] text-ink-muted mt-1">Resets nightly at 00:00 UTC</div>
          </div>

          <div className="p-4 bg-surface border border-line rounded-xl shadow-panel">
            <div className="flex items-center justify-between text-ink-muted mb-2">
              <span className="text-xs font-medium">All-Time AI Spend</span>
              <DollarSign className="w-4 h-4 text-accent" />
            </div>
            <div className="text-2xl font-bold text-ink">
              ${totalSpent.toFixed(4)}
            </div>
            <div className="text-[11px] text-ink-muted mt-1">
              Of ${threshold.toFixed(2)} threshold
            </div>
          </div>
        </div>

        {/* User Management Section */}
        <section className="bg-surface border border-line rounded-xl shadow-panel overflow-hidden">
          <div className="p-4 border-b border-line flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-sm text-ink flex items-center gap-2">
                <Users className="w-4 h-4 text-accent" />
                User Management & Quotas ({userTotal} total)
              </h2>
              <p className="text-[11px] text-ink-muted">
                Manage accounts, grant/revoke unlimited AI access, adjust individual daily limits, or suspend accounts.
              </p>
            </div>

            {/* Search and Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-ink-faint absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search email or ID..."
                  className="pl-8 pr-3 py-1.5 bg-paper border border-line rounded-md text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent w-48 sm:w-60"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-paper border border-line rounded-md text-xs py-1.5 px-2 text-ink focus:outline-none focus:border-accent"
              >
                <option value="">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="suspended">Suspended Only</option>
              </select>

              <select
                value={unlimitedFilter}
                onChange={(e) => {
                  setUnlimitedFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-paper border border-line rounded-md text-xs py-1.5 px-2 text-ink focus:outline-none focus:border-accent"
              >
                <option value="">All Tiers</option>
                <option value="true">Unlimited Only</option>
                <option value="false">Standard Quota Only</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-sunken/60 text-ink-soft uppercase text-[10px] tracking-wider border-b border-line">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">AI Entitlement</th>
                  <th className="py-3 px-4">Today's Usage</th>
                  <th className="py-3 px-4">Lifetime AI Usage</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-ink-muted text-xs">
                      {loading ? 'Loading users...' : 'No users found matching current filters.'}
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const isTargetAdmin = u.role === 'admin';
                    const hasUnlimited = Boolean(u.is_unlimited || isTargetAdmin);

                    return (
                      <tr key={u.id} className="hover:bg-sunken/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-medium text-ink flex items-center gap-1.5">
                            <span>{u.email}</span>
                            {u.id === profile?.id && (
                              <Badge variant="accent">You</Badge>
                            )}
                          </div>
                          <div className="text-[10px] text-ink-faint font-mono mt-0.5">
                            ID: {u.id.substring(0, 8)}... • Joined {new Date(u.created_at).toLocaleDateString()}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <Badge variant={isTargetAdmin ? 'accent' : 'neutral'}>
                            {u.role}
                          </Badge>
                        </td>

                        <td className="py-3 px-4">
                          <Badge variant={u.account_status === 'active' ? 'ok' : 'danger'}>
                            {u.account_status}
                          </Badge>
                        </td>

                        <td className="py-3 px-4">
                          {hasUnlimited ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-accent-bg text-accent border border-accent/20">
                              <InfinityIcon className="w-3 h-3" />
                              Unlimited
                            </span>
                          ) : (
                            <div className="flex items-center gap-1 text-ink-soft">
                              <span>Standard:</span>
                              <strong>{u.daily_limit} req/day</strong>
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-mono text-[11px] text-ink">
                            {u.todayRequests} requests
                          </div>
                          <div className="text-[10px] text-ink-muted font-mono">
                            ${Number(u.todayCostUsd || 0).toFixed(4)}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-mono text-[11px] text-ink">
                            {u.totalRequests} reqs • {Number(u.totalTokens || 0).toLocaleString()} tok
                          </div>
                          <div className="text-[10px] text-ink-muted font-mono">
                            ${Number(u.totalCostUsd || 0).toFixed(4)}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Unlimited Toggle (Admins always unlimited) */}
                            {!isTargetAdmin && (
                              <Button
                                size="sm"
                                variant={u.is_unlimited ? 'danger' : 'secondary'}
                                disabled={actionLoading}
                                onClick={() => handleToggleUnlimited(u)}
                                className="h-7 text-[11px] px-2"
                                title={u.is_unlimited ? 'Revoke unlimited access' : 'Grant unlimited access'}
                              >
                                {u.is_unlimited ? 'Revoke Unlimited' : 'Grant Unlimited'}
                              </Button>
                            )}

                            {/* Edit Limit */}
                            {!hasUnlimited && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={actionLoading}
                                onClick={() => {
                                  setEditLimitUser(u);
                                  setNewLimitVal(u.daily_limit);
                                }}
                                className="h-7 text-[11px] px-2 text-ink-muted hover:text-ink"
                              >
                                Limit
                              </Button>
                            )}

                            {/* Suspend / Reactivate */}
                            {u.id !== profile?.id && (
                              <Button
                                size="sm"
                                variant={u.account_status === 'suspended' ? 'secondary' : 'ghost'}
                                disabled={actionLoading}
                                onClick={() => handleToggleSuspend(u)}
                                className="h-7 text-[11px] px-2 text-danger hover:bg-danger-bg"
                                title={u.account_status === 'suspended' ? 'Reactivate' : 'Suspend user'}
                              >
                                {u.account_status === 'suspended' ? 'Reactivate' : 'Suspend'}
                              </Button>
                            )}

                            {/* Promote / Demote Admin */}
                            {u.id !== profile?.id && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={actionLoading}
                                onClick={() => handleToggleRole(u)}
                                className="h-7 text-[11px] px-2 text-ink-muted hover:text-ink"
                              >
                                {isTargetAdmin ? 'Remove Admin' : 'Make Admin'}
                              </Button>
                            )}

                            {/* Revoke Sessions */}
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={actionLoading}
                              onClick={() => handleRevokeSessions(u)}
                              className="h-7 text-[11px] px-1.5 text-ink-faint hover:text-ink"
                              title="Revoke user sessions"
                            >
                              <LogOut className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-3 border-t border-line bg-sunken/40 flex items-center justify-between text-xs text-ink-muted">
            <span>
              Page {page} of {totalPages} ({userTotal} users)
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-7 px-2"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Previous
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
                className="h-7 px-2"
              >
                Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </section>

        {/* Audit Logs Section */}
        <section className="bg-surface border border-line rounded-xl shadow-panel p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-sm text-ink flex items-center gap-2">
                <History className="w-4 h-4 text-accent" />
                Administrative Audit Log
              </h2>
              <p className="text-[11px] text-ink-muted">
                Immutable record of administrative actions, quota adjustments, and account status updates.
              </p>
            </div>
            <span className="text-[11px] text-ink-faint">Last 30 events</span>
          </div>

          <div className="max-h-64 overflow-y-auto border border-line rounded-lg">
            {auditLogs.length === 0 ? (
              <div className="py-8 text-center text-xs text-ink-muted">
                No administrative actions logged yet.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-sunken text-ink-soft uppercase text-[9.5px] border-b border-line sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp (UTC)</th>
                    <th className="py-2.5 px-3">Admin</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-[11px]">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-sunken/20 font-mono">
                      <td className="py-2 px-3 text-ink-muted whitespace-nowrap">
                        {new Date(log.created_at).toISOString().replace('T', ' ').slice(0, 19)}
                      </td>
                      <td className="py-2 px-3 text-ink">{log.admin_email || 'System'}</td>
                      <td className="py-2 px-3">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-sunken border border-line text-ink-soft">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-ink-muted max-w-md truncate">
                        {JSON.stringify(log.details)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>

      {/* Edit Quota Limit Modal */}
      {editLimitUser && (
        <Modal
          isOpen={true}
          onClose={() => setEditLimitUser(null)}
          title={`Set Daily Quota: ${editLimitUser.email}`}
          description="Adjust the number of AI requests permitted per UTC day for this individual user."
          maxWidth="max-w-sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setEditLimitUser(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveDailyLimit}
                disabled={actionLoading}
              >
                {actionLoading ? 'Saving...' : 'Save Quota'}
              </Button>
            </>
          }
        >
          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-ink-soft mb-1">
                Daily Request Limit (1 - 1000)
              </label>
              <input
                type="number"
                min={1}
                max={1000}
                value={newLimitVal}
                onChange={(e) => setNewLimitVal(e.target.value)}
                className="w-full p-2 bg-paper border border-line rounded text-xs text-ink focus:outline-none focus:border-accent"
              />
            </div>
            <p className="text-[11px] text-ink-muted leading-relaxed">
              Standard default is 10 requests per day. The quota resets every day at 00:00 UTC.
            </p>
          </div>
        </Modal>
      )}

      {/* Global Spending Guard Modal */}
      {budgetModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setBudgetModalOpen(false)}
          title="Configure Global Spending Guard"
          description="Protect your OpenRouter API balance with pre-call atomic budget reservations."
          maxWidth="max-w-md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setBudgetModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveBudget}
                disabled={actionLoading}
              >
                {actionLoading ? 'Saving...' : 'Save Configuration'}
              </Button>
            </>
          }
        >
          <form onSubmit={handleSaveBudget} className="space-y-4 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-ink-soft mb-1">
                Total API Budget (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-ink-faint">$</span>
                <input
                  type="number"
                  step="0.10"
                  min="0.50"
                  value={budgetForm.total_budget_usd}
                  onChange={(e) =>
                    setBudgetForm({ ...budgetForm, total_budget_usd: e.target.value })
                  }
                  required
                  className="w-full pl-7 pr-3 py-1.5 bg-paper border border-line rounded text-xs text-ink focus:outline-none focus:border-accent"
                />
              </div>
              <span className="text-[10.5px] text-ink-muted">Configurable target budget (e.g., $5.00)</span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-ink-soft mb-1">
                Internal Hard-Stop Threshold (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-ink-faint">$</span>
                <input
                  type="number"
                  step="0.10"
                  min="0.10"
                  value={budgetForm.hard_stop_threshold_usd}
                  onChange={(e) =>
                    setBudgetForm({ ...budgetForm, hard_stop_threshold_usd: e.target.value })
                  }
                  required
                  className="w-full pl-7 pr-3 py-1.5 bg-paper border border-line rounded text-xs text-ink focus:outline-none focus:border-accent"
                />
              </div>
              <span className="text-[10.5px] text-ink-muted">
                When estimated spending reaches this amount, new paid requests are halted.
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-ink-soft mb-1">
                Reserved Balance (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-ink-faint">$</span>
                <input
                  type="number"
                  step="0.10"
                  min="0"
                  value={budgetForm.reserved_balance_usd}
                  onChange={(e) =>
                    setBudgetForm({ ...budgetForm, reserved_balance_usd: e.target.value })
                  }
                  required
                  className="w-full pl-7 pr-3 py-1.5 bg-paper border border-line rounded text-xs text-ink focus:outline-none focus:border-accent"
                />
              </div>
              <span className="text-[10.5px] text-ink-muted">
                Buffer reserved for concurrent in-flight requests ($1.00 recommended).
              </span>
            </div>

            <div className="p-3 bg-sunken rounded-lg border border-line text-[11px] text-ink-muted space-y-1">
              <strong>Concurrency Protection:</strong>
              <p>
                Each request reserves estimated cost with atomic row locking before dispatching to OpenRouter. If the budget tracker is offline or unreachable, requests fail safely to prevent accidental overages.
              </p>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
