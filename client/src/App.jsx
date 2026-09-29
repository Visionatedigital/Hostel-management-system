import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { api, setToken, getToken } from './api.js';
import { ToastProvider } from './components/ui.jsx';
import Layout from './components/Layout.jsx';

import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
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
  return <Layout user={user}><Dashboard user={user} /></Layout>;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#ffffff' }}>
        <div style={{ fontFamily: 'Fraunces, serif', color: '#d97a26', fontSize: 22 }}>Hostel Gate…</div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login onLogin={setUser} />} />
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
          <Route path="/rooms" element={<AdminOnly user={user}><Rooms /></AdminOnly>} />
          <Route path="/payments" element={<AdminOnly user={user}><Payments /></AdminOnly>} />
          <Route path="/maintenance" element={<AdminOnly user={user}><Maintenance /></AdminOnly>} />
          <Route path="/announcements" element={<AdminOnly user={user}><Announcements /></AdminOnly>} />
          <Route path="/inspections" element={<AdminOnly user={user}><Inspections /></AdminOnly>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
