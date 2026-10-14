import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import {
  useStore,
  setAuthModalOpen,
  signIn,
  signUp,
  resetPassword,
  updateUserPassword,
  toast,
} from '../../app/store.js';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  User,
  ArrowLeft,
  CheckCircle,
  KeyRound,
} from 'lucide-react';
import { TermsModal } from './TermsModal.jsx';
import { PrivacyModal } from './PrivacyModal.jsx';

export function AuthModal() {
  const isOpen = useStore((s) => s.ui.authModalOpen);
  const authModalMode = useStore((s) => s.ui.authModalMode);

  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot' | 'reset'
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  useEffect(() => {
    if (authModalMode) {
      setMode(authModalMode);
      setErrorMsg('');
      setResetSent(false);
    }
  }, [authModalMode, isOpen]);

  const handleClose = () => {
    setErrorMsg('');
    setPassword('');
    setConfirmPassword('');
    setResetSent(false);
    setAuthModalOpen(false);
  };

  const handleModeSwitch = (newMode) => {
    setMode(newMode);
    setErrorMsg('');
    setPassword('');
    setConfirmPassword('');
    setResetSent(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    // --- Mode: Forgot Password ---
    if (mode === 'forgot') {
      if (!email.trim()) {
        setErrorMsg('Please enter your email address.');
        return;
      }
      setLoading(true);
      try {
        await resetPassword(email);
        setResetSent(true);
      } catch (err) {
        console.error('Password reset error:', err);
        setErrorMsg(err.message || 'Could not send reset email. Please try again.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // --- Mode: Reset Password (Recovery) ---
    if (mode === 'reset') {
      if (!password) {
        setErrorMsg('Please enter your new password.');
        return;
      }
      if (password.length < 6) {
        setErrorMsg('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match. Please re-enter matching passwords.');
        return;
      }
      setLoading(true);
      try {
        await updateUserPassword(password);
        toast('Password updated successfully! Welcome back.', 'ok');
        handleClose();
      } catch (err) {
        console.error('Password update error:', err);
        setErrorMsg(err.message || 'Could not update password. Please try again.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // --- Mode: Register ---
    if (mode === 'register') {
      if (!firstName.trim() || !lastName.trim()) {
        setErrorMsg('Please enter both your first and last name.');
        return;
      }
    }

    // --- Mode: Login / Register ---
    if (!email.trim() || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter matching passwords.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
        toast('Signed in successfully! Welcome back.', 'ok');
        handleClose();
      } else {
        const data = await signUp(email, password, { firstName, lastName });
        if (data?.session) {
          toast(`Account created! Welcome, ${firstName.trim()}.`, 'ok');
          handleClose();
        } else {
          toast('Account created! Please check your email inbox to confirm your account.', 'info');
          handleModeSwitch('login');
        }
      }
    } catch (err) {
      console.error('Auth error:', err);
      const message = err.message || 'Authentication failed. Please verify your credentials.';
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'forgot':
        return 'Reset your password';
      case 'reset':
        return 'Set new password';
      case 'register':
        return 'Create your account';
      default:
        return 'Sign in to AutoResumeAI';
    }
  };

  const getDescription = () => {
    switch (mode) {
      case 'forgot':
        return "Enter your email address and we'll send you a link to reset your password.";
      case 'reset':
        return 'Choose a new secure password for your AutoResumeAI account.';
      case 'register':
        return 'Create your account to unlock 10 daily AI requests and save your DOCX edits.';
      default:
        return 'Access your saved resumes, AI chat history, and daily request quota.';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={getTitle()}
      description={getDescription()}
      maxWidth="max-w-md"
    >
      <div className="space-y-4 text-xs">
        {/* Tab Switcher (Login and Register only) */}
        {(mode === 'login' || mode === 'register') && (
          <div className="flex bg-sunken p-1 rounded-lg border border-line">
            <button
              type="button"
              onClick={() => handleModeSwitch('login')}
              className={`flex-1 py-1.5 font-medium rounded-md transition-all text-xs ${
                mode === 'login'
                  ? 'bg-surface text-ink shadow-panel'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch('register')}
              className={`flex-1 py-1.5 font-medium rounded-md transition-all text-xs ${
                mode === 'register'
                  ? 'bg-surface text-ink shadow-panel'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Back button for Forgot Password mode */}
        {mode === 'forgot' && (
          <div className="flex items-center justify-between pb-1">
            <button
              type="button"
              onClick={() => handleModeSwitch('login')}
              className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink font-medium cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </button>
          </div>
        )}

        {/* Password recovery indicator banner for Reset mode */}
        {mode === 'reset' && (
          <div className="p-2.5 bg-accent/10 border border-accent/20 rounded-md text-ink text-xs flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-accent shrink-0" />
            <span>Authenticated via password recovery link. Please enter your new password.</span>
          </div>
        )}

        {/* Error message alert */}
        {errorMsg && (
          <div className="p-2.5 bg-danger-bg border border-danger/30 rounded-md text-danger text-[11px] flex items-start gap-2 animate-fade-in">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Forgot password success state */}
        {mode === 'forgot' && resetSent ? (
          <div className="space-y-4 animate-fade-in">
            <div className="p-3.5 bg-ok/10 border border-ok/30 rounded-lg text-xs space-y-2">
              <div className="flex items-center gap-2 font-medium text-ok">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>Reset link sent!</span>
              </div>
              <p className="text-[11px] text-ink-muted leading-relaxed">
                We've sent a secure password recovery link to{' '}
                <strong className="text-ink">{email}</strong>. Please check your inbox and click the link to reset your password.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => handleModeSwitch('login')}
              className="w-full justify-center text-xs py-2 h-9"
            >
              Return to Sign In
            </Button>
          </div>
        ) : (
          /* Main Form */
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* First Name & Last Name (Register mode only) */}
            {mode === 'register' && (
              <div className="grid grid-cols-2 gap-2.5 animate-fade-in">
                <div>
                  <label className="block text-[11px] font-semibold text-ink-soft mb-1">
                    First Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-ink-faint absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Jane"
                      required
                      className="w-full pl-9 pr-3 py-2 bg-paper border border-line rounded-md text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-ink-soft mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    required
                    className="w-full px-3 py-2 bg-paper border border-line rounded-md text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
            )}

            {/* Email Address (Login, Register, and Forgot modes) */}
            {mode !== 'reset' && (
              <div>
                <label className="block text-[11px] font-semibold text-ink-soft mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-ink-faint absolute left-3 top-2.5" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    className="w-full pl-9 pr-3 py-2 bg-paper border border-line rounded-md text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
            )}

            {/* Password (Login, Register, and Reset modes) */}
            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-ink-soft">
                    {mode === 'reset' ? 'New Password' : 'Password'}
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => handleModeSwitch('forgot')}
                      className="text-[11px] text-accent hover:underline font-medium cursor-pointer transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-ink-faint absolute left-3 top-2.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full pl-9 pr-10 py-2 bg-paper border border-line rounded-md text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-ink-faint hover:text-ink transition-colors cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {(mode === 'register' || mode === 'reset') && (
                  <span className="text-[10px] text-ink-muted mt-0.5 block">
                    Must be at least 6 characters.
                  </span>
                )}
              </div>
            )}

            {/* Confirm Password (Register and Reset modes) */}
            {(mode === 'register' || mode === 'reset') && (
              <div className="animate-fade-in">
                <label className="block text-[11px] font-semibold text-ink-soft mb-1">
                  {mode === 'reset' ? 'Confirm New Password' : 'Confirm Password'}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-ink-faint absolute left-3 top-2.5" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full pl-9 pr-10 py-2 bg-paper border border-line rounded-md text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 text-ink-faint hover:text-ink transition-colors cursor-pointer"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Account benefits pill (Register mode only) */}
            {mode === 'register' && (
              <div className="p-3 bg-surface border border-line rounded-md space-y-1 text-[11px] text-ink-soft animate-fade-in">
                <div className="flex items-center gap-1.5 font-medium text-ink">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  <span>Standard User Entitlements</span>
                </div>
                <ul className="list-disc list-inside text-ink-muted text-[10.5px] space-y-0.5 ml-1">
                  <li>10 free AI resume transformations daily (resets 00:00 UTC)</li>
                  <li>Max output tokens for full resume generation</li>
                  <li>Strict private workspace isolation for your resumes</li>
                </ul>
              </div>
            )}

            {mode === 'register' && (
              <p className="text-[10.5px] text-ink-muted text-center px-1 leading-relaxed">
                By creating an account, you agree to our{' '}
                <button
                  type="button"
                  onClick={() => setShowTerms(true)}
                  className="text-accent hover:underline font-medium cursor-pointer"
                >
                  Terms of Service
                </button>{' '}
                and{' '}
                <button
                  type="button"
                  onClick={() => setShowPrivacy(true)}
                  className="text-accent hover:underline font-medium cursor-pointer"
                >
                  Privacy Policy
                </button>
                .
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="w-full justify-center text-xs py-2 h-9"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-paper border-t-transparent rounded-full animate-spin" />
                  <span>
                    {mode === 'login'
                      ? 'Signing in...'
                      : mode === 'register'
                      ? 'Creating account...'
                      : mode === 'forgot'
                      ? 'Sending reset link...'
                      : 'Updating password...'}
                  </span>
                </span>
              ) : mode === 'login' ? (
                'Sign In'
              ) : mode === 'register' ? (
                'Create Account'
              ) : mode === 'forgot' ? (
                'Send Reset Link'
              ) : (
                'Update Password'
              )}
            </Button>
          </form>
        )}

        <div className="pt-2 text-center text-[10.5px] text-ink-muted border-t border-line flex items-center justify-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-ok" />
          <span>Resume files and chats are strictly isolated to your account.</span>
        </div>
      </div>

      <TermsModal isOpen={showTerms} onClose={() => setShowTerms(false)} />
      <PrivacyModal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} />
    </Modal>
  );
}
