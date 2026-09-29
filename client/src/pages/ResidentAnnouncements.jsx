import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Badge, Empty, fmtDateTime, useToast } from '../components/ui.jsx';

export default function ResidentAnnouncements({ user }) {
  const [items, setItems] = useState([]);
  const toast = useToast();

  useEffect(() => {
    api.get('/announcements').then(setItems).catch((e) => toast(e.message, 'error'));
  }, [user]);

  return (
    <div className="stagger">
      <div className="page-head">
        <div>
          <div className="eyebrow">Resident portal</div>
          <h1 className="page-title">Announcements</h1>
          <p className="page-sub">Official updates from your hostel.</p>
        </div>
      </div>

      {items.length === 0 ? (
        <Empty icon="▤" text="No announcements" />
      ) : (
        <div className="grid">
          {items.map((a) => (
            <div className="card" key={a.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Badge value={a.audience} label={a.audience === 'all' ? 'Everyone' : a.audience} />
                <span className="mono dim" style={{ fontSize: 11 }}>{fmtDateTime(a.created_at)}</span>
              </div>
              <div className="section-title" style={{ marginBottom: 6 }}>{a.title}</div>
              <div className="dim" style={{ fontSize: 14 }}>{a.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
