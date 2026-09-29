import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { Avatar, Badge, Modal, Empty, useToast } from '../components/ui.jsx';

export default function Residents() {
  const [residents, setResidents] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState('');
  const toast = useToast();

  function load() {
    api.get('/residents').then(setResidents).catch((e) => toast(e.message, 'error'));
  }
  useEffect(() => { load(); api.get('/rooms').then(setRooms).catch(() => {}); }, []);

  async function remove(r) {
    if (!confirm(`Remove ${r.first_name} ${r.last_name}?`)) return;
    try { await api.del(`/residents/${r.id}`); toast('Resident removed'); load(); }
    catch (e) { toast(e.message, 'error'); }
  }

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return residents;
    return residents.filter((r) =>
      `${r.first_name} ${r.last_name} ${r.room_name || ''} ${r.phone || ''} ${r.national_id || ''} ${r.email || ''}`.toLowerCase().includes(q)
    );
  }, [residents, query]);

  return (
    <div className="stagger">
      <div className="page-head">
        <div>
          <div className="eyebrow">Records · Occupancy</div>
          <h1 className="page-title">Residents</h1>
          <p className="page-sub">Every registered resident and their room allocation.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add resident</button>
      </div>

      <div className="roster-search">
        <input
          className="input"
          placeholder="Search name, room, phone, email or national ID…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="badge badge-amber">{shown.length} of {residents.length}</span>
      </div>

      {shown.length === 0 ? (
        <Empty icon="▦" text={query ? 'No residents match your search' : 'No residents'} />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th></th><th>Name</th><th>Room</th><th>Phone</th><th>National ID</th><th>Status</th><th>Moved in</th><th></th></tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td><Avatar src={r.photo_path} first={r.first_name} last={r.last_name} size={38} /></td>
                    <td style={{ fontWeight: 500 }}>{r.first_name} {r.last_name}</td>
                    <td className="mono">{r.room_name || '—'}</td>
                    <td className="mono dim">{r.phone || '—'}</td>
                    <td className="mono dim">{r.national_id || '—'}</td>
                    <td><Badge value={r.status} /></td>
                    <td className="mono dim">{r.move_in_date || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm" onClick={() => setEditing(r)}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => remove(r)}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(showAdd || editing) && (
        <ResidentForm
          resident={editing}
          rooms={rooms}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          onSaved={() => { setShowAdd(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function ResidentForm({ resident, rooms, onClose, onSaved }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const [form, setForm] = useState({
    first_name: resident?.first_name || '',
    last_name: resident?.last_name || '',
    phone: resident?.phone || '',
    email: resident?.email || '',
    national_id: resident?.national_id || '',
    room_id: resident?.room_id || '',
    status: resident?.status || 'active',
    move_in_date: resident?.move_in_date || '',
    photo_path: resident?.photo_path || '',
  });
  const [uploading, setUploading] = useState(false);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function uploadPhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await api.upload('/uploads/photo', fd);
      set('photo_path', res.path);
      toast('Photo uploaded');
    } catch (err) { toast(err.message, 'error'); }
    finally { setUploading(false); }
  }

  async function submit(e) {
    e.preventDefault();
    try {
      if (resident) await api.put(`/residents/${resident.id}`, form);
      else await api.post('/residents', form);
      toast('Resident saved');
      onSaved();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <Modal title={resident ? 'Edit Resident' : 'Add Resident'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-row">
          <div className="field"><label>First name *</label><input className="input" required value={form.first_name} onChange={(e) => set('first_name', e.target.value)} /></div>
          <div className="field"><label>Last name *</label><input className="input" required value={form.last_name} onChange={(e) => set('last_name', e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="field"><label>Phone</label><input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
          <div className="field"><label>Email</label><input className="input" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="field"><label>National ID</label><input className="input" value={form.national_id} onChange={(e) => set('national_id', e.target.value)} /></div>
          <div className="field"><label>Room</label>
            <select className="select" value={form.room_id} onChange={(e) => set('room_id', e.target.value)}>
              <option value="">— Unassigned —</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.type})</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="field"><label>Status</label>
            <select className="select" value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="departed">Departed</option>
            </select>
          </div>
          <div className="field"><label>Move-in date</label><input className="input" type="date" value={form.move_in_date} onChange={(e) => set('move_in_date', e.target.value)} /></div>
        </div>

        <div className="field">
          <label>Occupant photo (for gate verification)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar src={form.photo_path} first={form.first_name} last={form.last_name} size={52} />
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={uploadPhoto} />
            <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? 'Uploading…' : 'Upload photo'}
            </button>
            {form.photo_path && (
              <button type="button" className="btn btn-sm btn-danger" onClick={() => set('photo_path', '')}>Remove</button>
            )}
          </div>
        </div>

        <button className="btn btn-primary" style={{ width: '100%' }}>{resident ? 'Save changes' : 'Add resident'}</button>
      </form>
    </Modal>
  );
}
