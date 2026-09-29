import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Avatar, Badge, Modal, Empty, initials } from './ui.jsx';

const TYPE_LABEL = {
  single: 'Single',
  double: 'Double',
  triple: 'Triple',
  quad: 'Quad',
  other: 'Other',
};

export default function RoomRoster({ compact = false }) {
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);

  useEffect(() => {
    api.get('/verify/roster')
      .then(setRoster)
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="empty">Loading roster…</div>;
  }

  return (
    <div>
      {roster.length === 0 ? (
        <Empty icon="👁" text="No residents on record" />
      ) : (
        <div className={compact ? 'room-grid room-grid-compact' : 'room-grid'}>
          {roster.map((room) => (
            <div className="room-card" key={room.id} onClick={() => setSelectedRoom(room)} style={{ cursor: 'pointer' }}>
              <div className="room-head">
                <div>
                  <div className="room-name">{room.name}</div>
                  <div className="room-meta">{TYPE_LABEL[room.type] || room.type} · {room.occupants.length}/{room.capacity} occupied</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="dim" style={{ fontSize: 11 }}>View room ›</span>
                  <Badge value={room.status} />
                </div>
              </div>
              <div className="occupant-list">
                {room.occupants.length === 0 ? (
                  <div className="dim" style={{ padding: 14, fontSize: 13 }}>No occupants</div>
                ) : (
                  room.occupants.map((o) => (
                    <div className="occupant" key={o.id} onClick={(e) => { e.stopPropagation(); setSelected(o); }} style={{ cursor: 'pointer' }}>
                      <Avatar src={o.photo_path} first={o.first_name} last={o.last_name} />
                      <div className="occupant-info">
                        <div className="occupant-name">{o.first_name} {o.last_name}</div>
                        <div className="occupant-id">NIN {o.national_id || '—'}</div>
                      </div>
                      <div className="occupant-verify">
                        <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); setSelected(o); }}>
                          View details
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedRoom && (
        <RoomModal
          room={selectedRoom}
          onClose={() => setSelectedRoom(null)}
          onSelectOccupant={(o) => { setSelectedRoom(null); setSelected(o); }}
        />
      )}

      {selected && <OccupantModal resident={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function RoomModal({ room, onClose, onSelectOccupant }) {
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
          <span className="fact-value">{room.occupants.length} / {room.capacity}</span>
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
      {room.occupants.length === 0 ? (
        <div className="dim" style={{ fontSize: 13, padding: '10px 0' }}>No occupants</div>
      ) : (
        <div className="occupant-list" style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {room.occupants.map((o) => (
            <div className="occupant" key={o.id} onClick={() => onSelectOccupant(o)} style={{ cursor: 'pointer' }}>
              <Avatar src={o.photo_path} first={o.first_name} last={o.last_name} size={44} />
              <div className="occupant-info">
                <div className="occupant-name">{o.first_name} {o.last_name}</div>
                <div className="occupant-id">NIN {o.national_id || '—'}</div>
              </div>
              <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); onSelectOccupant(o); }}>View</button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function OccupantModal({ resident, onClose }) {
  return (
    <Modal title="Occupant Details" onClose={onClose}>
      <div className="verify-photo">
        {resident.photo_path ? (
          <img src={resident.photo_path} alt={`${resident.first_name} ${resident.last_name}`} />
        ) : (
          <span>{initials(resident.first_name, resident.last_name)}</span>
        )}
      </div>

      {!resident.photo_path && (
        <div className="badge badge-red" style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          No photo on file — request ID from the resident
        </div>
      )}

      <div className="verify-facts">
        <div className="fact-row">
          <span className="fact-label">Name</span>
          <span className="fact-value">{resident.first_name} {resident.last_name}</span>
        </div>
        <div className="fact-row">
          <span className="fact-label">Room</span>
          <span className="fact-value">{resident.room_name || '—'} <span className="dim">({resident.room_type || '—'})</span></span>
        </div>
        <div className="fact-row">
          <span className="fact-label">National ID</span>
          <span className="fact-value mono">{resident.national_id || '—'}</span>
        </div>
        <div className="fact-row">
          <span className="fact-label">Phone</span>
          <span className="fact-value mono">{resident.phone || '—'}</span>
        </div>
        <div className="fact-row">
          <span className="fact-label">Email</span>
          <span className="fact-value">{resident.email || '—'}</span>
        </div>
        <div className="fact-row">
          <span className="fact-label">Moved in</span>
          <span className="fact-value mono">{resident.move_in_date || '—'}</span>
        </div>
        <div className="fact-row">
          <span className="fact-label">Status</span>
          <span className="fact-value"><Badge value={resident.status || 'active'} /></span>
        </div>
      </div>

      <button className="btn btn-primary" style={{ width: '100%' }} onClick={onClose}>
        ✓ Match confirmed
      </button>
    </Modal>
  );
}
