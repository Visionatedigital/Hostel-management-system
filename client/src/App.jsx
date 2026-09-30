import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { api, setToken, getToken } from './api.js';
import { ToastProvider } from './components/ui.jsx';
import Layout from './components/Layout.jsx';
import BrandLoader from './components/BrandLoader.jsx';

import Login from './pages/Login.jsx';
import ResidentDashboard from './pages/ResidentDashboard.jsx';
import ResidentInvite from './pages/ResidentInvite.jsx';
import ResidentPayments from './pages/ResidentPayments.jsx';
import ResidentIssues from './pages/ResidentIssues.jsx';
import ResidentAnnouncements from './pages/ResidentAnnouncements.jsx';
import AcceptInvite from './pages/AcceptInvite.jsx';
import VerifyRoster from './pages/VerifyRoster.jsx';
import Visitors from './pages/Visitors.jsx';
import Residents from './pages/Residents.jsx';
import Rooms from './pages/Rooms.jsx';
import RoomPage from './pages/RoomPage.jsx';
import Occupancy from './pages/Occupancy.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';
import Payments from './pages/Payments.jsx';
import Maintenance from './pages/Maintenance.jsx';
import Announcements from './pages/Announcements.jsx';
import Inspections from './pages/Inspections.jsx';

function Protected({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  return <Layout user={user}>{children}</Layout>;
}

// Resident role can only access the resident dashboard.
function ResidentOnly({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'resident') return <Navigate to="/" replace />;
  return <Layout user={user}>{children}</Layout>;
}

// Admin-only pages: security and residents are redirected away.
function AdminOnly({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to={user.role === 'resident' ? '/resident' : '/visitors'} replace />;
  return <Layout user={user}>{children}</Layout>;
}

// Landing page: route each role to their own home.
function Home({ user }) {
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'resident') return <Navigate to="/resident" replace />;
  if (user.role === 'security') return <Navigate to="/visitors" replace />;
  return <Layout user={user}><Occupancy /></Layout>;
}

// Keep saved occupancy links working, including room filters and add-stay links.
function OccupancyRedirect() {
  const {search,hash}=useLocation();
  return <Navigate to={`/${search}${hash}`} replace />;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    async function bootstrap() {
      if (getToken()) {
        try {
          const me = await api.get('/auth/me');
          setUser(me);
        } catch {
          setToken(null);
        }
      }
      setLoading(false);
    }
    bootstrap();
  }, []);


  return (
    <ToastProvider>
      <BrowserRouter>
        {!loading && <Routes>
          <Route path="/login" element={<Login onLogin={setUser} onLoadingChange={setSigningIn} />} />
          <Route path="/invite/:token" element={<AcceptInvite />} />

          <Route path="/resident" element={<ResidentOnly user={user}><ResidentDashboard user={user} /></ResidentOnly>} />
          <Route path="/resident/invite" element={<ResidentOnly user={user}><ResidentInvite user={user} /></ResidentOnly>} />
          <Route path="/resident/payments" element={<ResidentOnly user={user}><ResidentPayments user={user} /></ResidentOnly>} />
          <Route path="/resident/issues" element={<ResidentOnly user={user}><ResidentIssues user={user} /></ResidentOnly>} />
          <Route path="/resident/announcements" element={<ResidentOnly user={user}><ResidentAnnouncements user={user} /></ResidentOnly>} />

          <Route path="/" element={<Home user={user} />} />
          <Route path="/verify" element={<Protected user={user}><VerifyRoster /></Protected>} />
          <Route path="/visitors" element={<Protected user={user}><Visitors /></Protected>} />
          <Route path="/residents" element={<AdminOnly user={user}><Residents /></AdminOnly>} />
          <Route path="/occupancy" element={<OccupancyRedirect />} />
          <Route path="/rooms/:id" element={<AdminOnly user={user}><RoomPage /></AdminOnly>} />
          <Route path="/rooms" element={<AdminOnly user={user}><Rooms /></AdminOnly>} />
          <Route path="/reports" element={<AdminOnly user={user}><Reports /></AdminOnly>} />
          <Route path="/settings" element={<AdminOnly user={user}><Settings user={user} onUserChanged={setUser}/></AdminOnly>} />
          <Route path="/payments" element={<AdminOnly user={user}><Payments /></AdminOnly>} />
          <Route path="/maintenance" element={<AdminOnly user={user}><Maintenance /></AdminOnly>} />
          <Route path="/announcements" element={<Protected user={user}><Announcements user={user} /></Protected>} />
          <Route path="/inspections" element={<AdminOnly user={user}><Inspections /></AdminOnly>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>}
        <BrandLoader active={loading || signingIn} label={signingIn ? 'Signing you in…' : 'Loading your workspace…'} />
      </BrowserRouter>
    </ToastProvider>
  );
}
