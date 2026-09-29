import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Badge, Empty, TRADES, fmtDateTime, useToast } from '../components/ui.jsx';

export default function ResidentIssues({ user }) {
  const [issues, setIssues] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const toast = useToast();

  function load() {
    api.get('/maintenance').then(setIssues).catch((e) => toast(e.message, 'error'));
  }
  useEffect(() => { load(); }, [user]);

  return (
    <div className="stagger">
      <div className="page-head">
        <div>
          <div className="eyebrow">Resident portal</div>
          <h1 className="page-title">Report an issue</h1>
          <p className="page-sub">Tell management about a problem — it becomes a ticket they assign to the right tradesperson.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>+ Report issue</button>
      </div>

      {showForm && (
        <IssueForm
          onCancel={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}

      <div className="section-title" style={{ marginTop: 8 }}>My tickets</div>
      {issues.length === 0 ? (
        <Empty icon="⚒" text="You have no reported issues" />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Issue</th><th>Category</th><th>Priority</th><th>Status</th><th>Assigned to</th><th>Reported</th></tr>
              </thead>
              <tbody>
                {issues.map((i) => (
                  <tr key={i.id}>
                    <td style={{ fontWeight: 500 }}>{i.description}</td>
                    <td className="dim">{i.category || '—'}</td>
                    <td><Badge value={i.priority} /></td>
                    <td><Badge value={i.status} /></td>
                    <td className="dim">{i.assigned_to || '—'}</td>
                    <td className="mono dim">{fmtDateTime(i.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function IssueForm({ onCancel, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ category: '', description: '', priority: 'normal' });
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    try {
      await api.post('/maintenance', form);
      toast('Ticket submitted to management');
      onSaved();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="section-title">Report an issue</div>
      <form onSubmit={submit}>
        <div className="field"><label>What's the problem? *</label>
          <textarea className="textarea" required value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="e.g. The shower tap is leaking in my room" />
        </div>
        <div className="form-row">
          <div className="field"><label>Category</label>
            <select className="select" value={form.category} onChange={(e) => set('category', e.target.value)}>
              <option value="">— Select —</option>
              {TRADES.map((t) => <option key={t.id} value={t.label}>{t.icon} {t.label}</option>)}
            </select>
          </div>
          <div className="field"><label>Priority</label>
            <select className="select" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary">Submit ticket</button>
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
