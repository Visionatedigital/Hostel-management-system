import React from 'react';
import RoomRoster from '../components/RoomRoster.jsx';

export default function VerifyRoster() {
  return (
    <div className="stagger">
      <div className="page-head">
        <div>
          <div className="eyebrow">Security · Identity check</div>
          <h1 className="page-title">Room Roster</h1>
          <p className="page-sub">
            Confirm a person claiming residence against the official room roster.
          </p>
        </div>
      </div>

      <RoomRoster />
    </div>
  );
}
