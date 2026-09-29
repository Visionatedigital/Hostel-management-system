import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Badge, Modal, Empty, fmtDateTime, useToast } from '../components/ui.jsx';

export default function Visitors() {
  const [visitors, setVisitors] = useState([]);
  const [residents, setResidents] = useState([]);
  const [filter, setFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [reviewing, setReviewing] = useState(null);
  const toast = useToast();

  function load() {
    api.get('/visitors').then(setVisitors).catch((e) => toast(e.message, 'error'));
  }
  useEffect(() => { load(); api.get('/residents').then(setResidents).catch(() => {}); }, []);

  async function setStatus(v, status) {
    try {
      await api.put(`/visitors/${v.id}`, { status });
      toast(`Visitor ${status.replace(/_/g, ' ')}`);
      load();
      setReviewing(null);
    } catch (e) { toast(e.message, 'error'); }
  }

  const shown = filter ? visitors.filter((v) => v.status === filter) : visitors;

  return (
    <div className="stagger">
      <div className="page-head">
        <div>
          <div className="eyebrow">Security · Guest register</div>
          <h1 className="page-title">Visitors</h1>
          <p className="page-sub">Invited guests, accepted invites, approvals, check-ins and departures.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Register visitor</button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {['', 'invited', 'accepted', 'arrival_requested', 'approved', 'checked_in', 'overdue', 'checked_out', 'declined'].map((s) => (
          <button
            key={s}
            className={`btn btn-sm ${filter === s ? 'btn-primary' : ''}`}
            onClick={() => setFilter(s)}
          >
            {s ? s.replace(/_/g, ' ') : 'All'}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Empty icon="⇄" text="No visitors" />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Ref</th><th>Guest</th><th>Host</th><th>Room</th><th>Status</th><th>Check-in</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {shown.map((v) => (
                  <tr key={v.id}>
                    <td className="mono dim">{v.ref}</td>
                    <td style={{ fontWeight: 500 }}>{v.guest_name}</td>
                    <td className="dim">{v.resident_first} {v.resident_last}</td>
                    <td className="mono dim">{v.room_name || '—'}</td>
                    <td><Badge value={v.status} /></td>
                    <td className="mono dim">{fmtDateTime(v.check_in_time)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {v.status === 'accepted' && (
                          <button className="btn btn-sm btn-primary" onClick={() => setReviewing(v)}>Review &amp; approve</button>
                        )}
                        {v.status === 'approved' && (
                          <button className="btn btn-sm btn-primary" onClick={() => setStatus(v, 'checked_in')}>Check in</button>
                        )}
                        {v.status === 'checked_in' && (
                          <button className="btn btn-sm" onClick={() => setStatus(v, 'checked_out')}>Check out</button>
                        )}
                        {(v.status === 'invited' || v.status === 'arrival_requested') && (
                          <>
                            <button className="btn btn-sm btn-primary" onClick={() => setStatus(v, 'approved')}>Approve</button>
                            <button className="btn btn-sm btn-danger" onClick={() => setStatus(v, 'declined')}>Decline</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {reviewing && (
        <ReviewVisitor
          visitor={reviewing}
          onClose={() => setReviewing(null)}
          onApprove={() => setStatus(reviewing, 'approved')}
          onDecline={() => setStatus(reviewing, 'declined')}
        />
      )}

      {showAdd && (
        <AddVisitor
          residents={residents}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); }}
        />
      )}
    </div>
  );
}

function ReviewVisitor({ visitor, onClose, onApprove, onDecline }) {
  return (
    <Modal title="Identity Review" onClose={onClose}>
      <div className="verify-facts">
        <div className="fact-row">
          <span className="fact-label">Guest</span>
          <span className="fact-value">{visitor.guest_name}</span>
        </div>
        <div className="fact-row">
          <span className="fact-label">Host</span>
          <span className="fact-value">{visitor.resident_first} {visitor.resident_last} · {visitor.room_name || '—'}</span>
        </div>
        <div className="fact-row">
          <span className="fact-label">Expected</span>
          <span className="fact-value mono">{fmtDateTime(visitor.expected_arrival)}</span>
        </div>
        <div className="fact-row">
          <span className="fact-label">Status</span>
          <span className="fact-value"><Badge value={visitor.status} /></span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
        <div>
          <div className="fact-label" style={{ marginBottom: 6 }}>Selfie</div>
          <div className="verify-photo" style={{ maxWidth: '100%' }}>
            {visitor.selfie_path ? <img src={visitor.selfie_path} alt="Selfie" /> : <span style={{ fontSize: 30 }}>—</span>}
          </div>
        </div>
        <div>
          <div className="fact-label" style={{ marginBottom: 6 }}>ID photo</div>
          <div className="verify-photo" style={{ maxWidth: '100%' }}>
            {visitor.id_photo_path ? <img src={visitor.id_photo_path} alt="ID" /> : <span style={{ fontSize: 30 }}>—</span>}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={onApprove}>✓ Identity verified — approve</button>
        <button className="btn btn-danger" onClick={onDecline}>Decline</button>
      </div>
    </Modal>
  );
}

function AddVisitor({ residents, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ guest_name: '', guest_phone: '', id_number: '', purpose: '', resident_id: '', expected_arrival: '', expected_departure: '' });

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    try {
      await api.post('/visitors', form);
      toast('Visitor registered');
      onSaved();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <Modal title="Register Visitor" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-row">
          <div className="field"><label>Guest name *</label><input className="input" required value={form.guest_name} onChange={(e) => set('guest_name', e.target.value)} /></div>
          <div className="field"><label>Guest phone</label><input className="input" value={form.guest_phone} onChange={(e) => set('guest_phone', e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="field"><label>ID number</label><input className="input" value={form.id_number} onChange={(e) => set('id_number', e.target.value)} /></div>
          <div className="field"><label>Host resident</label>
            <select className="select" value={form.resident_id} onChange={(e) => set('resident_id', e.target.value)}>
              <option value="">— Select —</option>
              {residents.filter((r) => r.status === 'active').map((r) => (
                <option key={r.id} value={r.id}>{r.first_name} {r.last_name} ({r.room_name})</option>
              ))}
            </select>
          </div>
        </div>
        <div className="field"><label>Purpose</label><input className="input" value={form.purpose} onChange={(e) => set('purpose', e.target.value)} placeholder="Visit, family, delivery…" /></div>
        <div className="form-row">
          <div className="field"><label>Expected arrival</label><input className="input" type="datetime-local" value={form.expected_arrival} onChange={(e) => set('expected_arrival', e.target.value)} /></div>
          <div className="field"><label>Expected departure</label><input className="input" type="datetime-local" value={form.expected_departure} onChange={(e) => set('expected_departure', e.target.value)} /></div>
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }}>Register</button>
      </form>
    </Modal>
  );
}
