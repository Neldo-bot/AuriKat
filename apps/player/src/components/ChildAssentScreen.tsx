import React from 'react';
import type { CreatureViewModelInputs } from '@aurikat/core-engine';
import { ProceduralCreatureRig } from './ProceduralCreatureRig.js';

interface ChildAssentScreenProps {
  creatureInputs: CreatureViewModelInputs;
  onAccept: () => void;
  onDecline: () => void;
  declined: boolean;
}

/**
 * Visual Child Assent Screen for Pilot Research (Res. MSAL 1480/2011 / 45 CFR 46.408 / Helsinki 2024).
 * Zero guilt, unconditional respect for immediate child dissent.
 */
export const ChildAssentScreen: React.FC<ChildAssentScreenProps> = ({
  creatureInputs,
  onAccept,
  onDecline,
  declined,
}) => {
  if (declined) {
    return (
      <section className="ak-stage-card" aria-label="Descanso respetado">
        <ProceduralCreatureRig
          inputs={{ ...creatureInputs, emotion: 'calm', action: 'breathe' }}
          size={190}
        />
        <h1 style={{ margin: 0, fontSize: '1.45rem', textAlign: 'center' }}>
          ¡Está perfecto descansar hoy!
        </h1>
        <p style={{ margin: 0, color: 'var(--ak-ink-muted)', textAlign: 'center', maxWidth: 440 }}>
          AuriKat siempre respeta cuando no tenés ganas de jugar. Podés volver otro día o cuando quieras.
        </p>
        <button type="button" className="ak-primary-target" onClick={onAccept}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--ak-accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="6,4 20,12 6,20" fill="var(--ak-accent-soft)" />
          </svg>
          <span>Ahora sí quiero jugar</span>
        </button>
      </section>
    );
  }

  return (
    <section className="ak-stage-card" aria-label="Invitación visual a jugar con AuriKat">
      <ProceduralCreatureRig
        inputs={{ ...creatureInputs, emotion: 'happy', action: 'wave' }}
        size={210}
      />
      <h1 style={{ margin: 0, fontSize: '1.5rem', textAlign: 'center' }}>
        ¿Querés jugar un rato con AuriKat?
      </h1>
      <p style={{ margin: 0, color: 'var(--ak-ink-muted)', textAlign: 'center', maxWidth: 460 }}>
        No hay notas ni apuro. Podés parar o descansar en cualquier momento y no pasa nada malo.
      </p>

      <div className="ak-row" style={{ justifyContent: 'center', gap: 18, marginTop: 6 }}>
        <button
          type="button"
          className="ak-btn-accent"
          style={{ minWidth: 180, minHeight: 74 }}
          onClick={onAccept}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="6,4 20,12 6,20" fill="currentColor" />
          </svg>
          <span>¡Sí, vamos!</span>
        </button>

        <button
          type="button"
          className="ak-primary-target"
          style={{ minWidth: 160, minHeight: 74 }}
          onClick={onDecline}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--ak-ink-muted)" strokeWidth="2.4" strokeLinecap="round">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          </svg>
          <span>Hoy no quiero</span>
        </button>
      </div>
    </section>
  );
};
