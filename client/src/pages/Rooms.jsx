import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Avatar, Badge, Modal, Empty, useToast, initials } from '../components/ui.jsx';

const TYPE_LABEL = { single: 'Single', double: 'Double', triple: 'Triple', quad: 'Quad', other: 'Other' };

export default function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const toast = useToast();

  function load() { api.get('/rooms').then(setRooms).catch((e) => toast(e.message, 'error')); }
  useEffect(() => { load(); }, []);

  async function remove(r) {
    if (!confirm(`Delete ${r.name}?`)) return;
    try { await api.del(`/rooms/${r.id}`); toast('Room deleted'); load(); }
    catch (e) { toast(e.message, 'error'); }
  }

  async function viewRoom(r) {
    try {
      const detail = await api.get(`/rooms/${r.id}`);
      setViewing(detail);
    } catch (e) { toast(e.message, 'error'); }
  }

  return (
    <div className="stagger">
      <div className="page-head">
        <div>
          <div className="eyebrow">Records · Accommodation</div>
          <h1 className="page-title">Rooms</h1>
          <p className="page-sub">Click a room to see its details and occupants.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add room</button>
      </div>

      <div className="room-grid">
        {rooms.length === 0 && <Empty icon="▣" text="No rooms" />}
        {rooms.map((r) => (
          <div className="room-card" key={r.id} onClick={() => viewRoom(r)} style={{ cursor: 'pointer' }}>
            <div className="room-head">
              <div>
                <div className="room-name">{r.name}</div>
                <div className="room-meta">{r.floor || '—'} · {TYPE_LABEL[r.type]}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="dim" style={{ fontSize: 11 }}>View room ›</span>
                <Badge value={r.status} />
              </div>
            </div>
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

      {viewing && (
        <RoomDetail room={viewing} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}

function RoomDetail({ room, onClose }) {
  return (
    <Modal title={room.name} onClose={onClose}>
      <div className="verify-facts">
        <div className="fact-row">
          <span className="fact-label">Room type</span>
          <span className="fact-value">{TYPE_LABEL[room.type] || room.type}</span>
        </div>
        {room.floor != null && room.floor !== '' && (
          <div className="fact-row">
            <span className="fact-label">Floor</span>
            <span className="fact-value">{room.floor}</span>
          </div>
        )}
        <div className="fact-row">
          <span className="fact-label">Capacity</span>
          <span className="fact-value">{room.capacity}</span>
        </div>
        <div className="fact-row">
          <span className="fact-label">Occupancy</span>
          <span className="fact-value">{(room.occupants || []).length} / {room.capacity}</span>
        </div>
        <div className="fact-row">
          <span className="fact-label">Status</span>
          <span className="fact-value"><Badge value={room.status} /></span>
        </div>
        {room.notes && (
          <div className="fact-row">
            <span className="fact-label">Notes</span>
            <span className="fact-value">{room.notes}</span>
          </div>
        )}
      </div>

      <div className="fact-label" style={{ margin: '16px 0 6px' }}>Occupants</div>
      {(room.occupants || []).length === 0 ? (
        <div className="dim" style={{ fontSize: 13, padding: '10px 0' }}>No occupants</div>
      ) : (
        <div className="occupant-list" style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {room.occupants.map((o) => (
            <div className="occupant" key={o.id}>
              <Avatar src={o.photo_path} first={o.first_name} last={o.last_name} size={44} />
              <div className="occupant-info">
                <div className="occupant-name">{o.first_name} {o.last_name}</div>
                <div className="occupant-id">NIN {o.national_id || '—'}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function RoomForm({ room, onClose, onSaved }) {
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
