import React, { useState } from 'react';
import {
  gentleSoundEngine,
  type CreatureViewModelInputs,
  type Game4LabVariant,
  type GameId,
  type PointerSample,
  type SensoryCalmSettings,
  type SessionPacingMode,
  type StrokeRecord,
  type TrialRecord,
} from '@aurikat/core-engine';
import { ProceduralCreatureRig } from '../components/ProceduralCreatureRig.js';
import { DetailNavonGame } from './DetailNavonGame.js';
import { SensorySocialDayGame } from './SensorySocialDayGame.js';
import { SocialGeoMotorGame } from './SocialGeoMotorGame.js';

interface Game4LabHubProps {
  creatureInputs: CreatureViewModelInputs;
  pacingMode: SessionPacingMode;
  sensorySettings: SensoryCalmSettings;
  completedGames: Set<GameId>;
  onCompleteTrials: (gameId: GameId, trials: TrialRecord[], rewardMsg: string) => void;
  onCompleteClassicGame4: (res: {
    trials: TrialRecord[];
    strokes: StrokeRecord[];
    rhythmicTapIntervalsMs: number[];
  }) => void;
  onSamplesObserved: (samples: PointerSample[], coalescedSupported: boolean) => void;
  onBackToHub: () => void;
}

/**
 * Modular Game 4 Laboratory Selector (Branch: feat/game4-lab).
 * Lets the user play and compare:
 * - 4A: «El Día de AuriKat» (Sensory & Social Day Choices)
 * - 4B: «Detective de Detalles» (Hierarchical Navon Figures & 3x3 Visual Detail Search)
 * Plus previews for Iteration 2 (4C: Música por Turnos, 4D: ¡A Guardar!) and optional Classic mode.
 */
export const Game4LabHub: React.FC<Game4LabHubProps> = ({
  creatureInputs,
  pacingMode,
  sensorySettings,
  completedGames,
  onCompleteTrials,
  onCompleteClassicGame4,
  onSamplesObserved,
  onBackToHub,
}) => {
  const [selectedVariant, setSelectedVariant] = useState<Game4LabVariant | null>(null);

  if (selectedVariant === 'sensory_social') {
    return (
      <SensorySocialDayGame
        creatureInputs={creatureInputs}
        pacingMode={pacingMode}
        sensorySettings={sensorySettings}
        onComplete={(trials) =>
          onCompleteTrials(
            'G4_SENSORY_SOCIAL',
            trials,
            '¡Completaste El Día de AuriKat! Ganaste una pegatina ★',
          )
        }
      />
    );
  }

  if (selectedVariant === 'detail_navon') {
    return (
      <DetailNavonGame
        creatureInputs={creatureInputs}
        pacingMode={pacingMode}
        sensorySettings={sensorySettings}
        onComplete={(trials) =>
          onCompleteTrials(
            'G4_DETAIL_NAVON',
            trials,
            '¡Excelente Detective de Detalles! Ganaste una pegatina ★',
          )
        }
      />
    );
  }

  if (selectedVariant === 'classic_bubbles') {
    return (
      <SocialGeoMotorGame
        creatureInputs={creatureInputs}
        pacingMode={pacingMode}
        sensorySettings={sensorySettings}
        onSamplesObserved={onSamplesObserved}
        onComplete={onCompleteClassicGame4}
      />
    );
  }

  const done4A = completedGames.has('G4_SENSORY_SOCIAL');
  const done4B = completedGames.has('G4_DETAIL_NAVON');

  return (
    <section
      className="ak-stage-card"
      aria-label="Laboratorio del Cuarto Minijuego"
      style={{ gap: 16, width: '100%' }}
    >
      <div className="ak-row" style={{ width: '100%', justifyContent: 'space-between' }}>
        <span className="ak-game-microheader">🧪 Laboratorio · Elegí el 4.º Juego</span>
        <button
          type="button"
          className="ak-primary-target"
          style={{ minHeight: 42, padding: '6px 14px', fontSize: '0.86rem' }}
          onClick={onBackToHub}
        >
          <span>← Volver a la casita</span>
        </button>
      </div>

      <div className="ak-row" style={{ justifyContent: 'center', gap: 14 }}>
        <ProceduralCreatureRig inputs={{ ...creatureInputs, emotion: 'happy' }} size={115} />
        <div style={{ maxWidth: 390 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: '1.16rem' }}>
            ¡Probá los nuevos diseños del Juego 4!
          </h2>
          <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--ak-ink-muted)' }}>
            Podés jugar cualquiera de los dos prototipos (o ambos) y luego tocar{' '}
            <strong>🔒 Adultos / Exportar</strong> arriba a la derecha para ver su interpretación.
          </p>
        </div>
      </div>

      {/* Iteration 1 Active Prototypes (4A and 4B) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: 14,
          width: '100%',
        }}
      >
        <button
          type="button"
          className="ak-game-tile"
          data-done={done4A}
          onClick={() => {
            gentleSoundEngine.unlock();
            gentleSoundEngine.playCue('animalese_happy');
            setSelectedVariant('sensory_social');
          }}
          style={{
            minHeight: 150,
            padding: 16,
            alignItems: 'flex-start',
            textAlign: 'left',
            gap: 8,
          }}
        >
          <div className="ak-row" style={{ width: '100%', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '1.75rem' }}>🌈</span>
            <span
              className="ak-phase-pill"
              style={{
                background: done4A ? 'var(--ak-accent)' : 'var(--ak-accent-soft)',
                color: done4A ? '#FFF' : 'var(--ak-ink)',
              }}
            >
              {done4A ? '✓ Jugado' : 'Prototipo 4A · Nuevo'}
            </span>
          </div>
          <strong style={{ fontSize: '1.05rem' }}>4A. El Día de AuriKat</strong>
          <span style={{ fontSize: '0.84rem', color: 'var(--ak-ink-muted)' }}>
            Escenas ilustradas de sonidos, luces, abrigo, amigos y caminos. El niño elige con 1 toque qué prefiere AuriKat (sin errores).
          </span>
        </button>

        <button
          type="button"
          className="ak-game-tile"
          data-done={done4B}
          onClick={() => {
            gentleSoundEngine.unlock();
            gentleSoundEngine.playCue('animalese_curious');
            setSelectedVariant('detail_navon');
          }}
          style={{
            minHeight: 150,
            padding: 16,
            alignItems: 'flex-start',
            textAlign: 'left',
            gap: 8,
          }}
        >
          <div className="ak-row" style={{ width: '100%', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '1.75rem' }}>🔎</span>
            <span
              className="ak-phase-pill"
              style={{
                background: done4B ? 'var(--ak-accent)' : 'var(--ak-accent-soft)',
                color: done4B ? '#FFF' : 'var(--ak-ink)',
              }}
            >
              {done4B ? '✓ Jugado' : 'Prototipo 4B · Nuevo'}
            </span>
          </div>
          <strong style={{ fontSize: '1.05rem' }}>4B. Detective de Detalles</strong>
          <span style={{ fontSize: '0.84rem', color: 'var(--ak-ink-muted)' }}>
            Parte 1: ¿Se parece a la figura grande o a las chiquitas? Parte 2: ¡Encontrá el dibujo con el detalle escondido!
          </span>
        </button>
      </div>

      {/* Upcoming Iteration 2 Previews + Legacy Toggle */}
      <div
        className="ak-subtle-box"
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          fontSize: '0.83rem',
        }}
      >
        <div className="ak-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span>
            <strong>Próxima Iteración en esta rama:</strong> 🎵 <em>4C. Música por Turnos</em> · 🍓{' '}
            <em>4D. ¡A Guardar con AuriKat!</em>
          </span>
          <button
            type="button"
            className="ak-primary-target"
            style={{ minHeight: 36, padding: '4px 12px', fontSize: '0.78rem' }}
            onClick={() => setSelectedVariant('classic_bubbles')}
          >
            <span>Abrir versión anterior (Burbujas y Cometas)</span>
          </button>
        </div>
      </div>
    </section>
  );
};
