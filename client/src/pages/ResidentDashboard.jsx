import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Badge, Empty, fmtUGX, fmtDateTime, useToast } from '../components/ui.jsx';

export default function ResidentDashboard({ user }) {
  const [resident, setResident] = useState(null);
  const [invites, setInvites] = useState([]);
  const [issues, setIssues] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [balance, setBalance] = useState({ outstanding: 0, paid: 0 });
  const toast = useToast();

  useEffect(() => {
    Promise.allSettled([
      api.get(`/residents/${user.resident_id}`),
      api.get('/invites'),
      api.get('/maintenance'),
      api.get('/announcements'),
      api.get('/payments/mine/summary'),
    ]).then(([r, inv, iss, ann, bal]) => {
      if (r.status === 'fulfilled') setResident(r.value);
      if (inv.status === 'fulfilled') setInvites(inv.value);
      if (iss.status === 'fulfilled') setIssues(iss.value);
      if (ann.status === 'fulfilled') setAnnouncements(ann.value);
      if (bal.status === 'fulfilled') setBalance(bal.value);
    });
  }, [user]);

  const openIssues = issues.filter((i) => !['resolved'].includes(i.status)).length;
  const activeInvites = invites.filter((v) => ['invited', 'accepted', 'approved'].includes(v.status)).length;

  return (
    <div className="stagger">
      <div className="page-head">
        <div>
          <div className="eyebrow">Resident portal</div>
          <h1 className="page-title">Welcome back, {user.full_name.split(' ')[0]}.</h1>
          <p className="page-sub">
            {resident ? resident.room_name || 'Your room' : 'Your hostel'} · everything you need, in one place.
          </p>
        </div>
        <Link to="/resident/invite" className="btn btn-primary">✉ Invite a guest</Link>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{activeInvites}</div>
          <div className="stat-label">Active invitations</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--red)' }}>{openIssues}</div>
          <div className="stat-label">Open issues</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: 24, color: 'var(--red)' }}>{fmtUGX(balance.outstanding)}</div>
          <div className="stat-label">Amount due</div>
        </div>
        <div className="stat-card">
          <div className="stat-value stat-accent" style={{ fontSize: 24 }}>{fmtUGX(balance.paid)}</div>
          <div className="stat-label">Paid to date</div>
        </div>
      </div>

      <div className="dashboard-columns resident-columns">
        <div className="card">
          <div className="section-title">Recent issues</div>
          {issues.length === 0 ? (
            <Empty icon="⚒" text="No issues reported" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Issue</th><th>Category</th><th>Status</th></tr></thead>
                <tbody>
                  {issues.slice(0, 5).map((i) => (
                    <tr key={i.id}>
                      <td style={{ fontWeight: 500 }}>{i.description}</td>
                      <td className="dim">{i.category || '—'}</td>
                      <td><Badge value={i.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-title">Latest announcements</div>
          {announcements.length === 0 ? (
            <Empty icon="▤" text="No announcements" />
          ) : (
            announcements.slice(0, 4).map((a) => (
              <div key={a.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{a.title}</div>
                <div className="dim" style={{ fontSize: 12 }}>{a.body}</div>
                <div className="mono dim" style={{ fontSize: 10, marginTop: 4 }}>{fmtDateTime(a.created_at)}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
