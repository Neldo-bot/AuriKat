import React, { useRef, useState } from 'react';
import type { SensoryCalmSettings } from '@aurikat/core-engine';

interface SensoryCalmBarProps {
  settings: SensoryCalmSettings;
  showHomeButton: boolean;
  onGoHome: () => void;
  onToggleMute: () => void;
  onToggleDim: () => void;
  onToggleMotion: () => void;
  onOpenPause: () => void;
  onUnlockParentalGate: () => void;
}

/**
 * Persistent Sensory Calm Bar (GAIA VI/VII + WCAG 2.2 SC 2.3.3 + IC-3).
 * Discreet adult hold-3s button in corner prevents accidental child taps.
 */
export const SensoryCalmBar: React.FC<SensoryCalmBarProps> = ({
  settings,
  showHomeButton,
  onGoHome,
  onToggleMute,
  onToggleDim,
  onToggleMotion,
  onOpenPause,
  onUnlockParentalGate,
}) => {
  const [holdPct, setHoldPct] = useState(0);
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  const startHold = () => {
    startRef.current = performance.now();
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      const elapsed = performance.now() - startRef.current;
      const pct = Math.min(100, Math.round((elapsed / 2500) * 100));
      setHoldPct(pct);
      if (pct >= 100) {
        stopHold();
        onUnlockParentalGate();
      }
    }, 60);
  };

  const stopHold = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setHoldPct(0);
  };

  return (
    <header className="ak-topbar" aria-label="Barra de calma sensorial">
      <div className="ak-row">
        {showHomeButton ? (
          <button
            type="button"
            className="ak-icon-btn"
            onClick={onGoHome}
            aria-label="Volver al rincón de AuriKat"
            title="Volver al rincón"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 10.5L12 3l9 7.5" />
              <path d="M5.5 9.5V20h13V9.5" />
            </svg>
          </button>
        ) : null}
        <div className="ak-brand-chip">
          <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true">
            <circle cx="16" cy="16" r="14" fill="var(--ak-accent-soft)" />
            <path
              d="M8.5 16 C8.5 11.8, 13.5 11.8, 16 16 C18.5 20.2, 23.5 20.2, 23.5 16 C23.5 11.8, 18.5 11.8, 16 16 C13.5 20.2, 8.5 20.2, 8.5 16 Z"
              fill="none"
              stroke="var(--ak-au-gold)"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
          </svg>
          <span>AuriKat</span>
        </div>
      </div>

      <div className="ak-calm-controls">
        {/* 1-tap Mute (IC-3 anti-hyperacusis) */}
        <button
          type="button"
          className="ak-icon-btn"
          data-active={settings.muted}
          onClick={onToggleMute}
          aria-label={settings.muted ? 'Activar sonido suave' : 'Silenciar sonido'}
          title={settings.muted ? 'Sonido silenciado' : 'Silenciar'}
        >
          {settings.muted ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <line x1="22" y1="9" x2="16" y2="15" />
              <line x1="16" y1="9" x2="22" y2="15" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              <path d="M18.8 5.8a9 9 0 0 1 0 12.4" />
            </svg>
          )}
        </button>

        {/* Warm Dim Light */}
        <button
          type="button"
          className="ak-icon-btn"
          data-active={settings.dimLight}
          onClick={onToggleDim}
          aria-label="Luz calma tenue"
          title="Luz tenue"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          </svg>
        </button>

        {/* Motion Scale Toggle (WCAG 2.2 SC 2.3.3) */}
        <button
          type="button"
          className="ak-icon-btn"
          data-active={settings.motionScale === 0}
          onClick={onToggleMotion}
          aria-label={settings.motionScale === 0 ? 'Activar movimiento suave' : 'Reducir movimiento'}
          title={settings.motionScale === 0 ? 'Movimiento pausado' : 'Reducir movimiento'}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 14c3-5 6 5 9 0s5 3 7-2" />
            {settings.motionScale === 0 ? <line x1="4" y1="4" x2="20" y2="20" /> : null}
          </svg>
        </button>

        {/* Calm Pause / Breathing Break */}
        <button
          type="button"
          className="ak-icon-btn"
          onClick={onOpenPause}
          aria-label="Pausa tranquila"
          title="Pausa tranquila"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <rect x="6" y="5" width="4" height="14" rx="2" />
            <rect x="14" y="5" width="4" height="14" rx="2" />
          </svg>
        </button>

        {/* Discreet Hold-to-Open Adult Area */}
        <button
          type="button"
          className="ak-parent-hold"
          onPointerDown={startHold}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          aria-label="Área para adultos (mantener pulsado 3 segundos)"
          title="Adultos: mantener pulsado 3s"
        >
          <div className="ak-parent-hold-fill" style={{ height: `${holdPct}%` }} />
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'relative', zIndex: 1 }}>
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
        </button>
      </div>
    </header>
  );
};
