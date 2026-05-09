import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { VocabularyPage } from './pages/VocabularyPage';
import { GrammarPage } from './pages/GrammarPage';
import { ReadingPage } from './pages/ReadingPage';
import { RoleplayPage } from './pages/RoleplayPage';
import { ResourcesPage } from './pages/ResourcesPage';
import { SettingsPage } from './pages/SettingsPage';
import { PlanPage } from './pages/PlanPage';
import { AppProvider, useApp } from './state/AppState';

function AppRoutes() {
  const { profile, isBooting } = useApp();

  if (isBooting) {
    return (
      <div className="main" style={{ marginLeft: 0, maxWidth: '100vw' }}>
        <div className="spinner-wrap">
          <div className="spinner" /> Loading…
        </div>
      </div>
    );
  }

  const shouldOnboard = !profile?.onboarded;

  return (
    <Routes>
      <Route path="/" element={<Navigate to={shouldOnboard ? '/onboarding' : '/dashboard'} replace />} />
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/plan" element={<PlanPage />} />
        <Route path="/vocabulary" element={<VocabularyPage />} />
        <Route path="/grammar" element={<GrammarPage />} />
        <Route path="/reading" element={<ReadingPage />} />
        <Route path="/roleplay" element={<RoleplayPage />} />
        <Route path="/resources" element={<ResourcesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppRoutes />
    </AppProvider>
  );
}

