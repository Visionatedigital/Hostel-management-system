import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { initials, fmtDateTime } from './ui.jsx';
import NavIcon from './NavIcon.jsx';

function ToolbarIcon({ name }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{name === 'search' ? <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></> : name === 'bell' ? <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></> : <path d="m7 10 5 5 5-5" />}</svg>;
}

export default function TopBar({ user, nav, onLogout }) {
  const navigate = useNavigate();
  const root = useRef(null);
  const searchInput = useRef(null);
  const bellButton = useRef(null);
  const profileButton = useRef(null);
  const [menu, setMenu] = useState(null);
  const [query, setQuery] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [noticeError, setNoticeError] = useState('');
  const [noticeLoading, setNoticeLoading] = useState(true);
  const readKey = `hostel_notifications_read_${user.id}`;
  const [read, setRead] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem(readKey) || '[]'); return Array.isArray(saved) ? saved : []; } catch { return []; }
  });
  const pages = nav.flatMap(group => group.items);
  const matches = pages.filter(page => page.label.toLowerCase().includes(query.trim().toLowerCase()));
  const unread = notifications.filter(item => !read.includes(item.key)).length;

  useEffect(() => {
    function outside(event) { if (!root.current?.contains(event.target)) setMenu(null); }
    function escape(event) {
      if (event.key !== 'Escape') return;
      setMenu(null);
      ({ search: searchInput, notifications: bellButton, profile: profileButton }[menu])?.current?.focus();
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [menu]);

  useEffect(() => {
    let cancelled = false;
    setNoticeLoading(true);
    Promise.all([api.get('/announcements'),user.role==='security'?api.get('/visitors'):Promise.resolve([])]).then(([announcements,visitors]) => {
      if (cancelled) return;
      setNoticeError('');
      const notices=announcements.map(a=>({key:`announcement-${a.id}-${a.created_at}`,title:a.title,body:a.body,date:a.created_at,to:user.role==='resident'?'/resident/announcements':'/announcements'}));
      const guests=visitors.filter(v=>['arrival_requested','accepted','overdue'].includes(v.status)).map(v=>({key:`visitor-${v.id}-${v.status}`,title:v.guest_name,body:`Visitor ${v.status.replace(/_/g,' ')}`,date:v.created_at,to:'/visitors'}));
      setNotifications([...notices,...guests].sort((a,b)=>b.date.localeCompare(a.date)));
    }).catch(() => { if (!cancelled) setNoticeError('Unable to load notifications. Try opening this menu again.'); })
      .finally(() => { if (!cancelled) setNoticeLoading(false); });
    return () => { cancelled = true; };
  }, [user.id, user.role, menu === 'notifications']);

  function markRead(keys) {
    const next = [...new Set([...read, ...keys])];
    setRead(next);
    try { localStorage.setItem(readKey, JSON.stringify(next)); } catch { /* In-memory read state still works. */ }
  }
  function toggle(name) { setMenu(current => current === name ? null : name); }
  function openPage(page) { setMenu(null); setQuery(''); navigate(page.to); }

  return (
    <header className="topbar" ref={root}>
      <div className="topbar-search-wrap">
        <form className="topbar-search" role="search" onSubmit={event => { event.preventDefault(); if (matches[0]) openPage(matches[0]); }}>
          <ToolbarIcon name="search" />
          <input ref={searchInput} aria-label="Search pages" aria-expanded={menu === 'search'} aria-controls="page-search-results" placeholder="Search pages…" value={query} onFocus={() => setMenu('search')} onChange={event => { setQuery(event.target.value); setMenu('search'); }} onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); root.current.querySelector('#page-search-results button')?.focus(); } }} />
        </form>
        {menu === 'search' && <div className="topbar-popover search-results" id="page-search-results" onKeyDown={event => {
          if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
          event.preventDefault();
          const buttons = [...event.currentTarget.querySelectorAll('button')];
          const next = buttons.indexOf(document.activeElement) + (event.key === 'ArrowDown' ? 1 : -1);
          if (next < 0) searchInput.current.focus(); else buttons[Math.min(next, buttons.length - 1)]?.focus();
        }}>
          <div className="popover-heading">{query.trim() ? 'Matching pages' : 'Quick navigation'}</div>
          {matches.length ? matches.map(page => <button type="button" className="search-result" key={page.to} onClick={() => openPage(page)}><NavIcon name={page.icon} /><span>{page.label}</span><span className="search-result-arrow" aria-hidden="true">→</span></button>) : <p className="popover-empty">No pages match “{query}”.</p>}
        </div>}
      </div>

      <div className="topbar-actions">
        <div className="topbar-menu-wrap">
          <button ref={bellButton} type="button" className="topbar-icon-button" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={menu === 'notifications'} aria-controls="notification-panel" onClick={() => toggle('notifications')}><ToolbarIcon name="bell" />{unread > 0 && <span className="notification-count" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}</button>
          {menu === 'notifications' && <section className="topbar-popover notification-panel" id="notification-panel" aria-label="Notifications">
            <div className="popover-heading notification-heading"><span>Notifications</span>{unread > 0 && <button type="button" onClick={() => markRead(notifications.map(item => item.key))}>Mark all read</button>}</div>
            <div className="notification-list">
              {noticeLoading ? <p className="popover-empty" role="status">Loading notifications…</p> : noticeError ? <p className="popover-empty" role="alert">{noticeError}</p> : !notifications.length ? <p className="popover-empty">You're all caught up.</p> : notifications.map(item => <Link key={item.key} className={`notification-item ${read.includes(item.key) ? '' : 'notification-unread'}`} to={item.to} onClick={() => { markRead([item.key]); setMenu(null); }}><span className="notification-dot" /><div><strong>{item.title}</strong><p>{item.body}</p><time>{fmtDateTime(item.date)}</time></div></Link>)}
            </div>
          </section>}
        </div>
        <div className="topbar-menu-wrap">
          <button ref={profileButton} type="button" className="profile-trigger" aria-label="Open profile menu" aria-expanded={menu === 'profile'} aria-controls="profile-panel" onClick={() => toggle('profile')}>
            <span className="topbar-avatar">{user.full_name.split(' ').map(name => name[0]).slice(0, 2).join('').toUpperCase() || initials(user.full_name, '')}</span>
            <span className="profile-trigger-text"><strong>{user.full_name}</strong><span>{user.role}</span></span>
            <ToolbarIcon name="chevron" />
          </button>
          {menu === 'profile' && <section className="topbar-popover profile-panel" id="profile-panel" aria-label="Profile">
            <div className="profile-details"><strong>{user.full_name}</strong><span>@{user.username} · {user.role}</span>{user.phone && <span>{user.phone}</span>}</div>
            <button type="button" className="search-result" onClick={() => openPage(pages[0])}><NavIcon name="dashboard" />My workspace</button>
            {user.role==='admin'&&<Link className="search-result" to="/settings" onClick={()=>setMenu(null)}><NavIcon name="settings"/>Settings</Link>}
            <button type="button" className="search-result profile-signout" onClick={onLogout}>Sign out <span aria-hidden="true">→</span></button>
          </section>}
        </div>
      </div>
    </header>
  );
}
