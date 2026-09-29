import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Badge, Empty, fmtDateTime, useToast } from '../components/ui.jsx';

export default function ResidentInvite({ user }) {
  const [invites, setInvites] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [justSent, setJustSent] = useState(null);
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  function load() {
    api.get('/invites').then(setInvites).catch((e) => toast(e.message, 'error'));
  }

  useEffect(() => { load(); }, [user]);

  function copyLink() {
    if (!justSent?.invite_url) return;
    navigator.clipboard?.writeText(justSent.invite_url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  return (
    <div className="stagger">
      <div className="page-head">
        <div>
          <div className="eyebrow">Resident portal</div>
          <h1 className="page-title">Invite a guest</h1>
          <p className="page-sub">Send a secure invite — your guest accepts with a selfie and ID.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm((s) => !s); setJustSent(null); }}>
          ✉ {showForm ? 'Close form' : 'New invitation'}
        </button>
      </div>

      {showForm && (
        <InviteForm
          onCancel={() => setShowForm(false)}
          onSent={(invite) => { setJustSent(invite); setShowForm(false); load(); }}
        />
      )}

      {justSent && (
        <div className="card" style={{ marginBottom: 24, borderColor: 'rgba(217,122,38,0.45)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span className="badge badge-green">Invite sent</span>
            <span style={{ fontSize: 14 }}>
              {justSent.email?.sent
                ? `Email delivered to ${justSent.guest_email}`
                : `Email queued for ${justSent.guest_email}`}
            </span>
          </div>
          <div className="dim" style={{ fontSize: 13, marginBottom: 12 }}>
            Share this secure acceptance link with your guest (they'll take a selfie and photograph their ID):
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <code className="mono" style={{ background: 'var(--bg-2)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, wordBreak: 'break-all', flex: 1 }}>
              {justSent.invite_url}
            </code>
            <button className="btn btn-sm" onClick={copyLink}>{copied ? '✓ Copied' : 'Copy'}</button>
            <a className="btn btn-sm" href={justSent.invite_url} target="_blank" rel="noreferrer">Open</a>
          </div>
        </div>
      )}

      <div className="section-title" style={{ marginTop: 8 }}>My invitations</div>
      {invites.length === 0 ? (
        <Empty icon="✉" text="You haven't invited anyone yet" />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Guest</th><th>Ref</th><th>Arrival</th><th>Status</th><th>Sent</th></tr>
              </thead>
              <tbody>
                {invites.map((v) => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 500 }}>{v.guest_name}</td>
                    <td className="mono dim">{v.ref}</td>
                    <td className="mono dim">{fmtDateTime(v.expected_arrival)}</td>
                    <td><Badge value={v.status} /></td>
                    <td className="mono dim">{fmtDateTime(v.created_at)}</td>
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

function InviteForm({ onCancel, onSent }) {
  const toast = useToast();
  const [form, setForm] = useState({
    guest_name: '', guest_email: '', guest_phone: '', purpose: '',
    expected_arrival: '', expected_departure: '', message: '',
  });
  const [busy, setBusy] = useState(false);

  function set(k, v) {
    setForm((f) => {
      const next = { ...f, [k]: v };
      // Visits are usually single-day: default departure to the same day as arrival.
      if (k === 'expected_arrival' && v && !next.expected_departure) {
        const arrival = new Date(v);
        if (!isNaN(arrival)) {
          const dep = new Date(arrival);
          dep.setHours(22, 0, 0, 0); // same day, evening
          next.expected_departure = dep.toISOString().slice(0, 16);
        }
      }
      return next;
    });
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const invite = await api.post('/invites', form);
      toast('Invitation created');
      onSent(invite);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="section-title">Invite a guest</div>
      <form onSubmit={submit}>
        <div className="form-row">
          <div className="field"><label>Guest name *</label><input className="input" required value={form.guest_name} onChange={(e) => set('guest_name', e.target.value)} placeholder="e.g. David Okafor" /></div>
          <div className="field"><label>Guest email *</label><input className="input" required type="email" value={form.guest_email} onChange={(e) => set('guest_email', e.target.value)} placeholder="guest@email.com" /></div>
        </div>
        <div className="form-row">
          <div className="field"><label>Guest phone</label><input className="input" value={form.guest_phone} onChange={(e) => set('guest_phone', e.target.value)} placeholder="+2567…" /></div>
          <div className="field"><label>Purpose</label><input className="input" value={form.purpose} onChange={(e) => set('purpose', e.target.value)} placeholder="Visit, family, study…" /></div>
        </div>
        <div className="form-row">
          <div className="field"><label>Expected arrival</label><input className="input" type="datetime-local" value={form.expected_arrival} onChange={(e) => set('expected_arrival', e.target.value)} /></div>
          <div className="field"><label>Expected departure</label><input className="input" type="datetime-local" value={form.expected_departure} onChange={(e) => set('expected_departure', e.target.value)} /></div>
        </div>
        <div className="dim" style={{ fontSize: 12, marginTop: -8, marginBottom: 12 }}>
          Most visits are single-day — departure auto-fills to the same evening. Change it if your guest is staying overnight.
        </div>
        <div className="field"><label>Message (optional)</label><textarea className="textarea" value={form.message} onChange={(e) => set('message', e.target.value)} placeholder="Looking forward to seeing you!" /></div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send invitation'}</button>
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
