import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Badge, Empty, Modal, fmtUGX, fmtDate, useToast } from '../components/ui.jsx';

export default function ResidentPayments({ user }) {
  const [payments, setPayments] = useState([]);
  const [balance, setBalance] = useState({ outstanding: 0, paid: 0 });
  const [paying, setPaying] = useState(null);
  const toast = useToast();

  function load() {
    api.get('/payments').then(setPayments).catch((e) => toast(e.message, 'error'));
    api.get('/payments/mine/summary').then(setBalance).catch(() => {});
  }
  useEffect(() => { load(); }, [user]);

  return (
    <div className="stagger">
      <div className="page-head">
        <div>
          <div className="eyebrow">Resident portal</div>
          <h1 className="page-title">Payments</h1>
          <p className="page-sub">View your invoices and settle your balance.</p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: 24, color: 'var(--red)' }}>{fmtUGX(balance.outstanding)}</div>
          <div className="stat-label">Outstanding balance</div>
        </div>
        <div className="stat-card">
          <div className="stat-value stat-accent" style={{ fontSize: 24 }}>{fmtUGX(balance.paid)}</div>
          <div className="stat-label">Paid to date</div>
        </div>
      </div>

      {payments.length === 0 ? (
        <Empty icon="₠" text="No payments on record" />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Description</th><th>Type</th><th>Amount</th><th>Status</th><th>Method</th><th>Due</th><th>Paid</th><th></th></tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500 }}>{p.description || p.type}</td>
                    <td className="dim">{p.type}</td>
                    <td className="mono">{fmtUGX(p.amount)}</td>
                    <td><Badge value={p.status} /></td>
                    <td className="dim">{p.method ? p.method.replace('_', ' ') : '—'}</td>
                    <td className="mono dim">{fmtDate(p.due_date)}</td>
                    <td className="mono dim">{fmtDate(p.paid_at)}</td>
                    <td>
                      {(p.status === 'pending' || p.status === 'failed') && (
                        <button className="btn btn-sm btn-primary" onClick={() => setPaying(p)}>Pay now</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {paying && (
        <PayModal
          payment={paying}
          onClose={() => setPaying(null)}
          onPaid={() => { setPaying(null); load(); }}
        />
      )}
    </div>
  );
}

function PayModal({ payment, onClose, onPaid }) {
  const toast = useToast();
  const [method, setMethod] = useState('mtn_momo');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);

  async function pay() {
    setBusy(true);
    try {
      await api.post(`/payments/${payment.id}/pay`, { method });
      toast('Payment successful');
      onPaid();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Pay invoice" onClose={onClose}>
      <div className="verify-facts">
        <div className="fact-row">
          <span className="fact-label">Invoice</span>
          <span className="fact-value">{payment.description || payment.type}</span>
        </div>
        <div className="fact-row">
          <span className="fact-label">Amount</span>
          <span className="fact-value mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{fmtUGX(payment.amount)}</span>
        </div>
      </div>

      <div className="field"><label>Payment method</label>
        <select className="select" value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="mtn_momo">MTN Mobile Money</option>
          <option value="airtel_money">Airtel Money</option>
        </select>
      </div>
      <div className="field"><label>Mobile number</label>
        <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+2567…" />
      </div>

      <div className="dim" style={{ fontSize: 12, marginBottom: 14 }}>
        ⚠️ Demo mode — this simulates a mobile money payment. Connect a payment provider (MTN MoMo / Airtel Money) to collect real funds.
      </div>

      <button className="btn btn-primary" style={{ width: '100%' }} onClick={pay} disabled={busy}>
        {busy ? 'Processing…' : `Pay ${fmtUGX(payment.amount)}`}
      </button>
    </Modal>
  );
}
