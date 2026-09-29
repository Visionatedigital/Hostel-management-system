import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { fmtUGX, fmtDateTime, Badge, Empty } from '../components/ui.jsx';

export default function Dashboard({ user }) {
  const [stats, setStats] = useState(null);
  const [visitors, setVisitors] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/visitors'),
      api.get('/payments/summary'),
      api.get('/announcements'),
      api.get('/verify/roster'),
    ])
      .then(([v, p, a, roster]) => {
        setVisitors(v);
        setStats(p);
        setAnnouncements(a.slice(0, 3));
        const occ = roster.reduce((n, r) => n + r.occupants.length, 0);
        const rooms = roster.length;
        setStats((s) => ({ ...s, occupancy: { count: occ, rooms } }));
      })
      .catch((e) => console.error(e));
  }, []);

  return (
    <div className="stagger">
      <div className="page-head">
        <div>
          <div className="eyebrow">Operations overview</div>
          <h1 className="page-title">Good {greeting()}, {user.full_name.split(' ')[0]}.</h1>
          <p className="page-sub">Here's what needs attention at the gate right now.</p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{stats?.occupancy?.count ?? '—'} <span style={{ fontSize: 16, color: 'var(--text-faint)' }}>/ {stats?.occupancy?.rooms ?? '—'} rooms</span></div>
          <div className="stat-label">Active residents</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: 24 }}>{stats ? fmtUGX(stats.total_outstanding) : '—'}</div>
          <div className="stat-label">Rent outstanding</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 18, alignItems: 'start' }}>
        <div className="card">
          <div className="section-title">Recent visitors</div>
          {visitors.length === 0 ? (
            <Empty icon="⇄" text="No visitors recorded" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Guest</th><th>Host</th><th>Status</th><th>Arrived</th></tr>
                </thead>
                <tbody>
                  {visitors.slice(0, 6).map((v) => (
                    <tr key={v.id}>
                      <td style={{ fontWeight: 500 }}>{v.guest_name}</td>
                      <td className="dim">{v.resident_first} {v.resident_last}</td>
                      <td><Badge value={v.status} /></td>
                      <td className="mono dim">{fmtDateTime(v.check_in_time)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-title">Announcements</div>
          {announcements.length === 0 ? (
            <Empty icon="▤" text="No announcements" />
          ) : (
            announcements.map((a) => (
              <div key={a.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{a.title}</div>
                <div className="dim" style={{ fontSize: 12 }}>{a.body}</div>
                <div className="mono dim" style={{ fontSize: 10, marginTop: 4 }}>{fmtDateTime(a.created_at)} · {a.audience}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
