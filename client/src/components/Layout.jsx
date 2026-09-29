import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { setToken } from '../api.js';
import { initials } from './ui.jsx';

const ADMIN_NAV = [
  { section: 'Operations', items: [
    { to: '/', label: 'Dashboard', icon: '◈', end: true },
  ]},
  { section: 'Records', items: [
    { to: '/visitors', label: 'Visitors', icon: '⇄', end: false },
    { to: '/residents', label: 'Residents', icon: '▦', end: false },
    { to: '/rooms', label: 'Rooms', icon: '▣', end: false },
  ]},
  { section: 'Finance & Services', items: [
    { to: '/payments', label: 'Payments', icon: '₠', end: false },
    { to: '/maintenance', label: 'Maintenance', icon: '⚒', end: false },
    { to: '/announcements', label: 'Announcements', icon: '▤', end: false },
    { to: '/inspections', label: 'Inspections', icon: '☰', end: false },
  ]},
];

const SECURITY_NAV = [
  { section: 'Gate', items: [
    { to: '/visitors', label: 'Invited Guests', icon: '⇄', end: false },
    { to: '/verify', label: 'Room Roster', icon: '👁', end: false },
  ]},
];

const RESIDENT_NAV = [
  { section: 'My Hostel', items: [
    { to: '/resident', label: 'Overview', icon: '◈', end: true },
    { to: '/resident/invite', label: 'Invite a Guest', icon: '✉', end: false },
    { to: '/resident/payments', label: 'Payments', icon: '₠', end: false },
    { to: '/resident/issues', label: 'Report an Issue', icon: '⚒', end: false },
    { to: '/resident/announcements', label: 'Announcements', icon: '▤', end: false },
  ]},
];

export default function Layout({ user, children }) {
  const navigate = useNavigate();
  const nav = user.role === 'resident' ? RESIDENT_NAV : user.role === 'security' ? SECURITY_NAV : ADMIN_NAV;

  function logout() {
    setToken(null);
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-mark">V</div>
          <div>
            <div className="sidebar-name">Hostel Gate</div>
            <div className="sidebar-role">{user.role}</div>
          </div>
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
                <span className="nav-icon">{item.icon}</span>
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

      <main className="main">{children}</main>
    </div>
  );
}
