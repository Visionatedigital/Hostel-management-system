import React, { useEffect, useRef, useState } from 'react';
import Brand from './Brand.jsx';

// Keep short requests visible for one gentle pulse, then fade over the next view.
const MIN_VISIBLE_MS = 440;
const FADE_OUT_MS = 160;

export default function BrandLoader({ active, label = 'Loading…', fullscreen = true }) {
  const [visible, setVisible] = useState(active);
  const [exiting, setExiting] = useState(false);
  const startedAt = useRef(active ? performance.now() : 0);
  const lastActiveLabel = useRef(label);
  if (active) lastActiveLabel.current = label;

  useEffect(() => {
    let holdTimer;
    let fadeTimer;
    if (active) {
      startedAt.current = performance.now();
      setVisible(true);
      setExiting(false);
    } else if (visible) {
      const remaining = Math.max(0, MIN_VISIBLE_MS - (performance.now() - startedAt.current));
      holdTimer = window.setTimeout(() => {
        setExiting(true);
        fadeTimer = window.setTimeout(() => setVisible(false), FADE_OUT_MS);
      }, remaining);
    }
    return () => {
      window.clearTimeout(holdTimer);
      window.clearTimeout(fadeTimer);
    };
  }, [active, visible]);

  if (!visible) return null;
  return (
    <div className={`brand-loader ${fullscreen ? 'brand-loader-fullscreen' : 'brand-loader-inline'} ${exiting ? 'brand-loader-exiting' : ''}`} role="status" aria-live="polite" aria-busy={active}>
      <div className="brand-loader-content">
        <Brand className="brand-loader-logo" />
        <span className="brand-loader-label">{lastActiveLabel.current}</span>
      </div>
    </div>
  );
}
