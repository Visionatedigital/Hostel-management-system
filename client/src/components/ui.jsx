import React, { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

/* ---------- Toast context ---------- */
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

/* ---------- Helpers ---------- */
export function fmtUGX(amount) {
  const n = Number(amount) || 0;
  return 'UGX ' + n.toLocaleString('en-UG');
}

export function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s.replace(' ', 'T'));
  if (isNaN(d)) return s;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateTime(s) {
  if (!s) return '—';
  const d = new Date(s.replace(' ', 'T'));
  if (isNaN(d)) return s;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
    ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function initials(first, last) {
  return ((first?.[0] || '') + (last?.[0] || '')).toUpperCase() || '?';
}

/* ---------- Badge ---------- */
const BADGE_COLORS = {
  // visitor statuses
  invited: 'blue',
  accepted: 'purple',
  arrival_requested: 'amber',
  approved: 'green',
  checked_in: 'green',
  checked_out: 'muted',
  declined: 'red',
  expired: 'muted',
  cancelled: 'muted',
  overdue: 'red',
  // payment statuses
  pending: 'amber',
  paid: 'green',
  failed: 'red',
  reversed: 'muted',
  // maintenance
  open: 'amber',
  assigned: 'blue',
  in_progress: 'blue',
  resolved: 'green',
  escalated: 'red',
  // priorities
  low: 'muted',
  normal: 'blue',
  high: 'amber',
  urgent: 'red',
  // resident statuses
  active: 'green',
  departed: 'muted',
  // room statuses
  available: 'green',
  occupied: 'amber',
  maintenance: 'red',
  reserved: 'blue',
  // inspection deposit
  proposed: 'amber',
  disputed: 'red',
  refunded: 'muted',
  settled: 'green',
};

export function Badge({ value, label }) {
  const color = BADGE_COLORS[value] || 'muted';
  const text = label || String(value).replace(/_/g, ' ');
  return <span className={`badge badge-${color}`}>{text}</span>;
}

/* ---------- Modal ---------- */
export function Modal({ title, onClose, children }) {
  return createPortal(
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="page-head" style={{ marginBottom: 10 }}>
          <h2 className="modal-title">{title}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

/* ---------- Empty state ---------- */
export function Empty({ icon = '○', text = 'Nothing here yet' }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <div>{text}</div>
    </div>
  );
}

/* ---------- Avatar ---------- */
export function Avatar({ src, first, last, size = 56 }) {
  if (src) {
    return (
      <div className="occupant-photo" style={{ width: size, height: size }}>
        <img src={src} alt={`${first} ${last}`} />
      </div>
    );
  }
  return (
    <div className="occupant-photo" style={{ width: size, height: size }}>
      {initials(first, last)}
    </div>
  );
}

/* ---------- Maintenance trades ---------- */
export const TRADES = [
  { id: 'electrical', label: 'Electrical', icon: '⚡' },
  { id: 'plumbing', label: 'Plumbing', icon: '🚿' },
  { id: 'carpentry', label: 'Carpentry & Doors', icon: '🚪' },
  { id: 'painting', label: 'Painting', icon: '🖌️' },
  { id: 'cleaning', label: 'Cleaning', icon: '🧹' },
  { id: 'general', label: 'General', icon: '🔧' },
];

export const TRADESPERSONS = {
  electrical: ['James Okwera', 'Peter Ssenyonga'],
  plumbing: ['Musa Kato', 'Ivan Tumusiime'],
  carpentry: ['Samuel Wamala', 'Joseph Okello'],
  painting: ['Ruth Nabirye'],
  cleaning: ['Doreen Auma'],
  general: ['Maintenance Team A', 'Maintenance Team B'],
};

export function tradeLabel(category) {
  return TRADES.find((t) => t.label === category)?.label || category || 'General';
}

