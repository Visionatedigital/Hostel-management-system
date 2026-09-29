import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Badge, Modal, Empty, fmtUGX, useToast } from '../components/ui.jsx';

export default function Inspections() {
  const [items, setItems] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [residents, setResidents] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const toast = useToast();

  function load() { api.get('/inspections').then(setItems).catch((e) => toast(e.message, 'error')); }
  useEffect(() => {
    load();
    api.get('/rooms').then(setRooms).catch(() => {});
    api.get('/residents').then(setResidents).catch(() => {});
  }, []);

  async function setDeposit(i, status) {
    try { await api.put(`/inspections/${i.id}`, { deposit_status: status }); toast('Deposit status updated'); load(); }
    catch (e) { toast(e.message, 'error'); }
  }

  return (
    <div className="stagger">
      <div className="page-head">
        <div>
          <div className="eyebrow">Operations · Move-out &amp; deposits</div>
          <h1 className="page-title">Inspections</h1>
          <p className="page-sub">Room condition records, handover and deposit settlement.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ New inspection</button>
      </div>

      {items.length === 0 ? (
        <Empty icon="☰" text="No inspections" />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Room</th><th>Resident</th><th>Date</th><th>Keys</th><th>Deductions</th><th>Deposit status</th><th>Action</th></tr></thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td className="mono">{i.room_name || '—'}</td>
                    <td style={{ fontWeight: 500 }}>{i.resident_first ? `${i.resident_first} ${i.resident_last}` : '—'}</td>
                    <td className="mono dim">{i.inspection_date || '—'}</td>
                    <td>{i.returned_keys ? '✓ Yes' : '✗ No'}</td>
                    <td className="mono">{fmtUGX(i.deductions_proposed)}</td>
                    <td><Badge value={i.deposit_status} /></td>
                    <td>
                      {i.deposit_status !== 'settled' && i.deposit_status !== 'refunded' && (
                        <select className="select" style={{ width: 'auto', padding: '5px 8px', fontSize: 12 }} value={i.deposit_status} onChange={(e) => setDeposit(i, e.target.value)}>
                          <option value="pending">Pending</option>
                          <option value="proposed">Proposed</option>
                          <option value="disputed">Disputed</option>
                          <option value="approved">Approved</option>
                          <option value="refunded">Refunded</option>
                          <option value="settled">Settled</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAdd && <AddInspection rooms={rooms} residents={residents} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

function AddInspection({ rooms, residents, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ room_id: '', resident_id: '', inspection_date: '', condition_notes: '', returned_keys: true, deductions_proposed: 0, deposit_status: 'pending' });
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    try { await api.post('/inspections', { ...form, deductions_proposed: Number(form.deductions_proposed) }); toast('Inspection recorded'); onSaved(); }
    catch (err) { toast(err.message, 'error'); }
  }

  return (
    <Modal title="New Inspection" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-row">
          <div className="field"><label>Room</label>
            <select className="select" value={form.room_id} onChange={(e) => set('room_id', e.target.value)}>
              <option value="">—</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="field"><label>Resident</label>
            <select className="select" value={form.resident_id} onChange={(e) => set('resident_id', e.target.value)}>
              <option value="">—</option>{residents.map((r) => <option key={r.id} value={r.id}>{r.first_name} {r.last_name}</option>)}
            </select>
          </div>
        </div>
        <div className="field"><label>Inspection date</label><input className="input" type="date" value={form.inspection_date} onChange={(e) => set('inspection_date', e.target.value)} /></div>
        <div className="field"><label>Condition notes</label><textarea className="textarea" value={form.condition_notes} onChange={(e) => set('condition_notes', e.target.value)} /></div>
        <div className="form-row">
          <div className="field"><label>Deductions (UGX)</label><input className="input" type="number" min="0" value={form.deductions_proposed} onChange={(e) => set('deductions_proposed', e.target.value)} /></div>
          <div className="field"><label>Keys returned</label>
            <select className="select" value={form.returned_keys} onChange={(e) => set('returned_keys', e.target.value === 'true')}>
              <option value="true">Yes</option><option value="false">No</option>
            </select>
          </div>
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }}>Record inspection</button>
      </form>
    </Modal>
  );
}
