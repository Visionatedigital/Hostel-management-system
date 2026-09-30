import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Badge, Modal, Empty, useToast } from '../components/ui.jsx';

const TYPE_LABEL = { single: 'Single', double: 'Double', triple: 'Triple', quad: 'Quad', other: 'Other' };

export default function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const toast = useToast();

  function load() { api.get('/rooms').then(setRooms).catch((e) => toast(e.message, 'error')); }
  useEffect(() => { load(); }, []);

  async function remove(r) {
    if (!confirm(`Delete ${r.name}?`)) return;
    try { await api.del(`/rooms/${r.id}`); toast('Room deleted'); load(); }
    catch (e) { toast(e.message, 'error'); }
  }

  return (
    <div className="stagger">
      <div className="page-head">
        <div>
          <div className="eyebrow">Records · Accommodation</div>
          <h1 className="page-title">Rooms</h1>
          <p className="page-sub">Open a room to manage occupants, rent, repairs and visits.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add room</button>
      </div>

      <div className="room-grid">
        {rooms.length === 0 && <Empty icon="▣" text="No rooms" />}
        {rooms.map((r) => (
          <div className="room-card" key={r.id} >
            <Link className="room-head" to={`/rooms/${r.id}`}>
              <div>
                <div className="room-name">{r.name}</div>
                <div className="room-meta">{r.floor || '—'} · {TYPE_LABEL[r.type]}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="dim" style={{ fontSize: 11 }}>View room ›</span>
                <Badge value={r.status} />
              </div>
            </Link>
            <div style={{ padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="dim" style={{ fontSize: 13 }}>{r.occupant_count}/{r.capacity} occupants</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); setEditing(r); }}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={(e) => { e.stopPropagation(); remove(r); }}>✕</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {(showAdd || editing) && (
        <RoomForm room={editing} onClose={() => { setShowAdd(false); setEditing(null); }} onSaved={() => { setShowAdd(false); setEditing(null); load(); }} />
      )}

    </div>
  );
}

export function RoomForm({ room, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: room?.name || '',
    floor: room?.floor || '',
    type: room?.type || 'double',
    capacity: room?.capacity || 2,
    status: room?.status || 'available',
    notes: room?.notes || '',
  });
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    try {
      if (room) await api.put(`/rooms/${room.id}`, form);
      else await api.post('/rooms', form);
      toast('Room saved');
      onSaved();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <Modal title={room ? 'Edit Room' : 'Add Room'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-row">
          <div className="field"><label>Room name *</label><input className="input" required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Room 101" /></div>
          <div className="field"><label>Floor</label><input className="input" value={form.floor} onChange={(e) => set('floor', e.target.value)} placeholder="Ground" /></div>
        </div>
        <div className="form-row">
          <div className="field"><label>Type</label>
            <select className="select" value={form.type} onChange={(e) => set('type', e.target.value)}>
              <option value="single">Single</option>
              <option value="double">Double</option>
              <option value="triple">Triple</option>
              <option value="quad">Quad</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="field"><label>Capacity</label>
            <input className="input" type="number" min="1" value={form.capacity} onChange={(e) => set('capacity', Number(e.target.value))} />
          </div>
        </div>
        <div className="field"><label>Status</label>
          <select className="select" value={form.status} onChange={(e) => set('status', e.target.value)}>
            <option value="available">Available</option>
            <option value="occupied">Occupied</option>
            <option value="maintenance">Maintenance</option>
            <option value="reserved">Reserved</option>
          </select>
        </div>
        <div className="field"><label>Notes</label><textarea className="textarea" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
        <button className="btn btn-primary" style={{ width: '100%' }}>{room ? 'Save changes' : 'Add room'}</button>
      </form>
    </Modal>
  );
}
