import React, { useMemo, useRef, useState } from 'react';
import {
  encodeSensoryBitmask,
  gentleSoundEngine,
  type CreatureViewModelInputs,
  type SensoryCalmSettings,
  type SessionPacingMode,
  type TrialRecord,
} from '@aurikat/core-engine';
import { GuidingHandOverlay } from '../components/GuidingHandOverlay.js';
import { ProceduralCreatureRig } from '../components/ProceduralCreatureRig.js';

interface DetailNavonGameProps {
  creatureInputs: CreatureViewModelInputs;
  pacingMode?: SessionPacingMode;
  sensorySettings: SensoryCalmSettings;
  onComplete: (trials: TrialRecord[]) => void;
}

type ShapeToken = 'circle' | 'star' | 'triangle' | 'square' | 'heart' | 'moon';

interface NavonRoundSpec {
  id: string;
  kind: 'navon_choice';
  isPractice: boolean;
  prompt: string;
  globalShape: ShapeToken;
  localShape: ShapeToken;
  color: string;
  leftChoice: 'global' | 'local';
}

interface SearchRoundSpec {
  id: string;
  kind: 'detail_search';
  isPractice: boolean;
  prompt: string;
  theme: 'apple_gold' | 'sun_glasses' | 'cat_star_bow' | 'fish_reverse' | 'mushroom_dots';
  uniqueIndex: number; // 0..8 in 3x3 grid
}

type DetectiveRoundSpec = NavonRoundSpec | SearchRoundSpec;

function buildDetectiveRounds(pacingMode: SessionPacingMode): DetectiveRoundSpec[] {
  const isQuick = pacingMode === 'quick_demo';

  const navonRounds: NavonRoundSpec[] = [
    {
      id: 'nav_prac',
      kind: 'navon_choice',
      isPractice: true,
      prompt: '✨ Práctica: ¿A cuál de los dos se parece más esta figura?',
      globalShape: 'circle',
      localShape: 'star',
      color: '#D89D3E',
      leftChoice: 'global',
    },
    {
      id: 'nav_1',
      kind: 'navon_choice',
      isPractice: false,
      prompt: '🔎 Parte 1: ¿A cuál se parece más para vos?',
      globalShape: 'triangle',
      localShape: 'square',
      color: '#5B85A8',
      leftChoice: 'local',
    },
    {
      id: 'nav_2',
      kind: 'navon_choice',
      isPractice: false,
      prompt: '🔎 Parte 1: ¿Ves primero la forma grande o las chiquitas?',
      globalShape: 'square',
      localShape: 'heart',
      color: '#C77A6B',
      leftChoice: 'global',
    },
    {
      id: 'nav_3',
      kind: 'navon_choice',
      isPractice: false,
      prompt: '🔎 Parte 1: ¿Cuál elegís para esta figura?',
      globalShape: 'heart',
      localShape: 'moon',
      color: '#8474A1',
      leftChoice: 'local',
    },
    {
      id: 'nav_4',
      kind: 'navon_choice',
      isPractice: false,
      prompt: '🔎 Parte 1: ¿A cuál se parece más?',
      globalShape: 'circle',
      localShape: 'triangle',
      color: '#679B7B',
      leftChoice: 'global',
    },
  ];

  const searchRounds: SearchRoundSpec[] = [
    {
      id: 'srch_prac',
      kind: 'detail_search',
      isPractice: true,
      prompt: '✨ Práctica: ¡Tocá la manzana que tiene un detalle diferente!',
      theme: 'apple_gold',
      uniqueIndex: 4,
    },
    {
      id: 'srch_1',
      kind: 'detail_search',
      isPractice: false,
      prompt: '🕵️ Parte 2: ¡Encontrá el sol que tiene anteojos!',
      theme: 'sun_glasses',
      uniqueIndex: 2,
    },
    {
      id: 'srch_2',
      kind: 'detail_search',
      isPractice: false,
      prompt: '🕵️ Parte 2: ¡Encontrá el gatito con estrella dorada!',
      theme: 'cat_star_bow',
      uniqueIndex: 6,
    },
    {
      id: 'srch_3',
      kind: 'detail_search',
      isPractice: false,
      prompt: '🕵️ Parte 2: ¡Encontrá el pececito que mira para el otro lado!',
      theme: 'fish_reverse',
      uniqueIndex: 7,
    },
    {
      id: 'srch_4',
      kind: 'detail_search',
      isPractice: false,
      prompt: '🕵️ Parte 2: ¡Encontrá el honguito con estrellita!',
      theme: 'mushroom_dots',
      uniqueIndex: 1,
    },
  ];

  if (isQuick) {
    return [...navonRounds.slice(0, 4), ...searchRounds.slice(0, 4)];
  }
  return [...navonRounds, ...searchRounds];
}

function renderMiniShape(shape: ShapeToken, cx: number, cy: number, r: number, color: string) {
  switch (shape) {
    case 'circle':
      return <circle key={`${cx}_${cy}`} cx={cx} cy={cy} r={r} fill={color} />;
    case 'square':
      return (
        <rect
          key={`${cx}_${cy}`}
          x={cx - r}
          y={cy - r}
          width={r * 2}
          height={r * 2}
          rx={2}
          fill={color}
        />
      );
    case 'triangle':
      return (
        <polygon
          key={`${cx}_${cy}`}
          points={`${cx},${cy - r} ${cx - r},${cy + r} ${cx + r},${cy + r}`}
          fill={color}
        />
      );
    case 'star':
      return (
        <polygon
          key={`${cx}_${cy}`}
          points={`${cx},${cy - r * 1.15} ${cx + r * 0.35},${cy - r * 0.35} ${cx + r * 1.15},${cy - r * 0.3} ${cx + r * 0.55},${cy + r * 0.25} ${cx + r * 0.75},${cy + r * 1.05} ${cx},${cy + r * 0.6} ${cx - r * 0.75},${cy + r * 1.05} ${cx - r * 0.55},${cy + r * 0.25} ${cx - r * 1.15},${cy - r * 0.3} ${cx - r * 0.35},${cy - r * 0.35}`}
          fill={color}
        />
      );
    case 'heart':
      return (
        <path
          key={`${cx}_${cy}`}
          d={`M ${cx} ${cy + r} C ${cx - r * 1.4} ${cy + r * 0.1}, ${cx - r * 1.2} ${cy - r}, ${cx} ${cy - r * 0.3} C ${cx + r * 1.2} ${cy - r}, ${cx + r * 1.4} ${cy + r * 0.1}, ${cx} ${cy + r} Z`}
          fill={color}
        />
      );
    case 'moon':
      return (
        <path
          key={`${cx}_${cy}`}
          d={`M ${cx + r * 0.5} ${cy - r} A ${r} ${r} 0 1 0 ${cx + r * 0.5} ${cy + r} A ${r * 0.75} ${r * 0.75} 0 1 1 ${cx + r * 0.5} ${cy - r} Z`}
          fill={color}
        />
      );
  }
}

function getGlobalAnchors(globalShape: ShapeToken): Array<{ x: number; y: number }> {
  const cx = 90;
  const cy = 78;
  if (globalShape === 'circle') {
    return Array.from({ length: 12 }, (_, i) => {
      const a = (i * 2 * Math.PI) / 12;
      return { x: cx + 48 * Math.cos(a), y: cy + 48 * Math.sin(a) };
    });
  }
  if (globalShape === 'square') {
    const pts: Array<{ x: number; y: number }> = [];
    const steps = [-46, -15, 15, 46];
    for (const s of steps) pts.push({ x: cx + s, y: cy - 46 });
    for (const s of steps) pts.push({ x: cx + s, y: cy + 46 });
    pts.push({ x: cx - 46, y: cy - 15 }, { x: cx - 46, y: cy + 15 });
    pts.push({ x: cx + 46, y: cy - 15 }, { x: cx + 46, y: cy + 15 });
    return pts;
  }
  if (globalShape === 'triangle') {
    return [
      { x: 90, y: 24 },
      { x: 74, y: 50 },
      { x: 106, y: 50 },
      { x: 58, y: 78 },
      { x: 122, y: 78 },
      { x: 42, y: 106 },
      { x: 138, y: 106 },
      { x: 26, y: 130 },
      { x: 58, y: 130 },
      { x: 90, y: 130 },
      { x: 122, y: 130 },
      { x: 154, y: 130 },
    ];
  }
  // heart
  return Array.from({ length: 14 }, (_, i) => {
    const t = (i * 2 * Math.PI) / 14;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    return { x: cx + x * 3.1, y: cy + y * 2.9 };
  });
}

function shapeLabel(shape: ShapeToken, isLocal: boolean): string {
  const names: Record<ShapeToken, [string, string]> = {
    circle: ['Círculo Grande', 'Circulitos Chicos'],
    square: ['Cuadrado Grande', 'Cuadraditos Chicos'],
    triangle: ['Triángulo Grande', 'Triangulitos Chicos'],
    star: ['Estrella Grande', 'Estrellitas Chicas'],
    heart: ['Corazón Grande', 'Corazoncitos Chicos'],
    moon: ['Luna Grande', 'Lunitas Chicas'],
  };
  return isLocal ? `🔎 ${names[shape][1]}` : `🖼️ ${names[shape][0]}`;
}

function renderSearchTile(theme: SearchRoundSpec['theme'], isUnique: boolean) {
  switch (theme) {
    case 'apple_gold':
      return (
        <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
          <circle
            cx="28"
            cy="31"
            r="16"
            fill={isUnique ? '#E5B24C' : '#D96B6B'}
            stroke="#4A3C31"
            strokeWidth="2.2"
          />
          <path d="M28 15 L31 7" stroke="#6B4F35" strokeWidth="2.8" strokeLinecap="round" />
          {isUnique ? (
            <polygon points="28,21 30,27 36,27 31,31 33,37 28,33 23,37 25,31 20,27 26,27" fill="#FFFDF6" />
          ) : null}
        </svg>
      );
    case 'sun_glasses':
      return (
        <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
          <circle cx="28" cy="28" r="15" fill="#F0BD4F" stroke="#4A3C31" strokeWidth="2.2" />
          {isUnique ? (
            <g>
              <circle cx="23" cy="26" r="4.5" fill="none" stroke="#2F261F" strokeWidth="2.2" />
              <circle cx="33" cy="26" r="4.5" fill="none" stroke="#2F261F" strokeWidth="2.2" />
              <line x1="27.5" y1="26" x2="28.5" y2="26" stroke="#2F261F" strokeWidth="2.2" />
            </g>
          ) : (
            <g>
              <circle cx="23" cy="26" r="2" fill="#2F261F" />
              <circle cx="33" cy="26" r="2" fill="#2F261F" />
            </g>
          )}
          <path d="M23 33 Q28 37 33 33" fill="none" stroke="#2F261F" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'cat_star_bow':
      return (
        <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
          <polygon points="15,22 18,10 26,18" fill="#89B3AE" stroke="#4A3C31" strokeWidth="2" />
          <polygon points="41,22 38,10 30,18" fill="#89B3AE" stroke="#4A3C31" strokeWidth="2" />
          <circle cx="28" cy="27" r="13" fill="#A6C8C3" stroke="#4A3C31" strokeWidth="2.2" />
          <circle cx="23" cy="25" r="2" fill="#2F261F" />
          <circle cx="33" cy="25" r="2" fill="#2F261F" />
          {isUnique ? (
            <polygon points="28,37 30,42 36,42 31,45 33,51 28,47 23,51 25,45 20,42 26,42" fill="#E5B24C" stroke="#4A3C31" strokeWidth="1.5" />
          ) : (
            <rect x="21" y="40" width="14" height="6" rx="3" fill="#5B85A8" />
          )}
        </svg>
      );
    case 'fish_reverse':
      return (
        <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
          <g transform={isUnique ? 'translate(56,0) scale(-1,1)' : undefined}>
            <ellipse cx="26" cy="28" rx="14" ry="10" fill="#6798B4" stroke="#4A3C31" strokeWidth="2.2" />
            <polygon points="39,28 49,20 49,36" fill="#E2B259" stroke="#4A3C31" strokeWidth="2" />
            <circle cx="19" cy="26" r="2.2" fill="#FFFFFF" />
            <circle cx="18.5" cy="26" r="1.2" fill="#1F2925" />
          </g>
        </svg>
      );
    case 'mushroom_dots':
      return (
        <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
          <rect x="22" y="30" width="12" height="16" rx="4" fill="#F2E6D0" stroke="#4A3C31" strokeWidth="2" />
          <path d="M12 31 C12 16, 44 16, 44 31 Z" fill="#D4746A" stroke="#4A3C31" strokeWidth="2.2" />
          <circle cx="22" cy="24" r="3" fill="#FFFDF7" />
          <circle cx="34" cy="24" r="3" fill="#FFFDF7" />
          {isUnique ? (
            <polygon points="28,17 29.5,21 34,21 30.5,23.5 32,28 28,25 24,28 25.5,23.5 22,21 26.5,21" fill="#F5D061" />
          ) : null}
        </svg>
      );
  }
}

/**
 * Game 4B Prototype — «Detective de Detalles» (G4_DETAIL_NAVON)
 * Phase 1: Navon Local vs. Global hierarchical figure preference (no wrong answer).
 * Phase 2: 3x3 Visual Detail Search (Embedded Detail detection).
 */
export const DetailNavonGame: React.FC<DetailNavonGameProps> = ({
  creatureInputs,
  pacingMode = 'clinical_full',
  sensorySettings,
  onComplete,
}) => {
  const rounds = useMemo(() => buildDetectiveRounds(pacingMode), [pacingMode]);
  const [roundIdx, setRoundIdx] = useState(0);
  const [locked, setLocked] = useState(false);
  const [foundTile, setFoundTile] = useState<number | null>(null);
  const trialsRef = useRef<TrialRecord[]>([]);
  const roundStartRef = useRef<number>(performance.now());

  const currentRound = rounds[roundIdx];

  const advanceNext = () => {
    const next = roundIdx + 1;
    if (next >= rounds.length) {
      gentleSoundEngine.playCue('animalese_happy');
      onComplete(trialsRef.current);
    } else {
      setRoundIdx(next);
      setLocked(false);
      setFoundTile(null);
      roundStartRef.current = performance.now();
    }
  };

  const handleNavonPick = (choice: 'global' | 'local', side: 'left' | 'right') => {
    if (!currentRound || currentRound.kind !== 'navon_choice' || locked) return;
    setLocked(true);
    const now = performance.now();
    const rtMs = Math.max(80, Math.round(now - roundStartRef.current));
    gentleSoundEngine.playCue('bloom_sparkle');

    trialsRef.current.push({
      trialId: `g4dn_nav_${roundIdx}_${Math.round(now)}`,
      gameId: 'G4_DETAIL_NAVON',
      blockType: 'navon_choice',
      trialIndex: roundIdx,
      isPractice: currentRound.isPractice,
      startedAtMs: Math.round(roundStartRef.current),
      rtMs,
      accuracy: 1,
      errorCategory: 'none',
      choiceChannel: choice,
      stimulusSide: side,
      sensoryBitmask: encodeSensoryBitmask(sensorySettings),
      interruptedByVisibility: document.hidden,
    });

    window.setTimeout(advanceNext, 580);
  };

  const handleSearchTileTap = (tileIdx: number) => {
    if (!currentRound || currentRound.kind !== 'detail_search' || locked) return;
    const now = performance.now();
    const rtMs = Math.max(80, Math.round(now - roundStartRef.current));
    const isHit = tileIdx === currentRound.uniqueIndex;

    trialsRef.current.push({
      trialId: `g4dn_srch_${roundIdx}_${tileIdx}_${Math.round(now)}`,
      gameId: 'G4_DETAIL_NAVON',
      blockType: 'detail_search',
      trialIndex: roundIdx,
      isPractice: currentRound.isPractice,
      startedAtMs: Math.round(roundStartRef.current),
      rtMs,
      accuracy: isHit ? 1 : 0,
      errorCategory: isHit ? 'none' : 'non_systematic',
      choiceChannel: isHit ? 'target_found' : 'distractor_tap',
      sensoryBitmask: encodeSensoryBitmask(sensorySettings),
      interruptedByVisibility: document.hidden,
    });

    if (isHit) {
      setLocked(true);
      setFoundTile(tileIdx);
      gentleSoundEngine.playCue('bloom_sparkle');
      window.setTimeout(advanceNext, 650);
    } else {
      gentleSoundEngine.playCue('tap_soft');
    }
  };

  if (!currentRound) return null;

  return (
    <section
      className="ak-stage-card"
      aria-label="Detective de Detalles"
      style={{ gap: 12, width: '100%' }}
    >
      <div className="ak-row" style={{ width: '100%', justifyContent: 'space-between' }}>
        <span className="ak-game-microheader">
          {currentRound.isPractice ? '✨ Práctica Detective' : '🔎 Detective de Detalles'}
        </span>
        <div className="ak-progress-dots" aria-hidden="true">
          {rounds.map((r, i) => (
            <span key={r.id} className="ak-dot" data-done={i < roundIdx} data-active={i === roundIdx} />
          ))}
        </div>
      </div>

      {/* Companion + Prompt */}
      <div className="ak-row" style={{ justifyContent: 'center', gap: 12 }}>
        <ProceduralCreatureRig
          inputs={{
            ...creatureInputs,
            emotion: locked ? 'happy' : 'calm',
            action: locked ? 'celebrate_soft' : 'idle',
          }}
          size={112}
        />
        <div className="ak-nurture-pill" style={{ fontWeight: 800, fontSize: '0.96rem' }}>
          {currentRound.prompt}
        </div>
      </div>

      {currentRound.kind === 'navon_choice' ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%' }}>
          {/* Composite Hierarchical Navon Figure */}
          <div
            style={{
              background: 'var(--ak-surface)',
              border: '2px solid var(--ak-surface-raised)',
              borderRadius: 22,
              padding: 12,
              boxShadow: '0 6px 16px rgba(45, 58, 50, 0.06)',
            }}
          >
            <svg width="180" height="156" viewBox="0 0 180 156" aria-label="Figura compuesta por piezas pequeñas">
              {getGlobalAnchors(currentRound.globalShape).map((pt) =>
                renderMiniShape(currentRound.localShape, pt.x, pt.y, 10, currentRound.color),
              )}
            </svg>
          </div>

          {/* Two Choices: Global vs. Local */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, width: '100%' }}>
            {(['left', 'right'] as const).map((side) => {
              const choiceType =
                side === 'left'
                  ? currentRound.leftChoice
                  : currentRound.leftChoice === 'global'
                    ? 'local'
                    : 'global';
              const isLocal = choiceType === 'local';
              const token = isLocal ? currentRound.localShape : currentRound.globalShape;
              return (
                <button
                  key={side}
                  type="button"
                  className={`ak-primary-target ${currentRound.isPractice ? 'ak-practice-glow' : ''}`}
                  onClick={() => handleNavonPick(choiceType, side)}
                  style={{
                    minHeight: 135,
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <svg width="76" height="72" viewBox="0 0 76 72" aria-hidden="true">
                    {isLocal ? (
                      <>
                        <circle cx="34" cy="32" r="22" fill="none" stroke="var(--ak-ink-muted)" strokeWidth="2" strokeDasharray="3 3" />
                        {renderMiniShape(token, 34, 32, 12, currentRound.color)}
                      </>
                    ) : (
                      renderMiniShape(token, 38, 36, 26, currentRound.color)
                    )}
                  </svg>
                  <strong style={{ fontSize: '0.96rem' }}>{shapeLabel(token, isLocal)}</strong>
                  {currentRound.isPractice && side === 'left' && !locked ? (
                    <GuidingHandOverlay mode="tap" toX="50%" toY="60%" label="¡Elegí cualquiera!" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* Phase 2: 3x3 Visual Detail Search Grid */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
            width: '100%',
            maxWidth: 420,
            margin: '0 auto',
          }}
        >
          {Array.from({ length: 9 }, (_, tileIdx) => {
            const isUnique = tileIdx === currentRound.uniqueIndex;
            const isFound = foundTile === tileIdx;
            const showGuide = currentRound.isPractice && isUnique && !locked;
            return (
              <button
                key={tileIdx}
                type="button"
                className={`ak-primary-target ${showGuide ? 'ak-practice-glow' : ''}`}
                data-selected={isFound}
                onClick={() => handleSearchTileTap(tileIdx)}
                style={{
                  minHeight: 96,
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: isFound ? 'scale(1.06)' : 'scale(1)',
                }}
              >
                {renderSearchTile(currentRound.theme, isUnique)}
                {showGuide ? (
                  <GuidingHandOverlay mode="tap" toX="50%" toY="55%" />
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};
