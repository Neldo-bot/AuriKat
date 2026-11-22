import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  encodeSensoryBitmask,
  generateUuidV4,
  gentleSoundEngine,
  type CreatureViewModelInputs,
  type EmotionId,
  type FormVariant,
  type SensoryCalmSettings,
  type SessionPacingMode,
  type SubAgeBand,
  type TrialRecord,
} from '@aurikat/core-engine';
import { GuidingHandOverlay } from '../components/GuidingHandOverlay.js';
import { ProceduralCreatureRig } from '../components/ProceduralCreatureRig.js';

interface EmotionToMGameProps {
  creatureInputs: CreatureViewModelInputs;
  subAgeBand: SubAgeBand;
  formVariant: FormVariant;
  pacingMode?: SessionPacingMode;
  sensorySettings: SensoryCalmSettings;
  onComplete: (trials: TrialRecord[]) => void;
}

interface SceneOption {
  id: string;
  label: string;
  emotion?: EmotionId;
  visualKind:
    | 'emotion_face'
    | 'box_blue'
    | 'box_green'
    | 'box_sand'
    | 'intent_help'
    | 'intent_hide'
    | 'intent_comfort'
    | 'intent_bump';
}

interface StorySceneSpec {
  id: string;
  titleHint: string;
  blockType: 'practice' | 'emotion_ctx' | 'false_belief' | 'intentionality' | 'physical_ctrl';
  isPractice: boolean;
  sceneKind:
    | 'fallen_tower'
    | 'gift_surprise'
    | 'rustling_bush'
    | 'bridge_built'
    | 'false_belief_ball'
    | 'diverse_desire'
    | 'physical_ramp'
    | 'physical_balloon'
    | 'intent_helping'
    | 'intent_hiding';
  targetEmotion?: EmotionId;
  correctOptionId: string;
  options: SceneOption[];
}

function buildToMScenes(
  subAgeBand: SubAgeBand,
  formVariant: FormVariant,
  pacingMode: SessionPacingMode,
): StorySceneSpec[] {
  const isFormA = formVariant === 'A';
  const isQuick = pacingMode === 'quick_demo';

  const practice: StorySceneSpec = {
    id: 'prac_happy',
    titleHint: '✨ Práctica: ¡Terminó el puente!',
    blockType: 'practice',
    isPractice: true,
    sceneKind: 'bridge_built',
    targetEmotion: 'happy',
    correctOptionId: 'opt_happy',
    options: [
      { id: 'opt_happy', label: 'Contento', emotion: 'happy', visualKind: 'emotion_face' },
      { id: 'opt_sad', label: 'Triste', emotion: 'sad', visualKind: 'emotion_face' },
      { id: 'opt_scared', label: 'Asustado', emotion: 'scared', visualKind: 'emotion_face' },
    ],
  };

  const emotionScenes: StorySceneSpec[] = [
    {
      id: `em_sad_${formVariant}`,
      titleHint: 'Se cayó la torre de bloques',
      blockType: 'emotion_ctx',
      isPractice: false,
      sceneKind: 'fallen_tower',
      targetEmotion: 'sad',
      correctOptionId: 'opt_sad',
      options: isFormA
        ? [
            { id: 'opt_happy', label: 'Contento', emotion: 'happy', visualKind: 'emotion_face' },
            { id: 'opt_sad', label: 'Triste', emotion: 'sad', visualKind: 'emotion_face' },
            { id: 'opt_surprised', label: 'Sorprendido', emotion: 'surprised', visualKind: 'emotion_face' },
          ]
        : [
            { id: 'opt_sad', label: 'Triste', emotion: 'sad', visualKind: 'emotion_face' },
            { id: 'opt_calm', label: 'Calmo', emotion: 'calm', visualKind: 'emotion_face' },
            { id: 'opt_angry', label: 'Enojado', emotion: 'angry', visualKind: 'emotion_face' },
          ],
    },
    {
      id: `em_surprise_${formVariant}`,
      titleHint: '¡Algo salió de la caja!',
      blockType: 'emotion_ctx',
      isPractice: false,
      sceneKind: 'gift_surprise',
      targetEmotion: 'surprised',
      correctOptionId: 'opt_surprised',
      options: [
        { id: 'opt_surprised', label: 'Sorprendido', emotion: 'surprised', visualKind: 'emotion_face' },
        { id: 'opt_sad', label: 'Triste', emotion: 'sad', visualKind: 'emotion_face' },
        { id: 'opt_angry', label: 'Enojado', emotion: 'angry', visualKind: 'emotion_face' },
      ],
    },
    {
      id: `em_scared_${formVariant}`,
      titleHint: 'Un ruido en el arbusto',
      blockType: 'emotion_ctx',
      isPractice: false,
      sceneKind: 'rustling_bush',
      targetEmotion: 'scared',
      correctOptionId: 'opt_scared',
      options: [
        { id: 'opt_calm', label: 'Calmo', emotion: 'calm', visualKind: 'emotion_face' },
        { id: 'opt_scared', label: 'Asustado', emotion: 'scared', visualKind: 'emotion_face' },
        { id: 'opt_happy', label: 'Contento', emotion: 'happy', visualKind: 'emotion_face' },
      ],
    },
    {
      id: `em_happy_${formVariant}`,
      titleHint: 'Estrella en el puente',
      blockType: 'emotion_ctx',
      isPractice: false,
      sceneKind: 'bridge_built',
      targetEmotion: 'happy',
      correctOptionId: 'opt_happy',
      options: [
        { id: 'opt_angry', label: 'Enojado', emotion: 'angry', visualKind: 'emotion_face' },
        { id: 'opt_happy', label: 'Contento', emotion: 'happy', visualKind: 'emotion_face' },
        { id: 'opt_scared', label: 'Asustado', emotion: 'scared', visualKind: 'emotion_face' },
      ],
    },
  ];

  const mentalScenes: StorySceneSpec[] =
    subAgeBand === '4_5'
      ? [
          {
            id: `fb_ball_${formVariant}`,
            titleHint: '¿Dónde buscará su pelota AuriKat?',
            blockType: 'false_belief',
            isPractice: false,
            sceneKind: 'false_belief_ball',
            correctOptionId: isFormA ? 'opt_blue' : 'opt_green',
            options: [
              { id: 'opt_blue', label: 'Caja Azul', visualKind: 'box_blue' },
              { id: 'opt_green', label: 'Caja Verde', visualKind: 'box_green' },
              { id: 'opt_sand', label: 'Caja Arena', visualKind: 'box_sand' },
            ],
          },
          {
            id: `fb_desire_${formVariant}`,
            titleHint: '¿Dónde guardó su juguete favorito?',
            blockType: 'false_belief',
            isPractice: false,
            sceneKind: 'diverse_desire',
            correctOptionId: 'opt_green',
            options: [
              { id: 'opt_blue', label: 'Caja Azul', visualKind: 'box_blue' },
              { id: 'opt_green', label: 'Caja Verde', visualKind: 'box_green' },
              { id: 'opt_sand', label: 'Caja Arena', visualKind: 'box_sand' },
            ],
          },
        ]
      : [
          {
            id: `int_help_${formVariant}`,
            titleHint: '¿Qué hacen juntos?',
            blockType: 'intentionality',
            isPractice: false,
            sceneKind: 'intent_helping',
            correctOptionId: 'opt_help',
            options: [
              { id: 'opt_help', label: 'Ayudar', visualKind: 'intent_help' },
              { id: 'opt_hide', label: 'Esconderse', visualKind: 'intent_hide' },
              { id: 'opt_bump', label: 'Chocar', visualKind: 'intent_bump' },
            ],
          },
          {
            id: `int_hide_${formVariant}`,
            titleHint: '¿A qué están jugando?',
            blockType: 'intentionality',
            isPractice: false,
            sceneKind: 'intent_hiding',
            correctOptionId: 'opt_hide',
            options: [
              { id: 'opt_comfort', label: 'Abrazar', visualKind: 'intent_comfort' },
              { id: 'opt_hide', label: 'Esconderse', visualKind: 'intent_hide' },
              { id: 'opt_bump', label: 'Chocar', visualKind: 'intent_bump' },
            ],
          },
        ];

  const physicalControls: StorySceneSpec[] = [
    {
      id: `phys_ramp_${formVariant}`,
      titleHint: '¿A qué caja cae la pelota?',
      blockType: 'physical_ctrl',
      isPractice: false,
      sceneKind: 'physical_ramp',
      correctOptionId: 'opt_green',
      options: [
        { id: 'opt_blue', label: 'Caja Azul', visualKind: 'box_blue' },
        { id: 'opt_green', label: 'Caja Verde', visualKind: 'box_green' },
        { id: 'opt_sand', label: 'Caja Arena', visualKind: 'box_sand' },
      ],
    },
    {
      id: `phys_balloon_${formVariant}`,
      titleHint: '¿A dónde sube el globo?',
      blockType: 'physical_ctrl',
      isPractice: false,
      sceneKind: 'physical_balloon',
      correctOptionId: 'opt_blue',
      options: [
        { id: 'opt_blue', label: 'Caja Azul', visualKind: 'box_blue' },
        { id: 'opt_green', label: 'Caja Verde', visualKind: 'box_green' },
        { id: 'opt_sand', label: 'Caja Arena', visualKind: 'box_sand' },
      ],
    },
  ];

  if (isQuick) {
    return [practice, emotionScenes[0], emotionScenes[1], mentalScenes[0], physicalControls[0]];
  }
  return [practice, ...emotionScenes, ...mentalScenes, ...physicalControls];
}

const OptionCardGlyph: React.FC<{
  option: SceneOption;
  creatureInputs: CreatureViewModelInputs;
}> = ({ option, creatureInputs }) => {
  if (option.visualKind === 'emotion_face' && option.emotion) {
    return (
      <ProceduralCreatureRig
        inputs={{ ...creatureInputs, emotion: option.emotion, action: 'idle', motionScale: 0 }}
        size={76}
      />
    );
  }
  if (option.visualKind === 'box_blue' || option.visualKind === 'box_green' || option.visualKind === 'box_sand') {
    const fill =
      option.visualKind === 'box_blue'
        ? '#6D94B4'
        : option.visualKind === 'box_green'
          ? '#6C9B8A'
          : '#C4A882';
    return (
      <svg width="62" height="62" viewBox="0 0 64 64" aria-hidden="true">
        <rect x="10" y="18" width="44" height="34" rx="10" fill={fill} stroke="#2B3330" strokeWidth="2.8" />
        <line x1="10" y1="30" x2="54" y2="30" stroke="#2B3330" strokeWidth="2.4" />
        <rect x="28" y="26" width="8" height="8" rx="2" fill="var(--ak-au-gold)" />
      </svg>
    );
  }
  return (
    <svg width="62" height="62" viewBox="0 0 64 64" aria-hidden="true">
      {option.visualKind === 'intent_help' && (
        <g>
          <circle cx="20" cy="38" r="11" fill="#6C9B8A" stroke="#2B3330" strokeWidth="2.2" />
          <circle cx="44" cy="38" r="11" fill="#C59E49" stroke="#2B3330" strokeWidth="2.2" />
          <path d="M22 22 Q32 10 42 22" fill="none" stroke="#2B3330" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
      {option.visualKind === 'intent_hide' && (
        <g>
          <rect x="26" y="14" width="24" height="36" rx="6" fill="#6D94B4" stroke="#2B3330" strokeWidth="2.4" />
          <circle cx="19" cy="36" r="10" fill="#C59E49" stroke="#2B3330" strokeWidth="2.2" />
        </g>
      )}
      {option.visualKind === 'intent_comfort' && (
        <g>
          <circle cx="25" cy="38" r="11" fill="#9B86B8" stroke="#2B3330" strokeWidth="2.2" />
          <circle cx="39" cy="38" r="11" fill="#C59E49" stroke="#2B3330" strokeWidth="2.2" />
          <path d="M32 22 C28 16, 22 20, 32 28 C42 20, 36 16, 32 22 Z" fill="#C77A6B" />
        </g>
      )}
      {option.visualKind === 'intent_bump' && (
        <g>
          <circle cx="18" cy="34" r="10" fill="#8C99A2" stroke="#2B3330" strokeWidth="2.2" />
          <circle cx="46" cy="34" r="10" fill="#8C99A2" stroke="#2B3330" strokeWidth="2.2" />
          <path d="M29 26 L35 34 L29 42" fill="none" stroke="#2B3330" strokeWidth="2.8" />
        </g>
      )}
    </svg>
  );
};

/**
 * Game 3 v2.1: «3. Historias de AuriKat» (CLIN-05 + IC-1)
 * - 3-Beat Illustrated Comic Theater featuring the REAL full-body ProceduralCreatureRig of AuriKat
 * - Crystal-clear narrative props + thought/emotion "?" cloud at Step 3 + GuidingHandOverlay on practice
 */
export const EmotionToMGame: React.FC<EmotionToMGameProps> = ({
  creatureInputs,
  subAgeBand,
  formVariant,
  pacingMode = 'clinical_full',
  sensorySettings,
  onComplete,
}) => {
  const scenes = useMemo(
    () => buildToMScenes(subAgeBand, formVariant, pacingMode),
    [subAgeBand, formVariant, pacingMode],
  );
  const [idx, setIdx] = useState(0);
  const [animStep, setAnimStep] = useState<0 | 1 | 2>(0);
  const trialsRef = useRef<TrialRecord[]>([]);
  const readyAtRef = useRef<number>(performance.now());
  const interruptedRef = useRef(false);

  const current = scenes[idx];

  useEffect(() => {
    const onVis = () => {
      if (document.hidden) interruptedRef.current = true;
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    setAnimStep(0);
    interruptedRef.current = false;
    const t1 = window.setTimeout(() => setAnimStep(1), 750);
    const t2 = window.setTimeout(() => {
      setAnimStep(2);
      readyAtRef.current = performance.now();
    }, 1550);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [idx]);

  const handleChoose = (opt: SceneOption) => {
    if (animStep < 2 || !current) return;
    const rtMs = Math.max(0, performance.now() - readyAtRef.current);
    const correct = opt.id === current.correctOptionId ? 1 : 0;

    trialsRef.current.push({
      trialId: generateUuidV4(),
      gameId: 'G3_TOM',
      blockType: current.blockType,
      trialIndex: idx + 1,
      isPractice: current.isPractice,
      startedAtMs: readyAtRef.current,
      rtMs,
      accuracy: correct,
      errorCategory: correct ? 'none' : 'non_systematic',
      choiceChannel: opt.id,
      targetEmotion: current.targetEmotion,
      chosenEmotion: opt.emotion,
      sensoryBitmask: encodeSensoryBitmask(sensorySettings),
      interruptedByVisibility: interruptedRef.current,
    });

    gentleSoundEngine.playCue('tap_soft');
    if (idx + 1 >= scenes.length) {
      gentleSoundEngine.playCue('celebrate_chime');
      onComplete(trialsRef.current);
    } else {
      setIdx((i) => i + 1);
    }
  };

  if (!current) return null;

  const isPhysical = current.blockType === 'physical_ctrl';

  return (
    <section className="ak-stage-card" aria-label="Historias de AuriKat">
      <div className="ak-game-microheader">
        <span className="ak-phase-pill">📖 {current.titleHint}</span>

        <div className="ak-row" style={{ gap: 10 }}>
          <div className="ak-progress-dots" aria-hidden="true">
            {scenes.map((s, i) => (
              <span key={s.id} className="ak-dot" data-state={i < idx ? 'done' : i === idx ? 'current' : 'todo'} />
            ))}
          </div>
          <button
            type="button"
            className="ak-primary-target"
            style={{ minHeight: 46, minWidth: 112, padding: '6px 14px', flexDirection: 'row' }}
            onClick={() => {
              setAnimStep(0);
              window.setTimeout(() => setAnimStep(1), 700);
              window.setTimeout(() => {
                setAnimStep(2);
                readyAtRef.current = performance.now();
              }, 1450);
            }}
          >
            <span>↻ Ver escena</span>
          </button>
        </div>
      </div>

      {/* 3-Step Comic Beat Indicator (1 -> 2 -> 3) */}
      <div className="ak-row" style={{ gap: 10 }}>
        {[0, 1, 2].map((step) => (
          <span
            key={step}
            style={{
              padding: '4px 12px',
              borderRadius: 999,
              fontSize: '0.8rem',
              fontWeight: 800,
              background: animStep >= step ? 'var(--ak-accent)' : 'var(--ak-surface-raised)',
              color: animStep >= step ? '#F7F9F5' : 'var(--ak-ink-muted)',
              transition: 'all 220ms ease',
            }}
          >
            Viñeta {step + 1}
          </span>
        ))}
      </div>

      {/* Illustrated Comic Theater Stage featuring REAL Full-Body AuriKat */}
      <div
        style={{
          width: '100%',
          maxWidth: 610,
          minHeight: 230,
          borderRadius: 24,
          background: 'var(--ak-bg)',
          border: '2px solid var(--ak-surface-raised)',
          display: 'grid',
          gridTemplateColumns: isPhysical ? '1fr' : '185px 1fr',
          alignItems: 'center',
          padding: '12px 18px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Left Actor: Real Full-Body AuriKat Rig (with "?" Mystery Mask at Step 2 on Emotion scenes) */}
        {!isPhysical && (
          <div
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              transform:
                (current.sceneKind === 'false_belief_ball' || current.sceneKind === 'diverse_desire') &&
                animStep === 1
                  ? 'translateX(-180px)'
                  : 'translateX(0px)',
              transition: 'transform 480ms ease',
            }}
          >
            <ProceduralCreatureRig
              inputs={{
                ...creatureInputs,
                lookX: 0.75,
                lookY: 0.15,
                emotion: 'neutral',
                action: 'idle',
                motionScale: sensorySettings.motionScale,
              }}
              size={145}
            />
            {animStep >= 2 && (
              <div
                style={{
                  position: 'absolute',
                  top: 14,
                  padding: '6px 14px',
                  borderRadius: 999,
                  background: 'var(--ak-surface)',
                  border: '3px solid var(--ak-au-gold)',
                  fontWeight: 900,
                  fontSize: '1.25rem',
                  boxShadow: 'var(--ak-shadow-soft)',
                }}
              >
                💭 ?
              </div>
            )}
          </div>
        )}

        {/* Right Comic Action Stage */}
        <svg width="100%" height="195" viewBox="0 0 380 195" aria-hidden="true">
          {/* Fallen Tower (Sadness) */}
          {current.sceneKind === 'fallen_tower' && (
            <g>
              <g
                transform={animStep === 0 ? 'translate(0,0)' : 'translate(34,42) rotate(42 190 120)'}
                style={{ transition: 'transform 480ms ease' }}
              >
                <rect x="165" y="48" width="48" height="34" rx="6" fill="#C77A6B" stroke="#2B3330" strokeWidth="2.5" />
                <rect x="155" y="84" width="68" height="34" rx="6" fill="#5B85A8" stroke="#2B3330" strokeWidth="2.5" />
                <rect x="145" y="120" width="88" height="34" rx="6" fill="#6C9B8A" stroke="#2B3330" strokeWidth="2.5" />
              </g>
            </g>
          )}

          {/* Surprise Gift Box */}
          {current.sceneKind === 'gift_surprise' && (
            <g>
              <rect x="145" y="96" width="86" height="66" rx="10" fill="#6D94B4" stroke="#2B3330" strokeWidth="2.8" />
              <rect
                x="138"
                y={animStep >= 1 ? 52 : 86}
                width="100"
                height="20"
                rx="6"
                fill="#C59E49"
                stroke="#2B3330"
                strokeWidth="2.5"
                style={{ transition: 'y 380ms ease' }}
              />
              {animStep >= 1 && (
                <polygon
                  points="188,16 196,36 218,38 201,52 206,72 188,61 170,72 175,52 158,38 180,36"
                  fill="#C59E49"
                  stroke="#2B3330"
                  strokeWidth="2"
                />
              )}
            </g>
          )}

          {/* Rustling Bush (Scared) */}
          {current.sceneKind === 'rustling_bush' && (
            <g transform={animStep >= 1 ? 'translate(10,-4)' : 'translate(0,0)'} style={{ transition: 'transform 180ms ease' }}>
              <circle cx="195" cy="122" r="42" fill="#5E8B7E" stroke="#2B3330" strokeWidth="2.5" />
              <circle cx="238" cy="132" r="32" fill="#4D776B" stroke="#2B3330" strokeWidth="2.5" />
              <circle cx="156" cy="134" r="30" fill="#6C9B8A" stroke="#2B3330" strokeWidth="2.5" />
              {animStep >= 1 && (
                <>
                  <circle cx="188" cy="116" r="6" fill="#FAF8F2" />
                  <circle cx="210" cy="116" r="6" fill="#FAF8F2" />
                  <circle cx="188" cy="116" r="2.5" fill="#2B3330" />
                  <circle cx="210" cy="116" r="2.5" fill="#2B3330" />
                </>
              )}
            </g>
          )}

          {/* Bridge Built (Happy) */}
          {current.sceneKind === 'bridge_built' && (
            <g>
              <path d="M70 156 Q190 88 310 156" fill="none" stroke="#9C7A54" strokeWidth="18" strokeLinecap="round" />
              {animStep >= 1 && (
                <polygon
                  points="190,42 197,60 216,62 201,74 206,92 190,82 174,92 179,74 164,62 183,60"
                  fill="#C59E49"
                  stroke="#2B3330"
                  strokeWidth="2"
                />
              )}
            </g>
          )}

          {/* 1st-Order Non-Verbal False Belief (Ball moved by wind while AuriKat left!) */}
          {(current.sceneKind === 'false_belief_ball' || current.sceneKind === 'diverse_desire') && (
            <g>
              <rect x="25" y="114" width="84" height="58" rx="10" fill="#6D94B4" stroke="#2B3330" strokeWidth="2.8" />
              <rect x="148" y="114" width="84" height="58" rx="10" fill="#6C9B8A" stroke="#2B3330" strokeWidth="2.8" />
              <rect x="270" y="114" width="84" height="58" rx="10" fill="#C4A882" stroke="#2B3330" strokeWidth="2.8" />
              {animStep === 1 && current.sceneKind === 'false_belief_ball' && (
                <path d="M80 72 Q190 52 290 72" fill="none" stroke="#5B85A8" strokeWidth="3" strokeDasharray="6 6" />
              )}
              <circle
                cx={
                  current.sceneKind === 'diverse_desire'
                    ? 190
                    : animStep === 0
                      ? formVariant === 'A'
                        ? 67
                        : 190
                      : 312
                }
                cy="94"
                r="16"
                fill="#C59E49"
                stroke="#2B3330"
                strokeWidth="2.6"
                style={{ transition: 'cx 560ms ease' }}
              />
            </g>
          )}

          {/* 7-8+y Animated Intentionality */}
          {(current.sceneKind === 'intent_helping' || current.sceneKind === 'intent_hiding') && (
            <g>
              <rect x="175" y="86" width="58" height="78" rx="10" fill="#6D94B4" stroke="#2B3330" strokeWidth="2.8" />
              <circle
                cx={animStep === 0 ? 70 : current.sceneKind === 'intent_helping' ? 145 : 265}
                cy="132"
                r="24"
                fill="#C59E49"
                stroke="#2B3330"
                strokeWidth="2.8"
                style={{ transition: 'cx 620ms ease' }}
              />
              <circle
                cx={animStep === 0 ? 125 : current.sceneKind === 'intent_helping' ? 172 : 90}
                cy="132"
                r="21"
                fill="#6C9B8A"
                stroke="#2B3330"
                strokeWidth="2.8"
                style={{ transition: 'cx 620ms ease' }}
              />
            </g>
          )}

          {/* Physical Causality Controls (Wilson 2021) */}
          {current.sceneKind === 'physical_ramp' && (
            <g>
              <line x1="45" y1="48" x2="195" y2="124" stroke="#4A3C31" strokeWidth="8" strokeLinecap="round" />
              <rect x="35" y="130" width="80" height="48" rx="8" fill="#6D94B4" stroke="#2B3330" strokeWidth="2.5" />
              <rect x="155" y="130" width="80" height="48" rx="8" fill="#6C9B8A" stroke="#2B3330" strokeWidth="2.5" />
              <rect x="275" y="130" width="80" height="48" rx="8" fill="#C4A882" stroke="#2B3330" strokeWidth="2.5" />
              <circle
                cx={animStep === 0 ? 60 : animStep === 1 ? 135 : 195}
                cy={animStep === 0 ? 34 : animStep === 1 ? 76 : 112}
                r="15"
                fill="#C77A6B"
                stroke="#2B3330"
                strokeWidth="2.5"
                style={{ transition: 'all 520ms ease' }}
              />
            </g>
          )}

          {current.sceneKind === 'physical_balloon' && (
            <g>
              <rect x="35" y="22" width="84" height="46" rx="8" fill="#6D94B4" stroke="#2B3330" strokeWidth="2.5" />
              <rect x="155" y="128" width="84" height="46" rx="8" fill="#6C9B8A" stroke="#2B3330" strokeWidth="2.5" />
              <rect x="275" y="128" width="84" height="46" rx="8" fill="#C4A882" stroke="#2B3330" strokeWidth="2.5" />
              <circle
                cx="77"
                cy={animStep === 0 ? 156 : animStep === 1 ? 112 : 82}
                r="17"
                fill="#C59E49"
                stroke="#2B3330"
                strokeWidth="2.5"
                style={{ transition: 'cy 520ms ease' }}
              />
            </g>
          )}
        </svg>
      </div>

      {/* 3 Large Pictographic Multiple-Choice Cards (>= 115px) + Practice Guiding Hand */}
      <div
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(98px, 170px))',
          gap: 18,
          justifyContent: 'center',
          width: '100%',
          maxWidth: 560,
        }}
      >
        {current.isPractice && animStep >= 2 && (
          <GuidingHandOverlay mode="tap" toX="18%" toY="52%" label="Elegí la tarjeta" />
        )}

        {current.options.map((opt) => {
          const isPracticeHighlight = current.isPractice && animStep >= 2 && opt.id === current.correctOptionId;
          return (
            <button
              key={opt.id}
              type="button"
              className={`ak-primary-target ${isPracticeHighlight ? 'ak-practice-glow' : ''}`}
              style={{
                minHeight: 122,
                opacity: animStep < 2 ? 0.48 : 1,
              }}
              disabled={animStep < 2}
              onClick={() => handleChoose(opt)}
              aria-label={opt.label}
            >
              <OptionCardGlyph option={opt} creatureInputs={creatureInputs} />
              <span style={{ fontSize: '0.88rem' }}>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
