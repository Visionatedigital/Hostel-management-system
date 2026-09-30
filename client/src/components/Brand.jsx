import React from 'react';

export default function Brand({ className = '', variant = 'default', compact = false }) {
  const src = '/brand/new-nana-logo.png';
  return (
    <div className={`brand-logo ${variant === 'light' ? 'brand-on-dark' : ''} ${compact ? 'brand-logo-compact' : ''} ${className}`} role="img" aria-label="New Nana Hostel">
      <img className="brand-full" src={src} alt="" />
      <span className="brand-symbol" aria-hidden="true"><img src={src} alt="" /></span>
    </div>
  );
}
