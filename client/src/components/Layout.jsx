import React, { useEffect, useState } from 'react';
import Brand from './Brand.jsx';
import NavIcon from './NavIcon.jsx';
import TopBar from './TopBar.jsx';
import { NavLink, useNavigate } from 'react-router-dom';
import { setToken } from '../api.js';
import { initials } from './ui.jsx';

const ADMIN_NAV = [
  { section: 'Operations', items: [
    { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
  ]},
  { section: 'Records', items: [
    { to: '/visitors', label: 'Visitors', icon: 'visitors', end: false },
    { to: '/residents', label: 'Residents', icon: 'residents', end: false },
    { to: '/rooms', label: 'Rooms', icon: 'rooms', end: false },
  ]},
  { section: 'Finance & Services', items: [
    { to: '/payments', label: 'Payments', icon: 'payments', end: false },
    { to: '/reports', label: 'Reports', icon: 'reports', end: false },
    { to: '/maintenance', label: 'Maintenance', icon: 'maintenance', end: false },
    { to: '/announcements', label: 'Announcements', icon: 'announcements', end: false },
    { to: '/inspections', label: 'Inspections', icon: 'inspections', end: false },
  ]},
  { section: 'Administration', items: [
    { to: '/settings', label: 'Settings', icon: 'settings', end: true },
  ]},
];

const SECURITY_NAV = [
  { section: 'Gate', items: [
    { to: '/visitors', label: 'Invited Guests', icon: 'visitors', end: false },
    { to: '/verify', label: 'Room Roster', icon: 'roster', end: false },
    { to: '/announcements', label: 'Announcements', icon: 'announcements', end: false },
  ]},
];

const RESIDENT_NAV = [
  { section: 'My Hostel', items: [
    { to: '/resident', label: 'Overview', icon: 'dashboard', end: true },
    { to: '/resident/invite', label: 'Invite a Guest', icon: 'invite', end: false },
    { to: '/resident/payments', label: 'Payments', icon: 'payments', end: false },
    { to: '/resident/issues', label: 'Report an Issue', icon: 'maintenance', end: false },
    { to: '/resident/announcements', label: 'Announcements', icon: 'announcements', end: false },
  ]},
];

export default function Layout({ user, children }) {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const nav = user.role === 'resident' ? RESIDENT_NAV : user.role === 'security' ? SECURITY_NAV : ADMIN_NAV;

  function logout() {
    setToken(null);
    navigate('/login');
  }

  return (
    <div className={`app-shell ${scrolled ? 'app-shell-scrolled' : ''}`}>
      <aside className="sidebar">
        <div className={`sidebar-brand ${scrolled ? 'sidebar-brand-compact' : ''}`}>
          <Brand variant="light" compact={scrolled} />
          <div className="sidebar-role">{user.role} workspace</div>
        </div>

        {nav.map((group) => (
          <div key={group.section}>
            <div className="nav-label">{group.section}</div>
            {group.items.map((item) => (
              <NavLink
                key={item.to + item.label}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <NavIcon name={item.icon} />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar">{initials(user.full_name, '')}</div>
            <div className="user-meta">
              <div className="user-name">{user.full_name}</div>
              <div className="user-role">{user.role} · @{user.username}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={logout}>Sign out</button>
        </div>
      </aside>

      <div className="workspace">
        <TopBar user={user} nav={nav} onLogout={logout} />
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
