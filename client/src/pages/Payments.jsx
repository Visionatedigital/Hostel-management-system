import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Badge, Modal, Empty, fmtUGX, useToast } from '../components/ui.jsx';

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [residents, setResidents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [filter, setFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const toast = useToast();

  function load() {
    Promise.all([
      api.get('/payments'),
      api.get('/payments/summary'),
    ]).then(([p, s]) => { setPayments(p); setSummary(s); }).catch((e) => toast(e.message, 'error'));
  }
  useEffect(() => { load(); api.get('/residents').then(setResidents).catch(() => {}); }, []);

  async function setStatus(p, status) {
    try { await api.put(`/payments/${p.id}`, { status }); toast('Payment updated'); load(); }
    catch (e) { toast(e.message, 'error'); }
  }

  const shown = filter ? payments.filter((p) => p.status === filter) : payments;

  return (
    <div className="stagger">
      <div className="page-head">
        <div>
          <div className="eyebrow">Finance · Rent administration</div>
          <h1 className="page-title">Payments</h1>
          <p className="page-sub">Manual payments and guest sleepover charges. Confirm sleepover charges only after funds are received.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Record payment</button>
      </div>

      <Link className="occupancy-notice dashboard-unpriced" to="/">For tenancy invoices, partial receipts and monthly rent, open the Dashboard →</Link>
      <div className="stat-grid">
        <div className="stat-card"><div className="stat-value stat-accent" style={{ fontSize: 24 }}>{summary ? fmtUGX(summary.total_collected) : '—'}</div><div className="stat-label">Collected (paid)</div></div>
        <div className="stat-card"><div className="stat-value" style={{ fontSize: 24, color: 'var(--red)' }}>{summary ? fmtUGX(summary.total_outstanding) : '—'}</div><div className="stat-label">Outstanding</div></div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {['', 'pending', 'paid', 'failed', 'reversed'].map((s) => (
          <button key={s} className={`btn btn-sm ${filter === s ? 'btn-primary' : ''}`} onClick={() => setFilter(s)}>{s || 'All'}</button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Empty icon="₠" text="No payments" />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Resident</th><th>Type</th><th>Amount</th><th>Status</th><th>Method</th><th>Due</th><th>Paid</th><th>Actions</th></tr></thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500 }}>{p.resident_first} {p.resident_last}</td>
                    <td className="dim">{p.sleepover_visitor_id ? 'Guest sleepover' : p.type}{p.sleepover_visitor_id && <div className="form-help" style={{margin:0}}>{p.description}</div>}</td>
                    <td className="mono">{fmtUGX(p.amount)}</td>
                    <td><Badge value={p.status} /></td>
                    <td className="dim">{(p.sleepover_requested_method || p.method)?.replaceAll('_', ' ') || '—'}</td>
                    <td className="mono dim">{p.due_date || '—'}</td>
                    <td className="mono dim">{p.paid_at || '—'}</td>
                    <td>
                      {p.status !== 'paid' && (
                        <button className="btn btn-sm btn-primary" onClick={() => setStatus(p, 'paid')}>Mark paid</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAdd && <AddPayment residents={residents} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

function AddPayment({ residents, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ resident_id: '', amount: '', type: 'rent', status: 'pending', method: '', due_date: '', description: '' });
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    try { await api.post('/payments', { ...form, amount: Number(form.amount) }); toast('Payment recorded'); onSaved(); }
    catch (err) { toast(err.message, 'error'); }
  }

  return (
    <Modal title="Record Payment" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field"><label>Resident</label>
          <select className="select" value={form.resident_id} onChange={(e) => set('resident_id', e.target.value)}>
            <option value="">— Select —</option>
            {residents.map((r) => <option key={r.id} value={r.id}>{r.first_name} {r.last_name}</option>)}
          </select>
        </div>
        <div className="form-row">
          <div className="field"><label>Amount (UGX) *</label><input className="input" required type="number" value={form.amount} onChange={(e) => set('amount', e.target.value)} /></div>
          <div className="field"><label>Type</label>
            <select className="select" value={form.type} onChange={(e) => set('type', e.target.value)}>
              <option value="rent">Rent</option><option value="deposit">Deposit</option><option value="other">Other</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="field"><label>Status</label>
            <select className="select" value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="pending">Pending</option><option value="paid">Paid</option><option value="failed">Failed</option>
            </select>
          </div>
          <div className="field"><label>Method</label>
            <select className="select" value={form.method} onChange={(e) => set('method', e.target.value)}>
              <option value="">—</option><option value="mtn_momo">MTN MoMo</option><option value="airtel_money">Airtel Money</option>
              <option value="cash">Cash</option><option value="bank">Bank</option><option value="other">Other</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="field"><label>Due date</label><input className="input" type="date" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} /></div>
          <div className="field"><label>Description</label><input className="input" value={form.description} onChange={(e) => set('description', e.target.value)} /></div>
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }}>Record</button>
      </form>
    </Modal>
  );
}
