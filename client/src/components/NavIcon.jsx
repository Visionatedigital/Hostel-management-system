import React from 'react';

const icons = {
  reports: <><path d="M5 3h10l4 4v14H5V3ZM14 3v5h5M8 17v-3m4 3v-6m4 6v-4"/></>,
  settings: <><path d="m9 3-1 3-3 1-2 4 2 2v3l3 2 2 3h4l2-3 3-2v-3l2-2-2-4-3-1-1-3H9Z"/><circle cx="12" cy="12" r="3"/></>,
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="11" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="18" width="7" height="3" rx="1" /></>,
  visitors: <><path d="M13 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8v18ZM7 12h.01M14 12h8m-3-3 3 3-3 3" /></>,
  residents: <><circle cx="9" cy="7" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 5a5 5 0 0 1 3 4v2" /></>,
  rooms: <><path d="M3 20V5m18 15v-8a2 2 0 0 0-2-2H9v7M3 17h18M3 13h6" /><rect x="4" y="8" width="4" height="5" rx="1" /></>,
  payments: <><path d="M20 7V4a1 1 0 0 0-1-1L4 6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H4M22 12h-5a3 3 0 0 0 0 6h5M17 15h.01" /></>,
  maintenance: <><path d="M14 6a5 5 0 0 0-6 6l-5 5a2.8 2.8 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-3 3-4-4 3-3Z" /></>,
  announcements: <><path d="m4 9 16-6v18L4 15V9ZM4 9H2v6h2m4 2 1 5h4l-2-6M16 5v14" /></>,
  inspections: <><rect x="5" y="4" width="14" height="18" rx="2" /><rect x="9" y="2" width="6" height="4" rx="1" /><path d="m9 13 2 2 4-4M9 18h6" /></>,
  roster: <><path d="M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Z" /><path d="m8 12 3 3 5-6" /></>,
  invite: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="m3 6 9 7 9-7M16 16h4m-2-2v4" /></>,
};

export default function NavIcon({ name }) {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{icons[name]}</svg>;
}
