import React from 'react';

interface GuidingHandOverlayProps {
  /** 'tap' pulses at target (toX, toY); 'drag' glides smoothly from (fromX, fromY) to (toX, toY) */
  mode: 'tap' | 'drag';
  fromX?: string | number;
  fromY?: string | number;
  toX: string | number;
  toY: string | number;
  label?: string;
}

/**
 * GuidingHandOverlay — Theatrical Magrid+ visual guide (IC-1 / UX-03).
 * Demonstrates taps or drag trajectories so pre-readers understand any minigame in 1 second.
 */
export const GuidingHandOverlay: React.FC<GuidingHandOverlayProps> = ({
  mode,
  fromX = '50%',
  fromY = '50%',
  toX,
  toY,
  label,
}) => {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: mode === 'drag' ? fromX : toX,
        top: mode === 'drag' ? fromY : toY,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 25,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
      }}
      className={mode === 'drag' ? 'ak-hand-drag' : 'ak-hand-tap'}
    >
      {/* Target ripple ring */}
      <div
        style={{
          width: 58,
          height: 58,
          borderRadius: '50%',
          border: '3px dashed var(--ak-au-gold)',
          background: 'rgba(197, 158, 73, 0.18)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 6px 18px rgba(43, 51, 48, 0.16)',
        }}
      >
        <svg width="36" height="36" viewBox="0 0 36 36">
          {/* Friendly rounded paw/hand pointer */}
          <path
            d="M16 7a2.8 2.8 0 0 1 5.6 0v8.5h1.2a2.5 2.5 0 0 1 2.5 2.5v1.2h1a2.4 2.4 0 0 1 2.4 2.4v3.9c0 4.5-3.4 7.5-8 7.5h-2.5c-3.8 0-6.8-2.3-8.1-5.8l-1.8-4.6a2.4 2.4 0 0 1 4.3-2l1.4 2.5V7z"
            fill="#FAF8F2"
            stroke="#2B3330"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <circle cx="18.8" cy="6.8" r="1.6" fill="var(--ak-au-gold)" />
        </svg>
      </div>
      {label ? (
        <span
          style={{
            padding: '4px 12px',
            borderRadius: 999,
            background: 'var(--ak-surface)',
            border: '2px solid var(--ak-au-gold)',
            fontWeight: 800,
            fontSize: '0.82rem',
            color: 'var(--ak-ink)',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(43, 51, 48, 0.12)',
          }}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
};
