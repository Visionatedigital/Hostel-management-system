import React, { useEffect, useRef, useState } from 'react';
import Brand from '../components/Brand.jsx';
import { useParams } from 'react-router-dom';
import { fmtDateTime } from '../components/ui.jsx';

export default function AcceptInvite() {
  const { token } = useParams();
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState('');
  const [selfie, setSelfie] = useState(null);
  const [idPhoto, setIdPhoto] = useState(null);
  const [selfiePreview, setSelfiePreview] = useState(null);
  const [idPreview, setIdPreview] = useState(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const selfieRef = useRef(null);
  const idRef = useRef(null);

  useEffect(() => {
    fetch(`/api/invites/${token}`)
      .then((r) => (r.ok ? r.json() : r.json().then((d) => { throw new Error(d.error || 'Invitation not found'); })))
      .then(setInvite)
      .catch((e) => setError(e.message));
  }, [token]);

  function onFile(e, kind) {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (kind === 'selfie') { setSelfie(file); setSelfiePreview(url); }
    else { setIdPhoto(file); setIdPreview(url); }
  }

  async function accept() {
    if (!selfie || !idPhoto) { setError('Please add both a selfie and an ID photo.'); return; }
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('selfie', selfie);
      fd.append('id_photo', idPhoto);
      const r = await fetch(`/api/invites/${token}/accept`, { method: 'POST', body: fd });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Failed to accept invitation');
      setAccepted(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !invite) {
    return <Centered><div className="badge badge-red" style={{ fontSize: 14, padding: '10px 18px' }}>{error}</div></Centered>;
  }

  if (!invite) {
    return <Centered><div style={{ color: 'var(--text-dim)' }}>Loading invitation…</div></Centered>;
  }

  if (accepted) {
    return (
      <Centered>
        <div className="auth-card"><Brand className="invite-logo" />
          <div className="auth-brand">
            <div className="auth-mark">✓</div>
            <div>
              <div className="auth-title">Invitation accepted</div>
              <div className="auth-sub">Your selfie and ID have been received.</div>
            </div>
          </div>
          <p className="dim" style={{ fontSize: 14 }}>
            When you arrive at the gate, tell security your name — your accepted invitation will appear in their system, and they'll verify your identity before you enter.
          </p>
        </div>
      </Centered>
    );
  }

  const alreadyHandled = invite.status !== 'invited';

  return (
    <div className="auth-shell">
      <div className="auth-card" style={{ maxWidth: 520 }}>
        <div className="auth-brand">
          <Brand className="invite-logo" />
          <div>
            <div className="auth-title">You're invited</div>
            <div className="auth-sub">New Nana Hostel visitor check-in</div>
          </div>
        </div>

        <div className="verify-facts" style={{ marginBottom: 14 }}>
          <div className="fact-row">
            <span className="fact-label">Host</span>
            <span className="fact-value">{invite.host_name}</span>
          </div>
          <div className="fact-row">
            <span className="fact-label">Guest</span>
            <span className="fact-value">{invite.guest_name}</span>
          </div>
          {invite.purpose && (
            <div className="fact-row">
              <span className="fact-label">Purpose</span>
              <span className="fact-value">{invite.purpose}</span>
            </div>
          )}
          <div className="fact-row">
            <span className="fact-label">Arrival</span>
            <span className="fact-value mono">{fmtDateTime(invite.expected_arrival)}</span>
          </div>
          <div className="fact-row">
            <span className="fact-label">Departure</span>
            <span className="fact-value mono">{fmtDateTime(invite.expected_departure)}</span>
          </div>
        </div>

        {invite.message && (
          <div className="card" style={{ marginBottom: 14, padding: 14 }}>
            <div className="fact-label" style={{ marginBottom: 4 }}>Message from {invite.host_name.split(' ')[0]}</div>
            <div style={{ fontSize: 14 }}>{invite.message}</div>
          </div>
        )}

        {alreadyHandled ? (
          <div className="badge badge-red" style={{ fontSize: 13, padding: '10px 16px' }}>
            This invitation has already been {invite.status.replace(/_/g, ' ')}
          </div>
        ) : (
          <>
            <p className="dim" style={{ fontSize: 13, marginBottom: 16 }}>
              To accept, please take a <strong style={{ color: 'var(--text)' }}>selfie</strong> and photograph your <strong style={{ color: 'var(--text)' }}>ID</strong>. Security will use these to verify you at the gate.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <PhotoField label="Selfie" preview={selfiePreview} onClick={() => selfieRef.current?.click()} />
              <PhotoField label="ID photo" preview={idPreview} onClick={() => idRef.current?.click()} />
              <input ref={selfieRef} type="file" accept="image/*" capture="user" hidden onChange={(e) => onFile(e, 'selfie')} />
              <input ref={idRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e, 'id_photo')} />
            </div>

            {error && <div className="toast error" style={{ position: 'static', marginBottom: 14 }}>{error}</div>}

            <button className="btn btn-primary" style={{ width: '100%' }} onClick={accept} disabled={busy || !selfie || !idPhoto}>
              {busy ? 'Accepting…' : 'Accept invitation'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function PhotoField({ label, preview, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        border: '1px dashed var(--border-strong)',
        borderRadius: 12,
        height: 140,
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
        overflow: 'hidden',
        background: 'var(--bg-2)',
      }}
    >
      {preview ? (
        <img src={preview} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <div style={{ textAlign: 'center', color: 'var(--text-faint)' }}>
          <div style={{ fontSize: 26 }}>{label === 'Selfie' ? '🤳' : '🪪'}</div>
          <div style={{ fontSize: 12 }}>Add {label}</div>
        </div>
      )}
    </div>
  );
}

function Centered({ children }) {
  return <div className="auth-shell">{children}</div>;
}
