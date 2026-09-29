import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Badge, Modal, Empty, fmtDateTime, useToast } from '../components/ui.jsx';

export default function Announcements() {
  const [items, setItems] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const toast = useToast();

  function load() { api.get('/announcements').then(setItems).catch((e) => toast(e.message, 'error')); }
  useEffect(() => { load(); }, []);

  async function remove(a) {
    if (!confirm('Delete this announcement?')) return;
    try { await api.del(`/announcements/${a.id}`); toast('Deleted'); load(); }
    catch (e) { toast(e.message, 'error'); }
  }

  return (
    <div className="stagger">
      <div className="page-head">
        <div>
          <div className="eyebrow">Communication · Official updates</div>
          <h1 className="page-title">Announcements</h1>
          <p className="page-sub">Broadcast hostel updates to residents and staff.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ New announcement</button>
      </div>

      {items.length === 0 ? (
        <Empty icon="▤" text="No announcements" />
      ) : (
        <div className="grid">
          {items.map((a) => (
            <div className="card" key={a.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <Badge value={a.audience} label={a.audience === 'all' ? 'Everyone' : a.audience} />
                    <span className="mono dim" style={{ fontSize: 11 }}>{fmtDateTime(a.created_at)}</span>
                  </div>
                  <div className="section-title" style={{ marginBottom: 6 }}>{a.title}</div>
                  <div className="dim" style={{ fontSize: 14 }}>{a.body}</div>
                  <div className="mono dim" style={{ fontSize: 11, marginTop: 8 }}>by {a.author_name || '—'}</div>
                </div>
                <button className="btn btn-sm btn-danger" onClick={() => remove(a)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddAnnouncement onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

function AddAnnouncement({ onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ title: '', body: '', audience: 'all' });
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    try { await api.post('/announcements', form); toast('Announcement posted'); onSaved(); }
    catch (err) { toast(err.message, 'error'); }
  }

  return (
    <Modal title="New Announcement" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field"><label>Title *</label><input className="input" required value={form.title} onChange={(e) => set('title', e.target.value)} /></div>
        <div className="field"><label>Body</label><textarea className="textarea" value={form.body} onChange={(e) => set('body', e.target.value)} /></div>
        <div className="field"><label>Audience</label>
          <select className="select" value={form.audience} onChange={(e) => set('audience', e.target.value)}>
            <option value="all">Everyone</option><option value="residents">Residents</option><option value="staff">Staff</option>
          </select>
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }}>Post announcement</button>
      </form>
    </Modal>
  );
}
