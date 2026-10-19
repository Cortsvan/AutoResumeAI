import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { useStore, initStore, setServerConfig, setAuthModalOpen, toast } from './app/store.js';
import { api } from './services/api.js';
import { LandingPage } from './pages/LandingPage.jsx';
import { WorkspacePage } from './pages/WorkspacePage.jsx';
import { AdminDashboard } from './pages/AdminDashboard.jsx';
import { AuthModal } from './components/modals/AuthModal.jsx';
import { ToastContainer } from './components/ui/ToastContainer.jsx';

function ProtectedStudioRoute({ children }) {
  const user = useStore((s) => s.auth.user);
  const authLoading = useStore((s) => s.auth.loading);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/', { replace: true });
      setAuthModalOpen(true);
      toast('Please sign in or create an account to access the studio.', 'info');
    }
  }, [authLoading, user, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center text-xs text-ink-muted">
        <span className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin mr-2" />
        <span>Loading your account...</span>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return children;
}

function AppContent() {
  const navigate = useNavigate();
  const ready = useStore((s) => s.ready);

  useEffect(() => {
    // 1. Initialize local IndexedDB store
    initStore();

    // 2. Query backend configuration to detect live AI vs demo mode.
    //    Retries while the API is unreachable (e.g. it is still starting) so no manual refresh is needed.
    let cancelled = false;
    let timer = null;
    const loadConfig = () => {
      api.getConfig()
        .then((cfg) => {
          if (!cancelled) setServerConfig(cfg, true);
        })
        .catch((err) => {
          if (cancelled) return;
          console.warn('Backend not reachable; running in local offline demo mode:', err);
          setServerConfig(
            {
              ai: { configured: false },
              limits: { maxUploadMb: 5, maxMessageChars: 12000, maxJobDescriptionChars: 15000 },
            },
            false,
          );
          timer = setTimeout(loadConfig, 5000);
        });
    };
    loadConfig();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center text-xs text-ink-muted">
        <span className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin mr-2" />
        <span>Initializing AutoResumeAI Studio...</span>
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            <LandingPage
              onStartImprove={() => navigate('/app')}
              onStartCreate={() => navigate('/app')}
            />
          }
        />
        <Route
          path="/how-it-works"
          element={
            <LandingPage
              initialSection="how-it-works"
              onStartImprove={() => navigate('/app')}
              onStartCreate={() => navigate('/app')}
            />
          }
        />
        <Route
          path="/privacy"
          element={
            <LandingPage
              initialSection="privacy"
              initialOpenPrivacy={true}
              onStartImprove={() => navigate('/app')}
              onStartCreate={() => navigate('/app')}
            />
          }
        />
        <Route
          path="/app"
          element={
            <ProtectedStudioRoute>
              <WorkspacePage />
            </ProtectedStudioRoute>
          }
        />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route
          path="*"
          element={
            <LandingPage
              onStartImprove={() => navigate('/app')}
              onStartCreate={() => navigate('/app')}
            />
          }
        />
      </Routes>
      <AuthModal />
      <ToastContainer />
    </>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
}
