import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Badge, Modal, Empty, fmtDateTime, useToast, TRADES, TRADESPERSONS } from '../components/ui.jsx';

export default function Maintenance() {
  const [items, setItems] = useState([]);
  const [residents, setResidents] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [assigning, setAssigning] = useState(null);
  const toast = useToast();

  function load() { api.get('/maintenance').then(setItems).catch((e) => toast(e.message, 'error')); }
  useEffect(() => {
    load();
    api.get('/residents').then(setResidents).catch(() => {});
    api.get('/rooms').then(setRooms).catch(() => {});
  }, []);

  async function advance(m) {
    const next = { assigned: 'in_progress', in_progress: 'resolved' }[m.status];
    if (!next) return;
    try { await api.put(`/maintenance/${m.id}`, { status: next }); toast(`Moved to ${next.replace(/_/g, ' ')}`); load(); }
    catch (e) { toast(e.message, 'error'); }
  }

  const openCount = items.filter((m) => m.status === 'open').length;

  return (
    <div className="stagger">
      <div className="page-head">
        <div>
          <div className="eyebrow">Management · Resident requests</div>
          <h1 className="page-title">Maintenance</h1>
          <p className="page-sub">Triage tickets and assign the right tradesperson.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ New request</button>
      </div>

      <div className="stat-grid">
        <div className="stat-card"><div className="stat-value stat-accent">{openCount}</div><div className="stat-label">Open tickets</div></div>
        <div className="stat-card"><div className="stat-value">{items.filter((m) => m.status === 'in_progress').length}</div><div className="stat-label">In progress</div></div>
        <div className="stat-card"><div className="stat-value">{items.filter((m) => m.status === 'resolved').length}</div><div className="stat-label">Resolved</div></div>
      </div>

      {items.length === 0 ? (
        <Empty icon="⚒" text="No maintenance requests" />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Issue</th><th>Room</th><th>Resident</th><th>Trade</th><th>Priority</th><th>Status</th><th>Assigned to</th><th>Action</th></tr></thead>
              <tbody>
                {items.map((m) => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 500 }}>{m.description}</td>
                    <td className="mono">{m.room_name || '—'}</td>
                    <td className="dim">{m.resident_first ? `${m.resident_first} ${m.resident_last}` : '—'}</td>
                    <td><Badge value={m.category} label={m.category || 'General'} /></td>
                    <td><Badge value={m.priority} /></td>
                    <td><Badge value={m.status} /></td>
                    <td className="dim">{m.assigned_to || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {m.status === 'open' && (
                          <button className="btn btn-sm btn-primary" onClick={() => setAssigning(m)}>Assign</button>
                        )}
                        {m.status === 'assigned' && (
                          <button className="btn btn-sm" onClick={() => advance(m)}>Start work</button>
                        )}
                        {m.status === 'in_progress' && (
                          <button className="btn btn-sm" onClick={() => advance(m)}>Mark resolved</button>
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

      {assigning && (
        <AssignModal
          request={assigning}
          onClose={() => setAssigning(null)}
          onSaved={() => { setAssigning(null); load(); }}
        />
      )}

      {showAdd && <AddMaintenance residents={residents} rooms={rooms} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

function AssignModal({ request, onClose, onSaved }) {
  const toast = useToast();
  const [category, setCategory] = useState(request.category || '');
  const [person, setPerson] = useState('');
  const [priority, setPriority] = useState(request.priority || 'normal');
  const people = category ? (TRADESPERSONS[TRADES.find((t) => t.label === category)?.id] || []) : [];

  async function assign() {
    if (!category) { toast('Pick a trade first', 'error'); return; }
    if (!person) { toast('Pick a tradesperson', 'error'); return; }
    try {
      await api.put(`/maintenance/${request.id}`, { status: 'assigned', category, assigned_to: person, priority });
      toast(`Assigned to ${person}`);
      onSaved();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <Modal title="Assign ticket" onClose={onClose}>
      <div className="verify-facts">
        <div className="fact-row">
          <span className="fact-label">Issue</span>
          <span className="fact-value">{request.description}</span>
        </div>
        <div className="fact-row">
          <span className="fact-label">Resident</span>
          <span className="fact-value">{request.resident_first ? `${request.resident_first} ${request.resident_last}` : '—'}</span>
        </div>
        <div className="fact-row">
          <span className="fact-label">Room</span>
          <span className="fact-value mono">{request.room_name || '—'}</span>
        </div>
      </div>

      <div className="field"><label>Trade *</label>
        <select className="select" value={category} onChange={(e) => { setCategory(e.target.value); setPerson(''); }}>
          <option value="">— Select a trade —</option>
          {TRADES.map((t) => <option key={t.id} value={t.label}>{t.icon} {t.label}</option>)}
        </select>
      </div>

      <div className="field"><label>Tradesperson *</label>
        <select className="select" value={person} onChange={(e) => setPerson(e.target.value)}>
          <option value="">— Select —</option>
          {people.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="field"><label>Priority</label>
        <select className="select" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
        </select>
      </div>

      <button className="btn btn-primary" style={{ width: '100%' }} onClick={assign}>Assign ticket</button>
    </Modal>
  );
}

function AddMaintenance({ residents, rooms, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ resident_id: '', room_id: '', category: '', description: '', priority: 'normal' });
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    try { await api.post('/maintenance', form); toast('Request created'); onSaved(); }
    catch (err) { toast(err.message, 'error'); }
  }

  return (
    <Modal title="New Maintenance Request" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field"><label>Description *</label><textarea className="textarea" required value={form.description} onChange={(e) => set('description', e.target.value)} /></div>
        <div className="form-row">
          <div className="field"><label>Category</label>
            <select className="select" value={form.category} onChange={(e) => set('category', e.target.value)}>
              <option value="">—</option>{TRADES.map((t) => <option key={t.id} value={t.label}>{t.label}</option>)}
            </select>
          </div>
          <div className="field"><label>Priority</label>
            <select className="select" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
              <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="field"><label>Resident</label>
            <select className="select" value={form.resident_id} onChange={(e) => set('resident_id', e.target.value)}>
              <option value="">—</option>{residents.map((r) => <option key={r.id} value={r.id}>{r.first_name} {r.last_name}</option>)}
            </select>
          </div>
          <div className="field"><label>Room</label>
            <select className="select" value={form.room_id} onChange={(e) => set('room_id', e.target.value)}>
              <option value="">—</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }}>Create request</button>
      </form>
    </Modal>
  );
}
