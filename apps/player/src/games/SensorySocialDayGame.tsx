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

interface SensorySocialDayGameProps {
  creatureInputs: CreatureViewModelInputs;
  pacingMode?: SessionPacingMode;
  sensorySettings: SensoryCalmSettings;
  onComplete: (trials: TrialRecord[]) => void;
}

type DayDomainBlock =
  | 'practice'
  | 'auditory'
  | 'visual'
  | 'tactile'
  | 'movement'
  | 'social_play'
  | 'routine_change';

type ChoiceChannelId =
  | 'practice_choice'
  | 'calm_avoiding'
  | 'intense_seeking'
  | 'solitary_order'
  | 'group_social'
  | 'routine_same'
  | 'routine_novel';

interface DayCardOption {
  id: string;
  label: string;
  subLabel: string;
  channel: ChoiceChannelId;
  artId:
    | 'berry'
    | 'apple'
    | 'drums_party'
    | 'quiet_headphones'
    | 'bright_lights'
    | 'warm_lantern'
    | 'itchy_sweater'
    | 'soft_hoodie'
    | 'group_ball'
    | 'ordered_blocks'
    | 'new_bridge'
    | 'familiar_path'
    | 'fast_carousel'
    | 'gentle_hammock'
    | 'big_party'
    | 'cozy_book'
    | 'mixed_plate'
    | 'sorted_plate';
}

interface DaySceneSpec {
  id: string;
  blockType: DayDomainBlock;
  isPractice: boolean;
  promptTitle: string;
  leftOption: DayCardOption;
  rightOption: DayCardOption;
}

function buildDayScenes(pacingMode: SessionPacingMode): DaySceneSpec[] {
  const isQuick = pacingMode === 'quick_demo';

  const practice: DaySceneSpec = {
    id: 'prac_snack',
    blockType: 'practice',
    isPractice: true,
    promptTitle: '✨ Práctica: ¿Qué merienda prefiere hoy?',
    leftOption: {
      id: 'opt_berry',
      label: 'Frutilla dulce',
      subLabel: 'Suave y jugosa',
      channel: 'practice_choice',
      artId: 'berry',
    },
    rightOption: {
      id: 'opt_apple',
      label: 'Manzana crocante',
      subLabel: 'Fresca del árbol',
      channel: 'practice_choice',
      artId: 'apple',
    },
  };

  const coreScenes: DaySceneSpec[] = [
    {
      id: 'sc_auditory',
      blockType: 'auditory',
      isPractice: false,
      promptTitle: '🎵 Hora de los sonidos: ¿Dónde está más cómodo?',
      leftOption: {
        id: 'aud_party',
        label: 'Banda y tambores',
        subLabel: 'Mucho ritmo y sonido',
        channel: 'intense_seeking',
        artId: 'drums_party',
      },
      rightOption: {
        id: 'aud_calm',
        label: 'Rincón silencioso',
        subLabel: 'Orejeras suaves y calma',
        channel: 'calm_avoiding',
        artId: 'quiet_headphones',
      },
    },
    {
      id: 'sc_visual',
      blockType: 'visual',
      isPractice: false,
      promptTitle: '💡 Luces del cuarto: ¿Cuál le gusta más?',
      leftOption: {
        id: 'vis_calm',
        label: 'Lamparita tibia',
        subLabel: 'Luz suave de atardecer',
        channel: 'calm_avoiding',
        artId: 'warm_lantern',
      },
      rightOption: {
        id: 'vis_bright',
        label: 'Luces brillantes',
        subLabel: 'Muchos colores vivos',
        channel: 'intense_seeking',
        artId: 'bright_lights',
      },
    },
    {
      id: 'sc_tactile',
      blockType: 'tactile',
      isPractice: false,
      promptTitle: '🧣 Abrigo para salir: ¿Cuál elige ponerse?',
      leftOption: {
        id: 'tac_wool',
        label: 'Suéter tejido',
        subLabel: 'Con textura y cuello',
        channel: 'intense_seeking',
        artId: 'itchy_sweater',
      },
      rightOption: {
        id: 'tac_cloud',
        label: 'Buzo de nube',
        subLabel: 'Liso y sin etiquetas',
        channel: 'calm_avoiding',
        artId: 'soft_hoodie',
      },
    },
    {
      id: 'sc_social_1',
      blockType: 'social_play',
      isPractice: false,
      promptTitle: '🎲 Hora de jugar en el patio: ¿Qué prefiere hacer?',
      leftOption: {
        id: 'soc_blocks',
        label: 'Ordenar tren de bloques',
        subLabel: 'En fila por color',
        channel: 'solitary_order',
        artId: 'ordered_blocks',
      },
      rightOption: {
        id: 'soc_ball',
        label: 'Jugar en ronda',
        subLabel: 'Pasar la pelota en grupo',
        channel: 'group_social',
        artId: 'group_ball',
      },
    },
    {
      id: 'sc_routine_1',
      blockType: 'routine_change',
      isPractice: false,
      promptTitle: '🗺️ Paseo por el bosque: ¿Qué camino toma?',
      leftOption: {
        id: 'rot_novel',
        label: 'Puente sorpresa',
        subLabel: 'Un camino nuevo por explorar',
        channel: 'routine_novel',
        artId: 'new_bridge',
      },
      rightOption: {
        id: 'rot_same',
        label: 'Camino de siempre',
        subLabel: 'El sendero conocido y seguro',
        channel: 'routine_same',
        artId: 'familiar_path',
      },
    },
  ];

  if (isQuick) {
    return [practice, ...coreScenes];
  }

  const extendedScenes: DaySceneSpec[] = [
    {
      id: 'sc_movement',
      blockType: 'movement',
      isPractice: false,
      promptTitle: '🎠 En la plaza: ¿Dónde quiere subir?',
      leftOption: {
        id: 'mov_hammock',
        label: 'Hamaca suavecita',
        subLabel: 'Vaivén lento y tranquilo',
        channel: 'calm_avoiding',
        artId: 'gentle_hammock',
      },
      rightOption: {
        id: 'mov_carousel',
        label: 'Calesita giratoria',
        subLabel: 'Dar vueltas rápido',
        channel: 'intense_seeking',
        artId: 'fast_carousel',
      },
    },
    {
      id: 'sc_social_2',
      blockType: 'social_play',
      isPractice: false,
      promptTitle: '🏡 A la tarde: ¿Qué plan le divierte más?',
      leftOption: {
        id: 'soc_party',
        label: 'Fiesta con muchos amigos',
        subLabel: 'Juegos entre todos',
        channel: 'group_social',
        artId: 'big_party',
      },
      rightOption: {
        id: 'soc_book',
        label: 'Mirar dibujos tranquilo',
        subLabel: 'En su rincón favorito',
        channel: 'solitary_order',
        artId: 'cozy_book',
      },
    },
    {
      id: 'sc_routine_2',
      blockType: 'routine_change',
      isPractice: false,
      promptTitle: '🍽️ Hora de cenar: ¿Qué plato prefiere?',
      leftOption: {
        id: 'rot_sorted',
        label: 'Plato ordenado',
        subLabel: 'Cada comida en su lugar',
        channel: 'routine_same',
        artId: 'sorted_plate',
      },
      rightOption: {
        id: 'rot_mixed',
        label: 'Receta nueva mezclada',
        subLabel: 'Sabores distintos juntos',
        channel: 'routine_novel',
        artId: 'mixed_plate',
      },
    },
  ];

  return [practice, ...coreScenes, ...extendedScenes];
}

function renderCardArt(artId: DayCardOption['artId']) {
  switch (artId) {
    case 'berry':
      return (
        <svg width="96" height="84" viewBox="0 0 96 84" aria-hidden="true">
          <path d="M48 16 C30 16, 22 36, 30 56 C36 70, 44 76, 48 76 C52 76, 60 70, 66 56 C74 36, 66 16, 48 16 Z" fill="#D96B6B" stroke="#4A3C31" strokeWidth="2.5" />
          <path d="M38 16 Q48 6 58 16 Q48 22 38 16 Z" fill="#5D9C76" stroke="#4A3C31" strokeWidth="2" />
          <circle cx="42" cy="36" r="2.2" fill="#FFF4D9" />
          <circle cx="54" cy="40" r="2.2" fill="#FFF4D9" />
          <circle cx="46" cy="52" r="2.2" fill="#FFF4D9" />
        </svg>
      );
    case 'apple':
      return (
        <svg width="96" height="84" viewBox="0 0 96 84" aria-hidden="true">
          <circle cx="48" cy="46" r="24" fill="#78B07B" stroke="#4A3C31" strokeWidth="2.5" />
          <path d="M48 22 L52 10" stroke="#6B4F35" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M52 14 Q64 10 62 22 Q54 22 52 14 Z" fill="#5D9C76" />
          <circle cx="38" cy="38" r="4" fill="#FFFFFF" opacity="0.45" />
        </svg>
      );
    case 'drums_party':
      return (
        <svg width="96" height="84" viewBox="0 0 96 84" aria-hidden="true">
          <rect x="24" y="34" width="48" height="34" rx="8" fill="#D67C63" stroke="#4A3C31" strokeWidth="2.5" />
          <ellipse cx="48" cy="34" rx="24" ry="8" fill="#F4E3C1" stroke="#4A3C31" strokeWidth="2.5" />
          <line x1="20" y1="16" x2="40" y2="30" stroke="#7A5638" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="76" y1="16" x2="56" y2="30" stroke="#7A5638" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M14 26 Q8 18 16 12" fill="none" stroke="#D89D3E" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M82 26 Q88 18 80 12" fill="none" stroke="#D89D3E" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case 'quiet_headphones':
      return (
        <svg width="96" height="84" viewBox="0 0 96 84" aria-hidden="true">
          <path d="M24 48 A24 24 0 0 1 72 48" fill="none" stroke="#537D8D" strokeWidth="6" strokeLinecap="round" />
          <rect x="18" y="42" width="14" height="24" rx="7" fill="#7DA89B" stroke="#4A3C31" strokeWidth="2.4" />
          <rect x="64" y="42" width="14" height="24" rx="7" fill="#7DA89B" stroke="#4A3C31" strokeWidth="2.4" />
          <circle cx="48" cy="54" r="10" fill="#E8F1EC" />
          <path d="M43 54 Q48 59 53 54" fill="none" stroke="#4A3C31" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case 'warm_lantern':
      return (
        <svg width="96" height="84" viewBox="0 0 96 84" aria-hidden="true">
          <circle cx="48" cy="44" r="28" fill="#F9E5B4" opacity="0.45" />
          <ellipse cx="48" cy="44" rx="18" ry="22" fill="#F3C567" stroke="#4A3C31" strokeWidth="2.4" />
          <rect x="40" y="18" width="16" height="6" rx="3" fill="#6E5239" />
          <rect x="40" y="64" width="16" height="6" rx="3" fill="#6E5239" />
        </svg>
      );
    case 'bright_lights':
      return (
        <svg width="96" height="84" viewBox="0 0 96 84" aria-hidden="true">
          <polygon points="48,10 55,28 75,28 59,40 65,58 48,47 31,58 37,40 21,28 41,28" fill="#F0B43A" stroke="#4A3C31" strokeWidth="2.2" />
          <circle cx="22" cy="20" r="6" fill="#E07265" />
          <circle cx="74" cy="20" r="6" fill="#5D92BA" />
          <circle cx="24" cy="64" r="6" fill="#68AC7E" />
          <circle cx="72" cy="64" r="6" fill="#B678B8" />
        </svg>
      );
    case 'itchy_sweater':
      return (
        <svg width="96" height="84" viewBox="0 0 96 84" aria-hidden="true">
          <path d="M30 22 L14 36 L22 48 L30 40 L30 68 L66 68 L66 40 L74 48 L82 36 L66 22 Z" fill="#C48355" stroke="#4A3C31" strokeWidth="2.4" />
          <rect x="43" y="22" width="10" height="8" fill="#FFFDF7" stroke="#4A3C31" strokeWidth="1.8" />
          <path d="M34 48 L62 48 M34 58 L62 58" stroke="#8C5832" strokeWidth="2.2" strokeDasharray="4 3" />
        </svg>
      );
    case 'soft_hoodie':
      return (
        <svg width="96" height="84" viewBox="0 0 96 84" aria-hidden="true">
          <path d="M30 22 L14 36 L22 48 L30 40 L30 68 L66 68 L66 40 L74 48 L82 36 L66 22 Z" fill="#89B3AE" stroke="#4A3C31" strokeWidth="2.4" />
          <circle cx="48" cy="46" r="10" fill="#EAF4F2" />
          <circle cx="42" cy="45" r="6" fill="#EAF4F2" />
          <circle cx="54" cy="45" r="6" fill="#EAF4F2" />
        </svg>
      );
    case 'ordered_blocks':
      return (
        <svg width="96" height="84" viewBox="0 0 96 84" aria-hidden="true">
          <rect x="14" y="42" width="18" height="18" rx="4" fill="#6798B4" stroke="#4A3C31" strokeWidth="2.2" />
          <rect x="38" y="42" width="18" height="18" rx="4" fill="#77AD8B" stroke="#4A3C31" strokeWidth="2.2" />
          <rect x="62" y="42" width="18" height="18" rx="4" fill="#E2B259" stroke="#4A3C31" strokeWidth="2.2" />
          <line x1="12" y1="66" x2="84" y2="66" stroke="#4A3C31" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case 'group_ball':
      return (
        <svg width="96" height="84" viewBox="0 0 96 84" aria-hidden="true">
          <circle cx="24" cy="48" r="11" fill="#85B09A" stroke="#4A3C31" strokeWidth="2.2" />
          <circle cx="72" cy="48" r="11" fill="#D89B7B" stroke="#4A3C31" strokeWidth="2.2" />
          <circle cx="48" cy="30" r="12" fill="#E3B353" stroke="#4A3C31" strokeWidth="2.4" />
          <path d="M32 38 Q48 16 64 38" fill="none" stroke="#5B85A8" strokeWidth="2.2" strokeDasharray="4 3" />
        </svg>
      );
    case 'new_bridge':
      return (
        <svg width="96" height="84" viewBox="0 0 96 84" aria-hidden="true">
          <path d="M14 58 Q48 24 82 58" fill="none" stroke="#B58253" strokeWidth="6" strokeLinecap="round" />
          <polygon points="48,14 51,22 60,22 53,27 55,35 48,30 41,35 43,27 36,22 45,22" fill="#E5B24C" />
        </svg>
      );
    case 'familiar_path':
      return (
        <svg width="96" height="84" viewBox="0 0 96 84" aria-hidden="true">
          <path d="M18 66 L42 22 L54 22 L78 66 Z" fill="#D9C39E" stroke="#4A3C31" strokeWidth="2.2" />
          <circle cx="24" cy="36" r="10" fill="#6F9E7B" />
          <circle cx="72" cy="36" r="10" fill="#6F9E7B" />
        </svg>
      );
    case 'gentle_hammock':
      return (
        <svg width="96" height="84" viewBox="0 0 96 84" aria-hidden="true">
          <line x1="18" y1="20" x2="18" y2="68" stroke="#6E5239" strokeWidth="5" strokeLinecap="round" />
          <line x1="78" y1="20" x2="78" y2="68" stroke="#6E5239" strokeWidth="5" strokeLinecap="round" />
          <path d="M18 36 Q48 64 78 36" fill="#87B2A8" stroke="#4A3C31" strokeWidth="2.4" />
        </svg>
      );
    case 'fast_carousel':
      return (
        <svg width="96" height="84" viewBox="0 0 96 84" aria-hidden="true">
          <polygon points="48,14 18,34 78,34" fill="#D97A66" stroke="#4A3C31" strokeWidth="2.2" />
          <line x1="48" y1="34" x2="48" y2="64" stroke="#4A3C31" strokeWidth="3" />
          <ellipse cx="48" cy="64" rx="28" ry="7" fill="#E3B353" stroke="#4A3C31" strokeWidth="2.2" />
        </svg>
      );
    case 'big_party':
      return (
        <svg width="96" height="84" viewBox="0 0 96 84" aria-hidden="true">
          <circle cx="26" cy="30" r="9" fill="#D97268" stroke="#4A3C31" strokeWidth="2" />
          <circle cx="48" cy="24" r="9" fill="#5D92BA" stroke="#4A3C31" strokeWidth="2" />
          <circle cx="70" cy="30" r="9" fill="#77AD8B" stroke="#4A3C31" strokeWidth="2" />
          <path d="M26 39 L26 62 M48 33 L48 62 M70 39 L70 62" stroke="#4A3C31" strokeWidth="1.8" />
        </svg>
      );
    case 'cozy_book':
      return (
        <svg width="96" height="84" viewBox="0 0 96 84" aria-hidden="true">
          <rect x="20" y="24" width="28" height="38" rx="4" fill="#F5ECD7" stroke="#4A3C31" strokeWidth="2.2" />
          <rect x="48" y="24" width="28" height="38" rx="4" fill="#F5ECD7" stroke="#4A3C31" strokeWidth="2.2" />
          <circle cx="34" cy="42" r="6" fill="#7DA89B" />
          <circle cx="62" cy="42" r="6" fill="#E3B353" />
        </svg>
      );
    case 'sorted_plate':
      return (
        <svg width="96" height="84" viewBox="0 0 96 84" aria-hidden="true">
          <circle cx="48" cy="44" r="28" fill="#FAF6EE" stroke="#4A3C31" strokeWidth="2.4" />
          <line x1="48" y1="16" x2="48" y2="72" stroke="#4A3C31" strokeWidth="2" />
          <line x1="20" y1="44" x2="76" y2="44" stroke="#4A3C31" strokeWidth="2" />
          <circle cx="36" cy="32" r="6" fill="#77AD8B" />
          <circle cx="60" cy="32" r="6" fill="#E3B353" />
          <circle cx="36" cy="56" r="6" fill="#D97268" />
        </svg>
      );
    case 'mixed_plate':
      return (
        <svg width="96" height="84" viewBox="0 0 96 84" aria-hidden="true">
          <circle cx="48" cy="44" r="28" fill="#FAF6EE" stroke="#4A3C31" strokeWidth="2.4" />
          <circle cx="42" cy="40" r="8" fill="#77AD8B" />
          <circle cx="54" cy="42" r="8" fill="#E3B353" />
          <circle cx="48" cy="50" r="8" fill="#D97268" />
        </svg>
      );
  }
}

/**
 * Game 4A Prototype — «El Día de AuriKat» (G4_SENSORY_SOCIAL)
 * Child chooses with 1 tap which everyday sensory/social/routine situation AuriKat prefers.
 * Zero wrong answers, 100% neuroaffirming, zero clinical labels in player bundle.
 */
export const SensorySocialDayGame: React.FC<SensorySocialDayGameProps> = ({
  creatureInputs,
  pacingMode = 'clinical_full',
  sensorySettings,
  onComplete,
}) => {
  const scenes = useMemo(() => buildDayScenes(pacingMode), [pacingMode]);
  const [sceneIdx, setSceneIdx] = useState(0);
  const [chosenSide, setChosenSide] = useState<'left' | 'right' | null>(null);
  const trialsRef = useRef<TrialRecord[]>([]);
  const sceneStartRef = useRef<number>(performance.now());

  const currentScene = scenes[sceneIdx];

  const handleChoose = (side: 'left' | 'right', option: DayCardOption) => {
    if (!currentScene || chosenSide !== null) return;
    const now = performance.now();
    const rtMs = Math.max(80, Math.round(now - sceneStartRef.current));

    setChosenSide(side);
    gentleSoundEngine.playCue('bloom_sparkle');

    trialsRef.current.push({
      trialId: `g4ss_${sceneIdx}_${Math.round(now)}`,
      gameId: 'G4_SENSORY_SOCIAL',
      blockType: currentScene.blockType,
      trialIndex: sceneIdx,
      isPractice: currentScene.isPractice,
      startedAtMs: Math.round(sceneStartRef.current),
      rtMs,
      accuracy: 1,
      errorCategory: 'none',
      choiceChannel: option.channel,
      stimulusSide: side,
      sensoryBitmask: encodeSensoryBitmask(sensorySettings),
      interruptedByVisibility: document.hidden,
    });

    window.setTimeout(() => {
      const next = sceneIdx + 1;
      if (next >= scenes.length) {
        gentleSoundEngine.playCue('animalese_happy');
        onComplete(trialsRef.current);
      } else {
        setSceneIdx(next);
        setChosenSide(null);
        sceneStartRef.current = performance.now();
      }
    }, 620);
  };

  if (!currentScene) return null;

  return (
    <section
      className="ak-stage-card"
      aria-label="El Día de AuriKat"
      style={{ gap: 14, width: '100%' }}
    >
      <div className="ak-row" style={{ width: '100%', justifyContent: 'space-between' }}>
        <span className="ak-game-microheader">
          {currentScene.isPractice ? '✨ Práctica Guiada' : '🌈 El Día de AuriKat'}
        </span>
        <div className="ak-progress-dots" aria-hidden="true">
          {scenes.map((sc, i) => (
            <span
              key={sc.id}
              className="ak-dot"
              data-done={i < sceneIdx}
              data-active={i === sceneIdx}
            />
          ))}
        </div>
      </div>

      {/* AuriKat watching and reacting to the chosen card */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <ProceduralCreatureRig
          inputs={{
            ...creatureInputs,
            lookX: chosenSide === 'left' ? -0.75 : chosenSide === 'right' ? 0.75 : 0,
            lookY: 0.25,
            emotion: chosenSide ? 'happy' : 'calm',
            action: chosenSide ? 'celebrate_soft' : 'idle',
          }}
          size={150}
        />
        <div
          className="ak-nurture-pill"
          style={{ fontSize: '0.98rem', fontWeight: 800, textAlign: 'center' }}
        >
          {currentScene.promptTitle}
        </div>
      </div>

      {/* Two Large Illustrated Choice Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          width: '100%',
          marginTop: 4,
        }}
      >
        {(
          [
            ['left', currentScene.leftOption],
            ['right', currentScene.rightOption],
          ] as ['left' | 'right', DayCardOption][]
        ).map(([side, opt]) => {
          const isSelected = chosenSide === side;
          const showPracticeHand = currentScene.isPractice && side === 'left' && chosenSide === null;
          return (
            <button
              key={opt.id}
              type="button"
              className={`ak-primary-target ${currentScene.isPractice ? 'ak-practice-glow' : ''}`}
              data-selected={isSelected}
              onClick={() => handleChoose(side, opt)}
              style={{
                minHeight: 175,
                padding: '16px 14px',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                transition: 'transform 0.2s ease',
              }}
            >
              {renderCardArt(opt.artId)}
              <strong style={{ fontSize: '1.02rem', textAlign: 'center' }}>{opt.label}</strong>
              <span style={{ fontSize: '0.82rem', color: 'var(--ak-ink-muted)', textAlign: 'center' }}>
                {opt.subLabel}
              </span>
              {showPracticeHand ? (
                <GuidingHandOverlay mode="tap" toX="50%" toY="60%" label="¡Tocá el que quieras!" />
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
};
