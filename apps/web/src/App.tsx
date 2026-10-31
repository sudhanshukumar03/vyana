import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useHealthStore } from './store/useHealthStore';
import { Layout } from './components/Layout';
import { lazy, Suspense, useEffect } from 'react';

const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Login = lazy(() => import('./pages/Login'));
const Vitals = lazy(() => import('./pages/Vitals'));
const Activity = lazy(() => import('./pages/Activity'));
const Trends = lazy(() => import('./pages/Trends'));
const Wellness = lazy(() => import('./pages/Wellness'));
const History = lazy(() => import('./pages/History'));
const Reports = lazy(() => import('./pages/Reports'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const Emergency = lazy(() => import('./pages/Emergency'));
const Assistant = lazy(() => import('./pages/Assistant'));
const AdminOperations = lazy(() => import('./pages/AdminOperations'));

function App() {
  const token = useHealthStore((s) => s.token);
  const authReady = useHealthStore((s) => s.authReady);
  useEffect(() => { void useHealthStore.getState().bootstrap(); }, []);

  if (!authReady) return <p role="status" className="p-8">Restoring your session...</p>;

  return (
    <BrowserRouter>
      <Suspense fallback={<p role="status" className="p-8">Loading...</p>}>
        {!token ? (
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/overview" element={<LandingPage />} />
            <Route path="/about" element={<LandingPage />} />
            <Route path="*" element={<LandingPage />} />
          </Routes>
        ) : (
          <Routes>
            <Route path="/overview" element={<LandingPage />} />
            <Route path="/about" element={<LandingPage />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="vitals" element={<Vitals />} />
              <Route path="activity" element={<Activity />} />
              <Route path="trends" element={<Trends />} />
              <Route path="wellness" element={<Wellness />} />
              <Route path="history" element={<History />} />
              <Route path="reports" element={<Reports />} />
              <Route path="profile" element={<Profile />} />
              <Route path="settings" element={<Settings />} />
              <Route path="emergency" element={<Emergency />} />
              <Route path="assistant" element={<Assistant />} />
              <Route path="admin" element={<AdminOperations />} />
              <Route path="operations" element={<AdminOperations />} />
              <Route path="*" element={<p>Page not found. Use navigation to return to your dashboard.</p>} />
            </Route>
          </Routes>
        )}
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
