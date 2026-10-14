import { verifySupabaseToken, getUserProfile } from '../services/supabase/client.js';
import { AppError } from '../utils/errors.js';
import { isSupabaseConfigured } from '../config/index.js';

export async function requireAuth(req, _res, next) {
  if (!isSupabaseConfigured()) {
    return next(
      new AppError(
        503,
        'AUTH_UNAVAILABLE',
        'User accounts & authentication are not configured on the server. Please configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      ),
    );
  }

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return next(
      new AppError(
        401,
        'UNAUTHORIZED',
        'Authentication required to use AI features. Please sign in or create an account.',
      ),
    );
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return next(
      new AppError(
        401,
        'UNAUTHORIZED',
        'Authentication required to use AI features. Please sign in or create an account.',
      ),
    );
  }

  try {
    const user = await verifySupabaseToken(token);
    if (!user) {
      return next(
        new AppError(
          401,
          'INVALID_TOKEN',
          'Your session has expired or is invalid. Please sign in again.',
        ),
      );
    }

    const profile = await getUserProfile(user.id);
    if (profile?.account_status === 'suspended') {
      return next(
        new AppError(
          403,
          'ACCOUNT_SUSPENDED',
          'Your account has been suspended by an administrator. Please contact support.',
        ),
      );
    }

    req.user = user;
    req.profile = profile || {
      id: user.id,
      email: user.email,
      role: 'user',
      account_status: 'active',
      is_unlimited: false,
      daily_limit: 10,
    };

    next();
  } catch (err) {
    next(err);
  }
}

export async function requireAdmin(req, res, next) {
  requireAuth(req, res, (err) => {
    if (err) return next(err);
    if (req.profile?.role !== 'admin') {
      return next(
        new AppError(
          403,
          'FORBIDDEN',
          'Administrator privileges required. You do not have permission to perform this action.',
        ),
      );
    }
    next();
  });
}

export async function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ') || !isSupabaseConfigured()) {
    req.user = null;
    req.profile = null;
    return next();
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    req.user = null;
    req.profile = null;
    return next();
  }

  try {
    const user = await verifySupabaseToken(token);
    if (user) {
      req.user = user;
      req.profile = await getUserProfile(user.id);
    } else {
      req.user = null;
      req.profile = null;
    }
  } catch {
    req.user = null;
    req.profile = null;
  }
  next();
}
