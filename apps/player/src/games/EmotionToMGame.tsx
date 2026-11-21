import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  encodeSensoryBitmask,
  generateUuidV4,
  gentleSoundEngine,
  type CreatureViewModelInputs,
  type EmotionId,
  type FormVariant,
  type SensoryCalmSettings,
  type SubAgeBand,
  type TrialRecord,
} from '@aurikat/core-engine';
import { ProceduralCreatureRig } from '../components/ProceduralCreatureRig.js';

interface EmotionToMGameProps {
  creatureInputs: CreatureViewModelInputs;
  subAgeBand: SubAgeBand;
  formVariant: FormVariant;
  sensorySettings: SensoryCalmSettings;
  onComplete: (trials: TrialRecord[]) => void;
}

interface SceneOption {
  id: string;
  emotion?: EmotionId;
  visualKind: 'emotion_face' | 'box_blue' | 'box_green' | 'box_sand' | 'intent_help' | 'intent_hide' | 'intent_comfort' | 'intent_bump';
}

interface StorySceneSpec {
  id: string;
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

function buildToMScenes(subAgeBand: SubAgeBand, formVariant: FormVariant): StorySceneSpec[] {
  const isFormA = formVariant === 'A';
  const practice: StorySceneSpec = {
    id: 'prac_happy',
    blockType: 'practice',
    isPractice: true,
    sceneKind: 'bridge_built',
    targetEmotion: 'happy',
    correctOptionId: 'opt_happy',
    options: [
      { id: 'opt_happy', emotion: 'happy', visualKind: 'emotion_face' },
      { id: 'opt_sad', emotion: 'sad', visualKind: 'emotion_face' },
      { id: 'opt_scared', emotion: 'scared', visualKind: 'emotion_face' },
    ],
  };

  const emotionScenes: StorySceneSpec[] = [
    {
      id: `em_sad_${formVariant}`,
      blockType: 'emotion_ctx',
      isPractice: false,
      sceneKind: 'fallen_tower',
      targetEmotion: 'sad',
      correctOptionId: 'opt_sad',
      options: isFormA
        ? [
            { id: 'opt_happy', emotion: 'happy', visualKind: 'emotion_face' },
            { id: 'opt_sad', emotion: 'sad', visualKind: 'emotion_face' },
            { id: 'opt_surprised', emotion: 'surprised', visualKind: 'emotion_face' },
          ]
        : [
            { id: 'opt_sad', emotion: 'sad', visualKind: 'emotion_face' },
            { id: 'opt_calm', emotion: 'calm', visualKind: 'emotion_face' },
            { id: 'opt_angry', emotion: 'angry', visualKind: 'emotion_face' },
          ],
    },
    {
      id: `em_surprise_${formVariant}`,
      blockType: 'emotion_ctx',
      isPractice: false,
      sceneKind: 'gift_surprise',
      targetEmotion: 'surprised',
      correctOptionId: 'opt_surprised',
      options: [
        { id: 'opt_surprised', emotion: 'surprised', visualKind: 'emotion_face' },
        { id: 'opt_sad', emotion: 'sad', visualKind: 'emotion_face' },
        { id: 'opt_angry', emotion: 'angry', visualKind: 'emotion_face' },
      ],
    },
    {
      id: `em_scared_${formVariant}`,
      blockType: 'emotion_ctx',
      isPractice: false,
      sceneKind: 'rustling_bush',
      targetEmotion: 'scared',
      correctOptionId: 'opt_scared',
      options: [
        { id: 'opt_calm', emotion: 'calm', visualKind: 'emotion_face' },
        { id: 'opt_scared', emotion: 'scared', visualKind: 'emotion_face' },
        { id: 'opt_happy', emotion: 'happy', visualKind: 'emotion_face' },
      ],
    },
    {
      id: `em_happy_${formVariant}`,
      blockType: 'emotion_ctx',
      isPractice: false,
      sceneKind: 'bridge_built',
      targetEmotion: 'happy',
      correctOptionId: 'opt_happy',
      options: [
        { id: 'opt_angry', emotion: 'angry', visualKind: 'emotion_face' },
        { id: 'opt_happy', emotion: 'happy', visualKind: 'emotion_face' },
        { id: 'opt_scared', emotion: 'scared', visualKind: 'emotion_face' },
      ],
    },
  ];

  // Tier 4-6y: Non-verbal 1st-order false belief; Tier 7-8+y: Animated intentionality (zero "seducing")
  const mentalScenes: StorySceneSpec[] =
    subAgeBand === '4_5'
      ? [
          {
            id: `fb_ball_${formVariant}`,
            blockType: 'false_belief',
            isPractice: false,
            sceneKind: 'false_belief_ball',
            correctOptionId: isFormA ? 'opt_blue' : 'opt_green',
            options: [
              { id: 'opt_blue', visualKind: 'box_blue' },
              { id: 'opt_green', visualKind: 'box_green' },
              { id: 'opt_sand', visualKind: 'box_sand' },
            ],
          },
          {
            id: `fb_desire_${formVariant}`,
            blockType: 'false_belief',
            isPractice: false,
            sceneKind: 'diverse_desire',
            correctOptionId: 'opt_green',
            options: [
              { id: 'opt_blue', visualKind: 'box_blue' },
              { id: 'opt_green', visualKind: 'box_green' },
              { id: 'opt_sand', visualKind: 'box_sand' },
            ],
          },
        ]
      : [
          {
            id: `int_help_${formVariant}`,
            blockType: 'intentionality',
            isPractice: false,
            sceneKind: 'intent_helping',
            correctOptionId: 'opt_help',
            options: [
              { id: 'opt_help', visualKind: 'intent_help' },
              { id: 'opt_hide', visualKind: 'intent_hide' },
              { id: 'opt_bump', visualKind: 'intent_bump' },
            ],
          },
          {
            id: `int_hide_${formVariant}`,
            blockType: 'intentionality',
            isPractice: false,
            sceneKind: 'intent_hiding',
            correctOptionId: 'opt_hide',
            options: [
              { id: 'opt_comfort', visualKind: 'intent_comfort' },
              { id: 'opt_hide', visualKind: 'intent_hide' },
              { id: 'opt_bump', visualKind: 'intent_bump' },
            ],
          },
        ];

  // Mandatory 2 Physical Causality Control items (Wilson 2021)
  const physicalControls: StorySceneSpec[] = [
    {
      id: `phys_ramp_${formVariant}`,
      blockType: 'physical_ctrl',
      isPractice: false,
      sceneKind: 'physical_ramp',
      correctOptionId: 'opt_green',
      options: [
        { id: 'opt_blue', visualKind: 'box_blue' },
        { id: 'opt_green', visualKind: 'box_green' },
        { id: 'opt_sand', visualKind: 'box_sand' },
      ],
    },
    {
      id: `phys_balloon_${formVariant}`,
      blockType: 'physical_ctrl',
      isPractice: false,
      sceneKind: 'physical_balloon',
      correctOptionId: 'opt_blue',
      options: [
        { id: 'opt_blue', visualKind: 'box_blue' },
        { id: 'opt_green', visualKind: 'box_green' },
        { id: 'opt_sand', visualKind: 'box_sand' },
      ],
    },
  ];

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
        size={78}
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
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
        <rect x="10" y="18" width="44" height="34" rx="10" fill={fill} stroke="#2B3330" strokeWidth="2.8" />
        <line x1="10" y1="30" x2="54" y2="30" stroke="#2B3330" strokeWidth="2.4" />
      </svg>
    );
  }
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
      {option.visualKind === 'intent_help' && (
        <g>
          <circle cx="22" cy="36" r="10" fill="#6C9B8A" />
          <circle cx="42" cy="36" r="10" fill="#C59E49" />
          <path d="M22 20 Q32 10 42 20" fill="none" stroke="#2B3330" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
      {option.visualKind === 'intent_hide' && (
        <g>
          <rect x="28" y="16" width="22" height="34" rx="6" fill="#6D94B4" />
          <circle cx="20" cy="36" r="9" fill="#C59E49" />
          <circle cx="24" cy="34" r="2" fill="#2B3330" />
        </g>
      )}
      {option.visualKind === 'intent_comfort' && (
        <g>
          <circle cx="26" cy="36" r="11" fill="#9B86B8" />
          <circle cx="39" cy="36" r="11" fill="#C59E49" />
          <path d="M32 22 C28 16, 22 20, 32 28 C42 20, 36 16, 32 22 Z" fill="#C77A6B" />
        </g>
      )}
      {option.visualKind === 'intent_bump' && (
        <g>
          <circle cx="20" cy="34" r="10" fill="#8C99A2" />
          <circle cx="46" cy="34" r="10" fill="#8C99A2" />
          <path d="M30 28 L36 34 L30 40" fill="none" stroke="#2B3330" strokeWidth="2.8" />
        </g>
      )}
    </svg>
  );
};

/**
 * Game 3: «¿Qué siente y qué busca?» (CLIN-05 + IC-1)
 * - 2 developmental tiers (4-6y contextual emotions incl. surprise + 1st-order false belief; 7-8+y intentionality)
 * - Parallel Forms A/B + 2 mandatory Physical Causality Control items (Wilson 2021)
 * - Block-level guaranteed reward (zero item-by-item fanfare bias)
 */
export const EmotionToMGame: React.FC<EmotionToMGameProps> = ({
  creatureInputs,
  subAgeBand,
  formVariant,
  sensorySettings,
  onComplete,
}) => {
  const scenes = useMemo(() => buildToMScenes(subAgeBand, formVariant), [subAgeBand, formVariant]);
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

  // Animate each 3-beat silent visual vignette
  useEffect(() => {
    setAnimStep(0);
    interruptedRef.current = false;
    const t1 = window.setTimeout(() => setAnimStep(1), 850);
    const t2 = window.setTimeout(() => {
      setAnimStep(2);
      readyAtRef.current = performance.now();
    }, 1750);
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

    // IC-1: Identical soft neutral sound per item (reward only at block completion)
    gentleSoundEngine.playCue('tap_soft');
    if (idx + 1 >= scenes.length) {
      gentleSoundEngine.playCue('celebrate_chime');
      onComplete(trialsRef.current);
    } else {
      setIdx((i) => i + 1);
    }
  };

  if (!current) return null;

  return (
    <section className="ak-stage-card" aria-label="¿Qué siente y qué busca?">
      <div className="ak-row" style={{ width: '100%', justifyContent: 'space-between' }}>
        <div className="ak-progress-dots" aria-hidden="true">
          {scenes.map((s, i) => (
            <span key={s.id} className="ak-dot" data-state={i < idx ? 'done' : i === idx ? 'current' : 'todo'} />
          ))}
        </div>
        <button
          type="button"
          className="ak-icon-btn"
          style={{ minWidth: 48, minHeight: 48 }}
          onClick={() => setAnimStep(0)}
          aria-label="Repetir escena"
          title="Ver escena de nuevo"
        >
          ↻
        </button>
      </div>

      {/* Silent Animated Narrative Stage */}
      <div
        style={{
          width: '100%',
          maxWidth: 580,
          height: 220,
          borderRadius: 24,
          background: 'var(--ak-bg)',
          border: '2px solid var(--ak-surface-raised)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <svg width="520" height="200" viewBox="0 0 520 200" aria-hidden="true">
          {/* Scene: Fallen Tower (Sadness) */}
          {current.sceneKind === 'fallen_tower' && (
            <g>
              <g transform={animStep === 0 ? 'translate(0,0)' : 'translate(22,38) rotate(36 280 120)'} style={{ transition: 'transform 500ms ease' }}>
                <rect x="260" y="64" width="44" height="32" rx="6" fill="#C77A6B" />
                <rect x="252" y="98" width="60" height="32" rx="6" fill="#5B85A8" />
                <rect x="244" y="132" width="76" height="32" rx="6" fill="#6C9B8A" />
              </g>
              <circle cx="145" cy="118" r="34" fill="#D9B68C" stroke="#4A3C31" strokeWidth="3" />
              <text x="145" y="124" textAnchor="middle" fontSize="22">?</text>
            </g>
          )}

          {/* Scene: Surprise Gift */}
          {current.sceneKind === 'gift_surprise' && (
            <g>
              <rect x="245" y="102" width="78" height="62" rx="10" fill="#6D94B4" stroke="#2B3330" strokeWidth="3" />
              <rect
                x="238"
                y={animStep >= 1 ? 66 : 94}
                width="92"
                height="20"
                rx="6"
                fill="#C59E49"
                style={{ transition: 'y 400ms ease' }}
              />
              {animStep >= 1 && (
                <polygon points="284,26 292,46 314,48 297,62 302,82 284,71 266,82 271,62 254,48 276,46" fill="#C59E49" />
              )}
              <circle cx="145" cy="118" r="34" fill="#D9B68C" stroke="#4A3C31" strokeWidth="3" />
              <text x="145" y="124" textAnchor="middle" fontSize="22">?</text>
            </g>
          )}

          {/* Scene: Rustling Bush (Scared) */}
          {current.sceneKind === 'rustling_bush' && (
            <g>
              <g transform={animStep === 1 ? 'translate(8,-4)' : 'translate(0,0)'} style={{ transition: 'transform 180ms ease' }}>
                <circle cx="310" cy="126" r="38" fill="#5E8B7E" />
                <circle cx="350" cy="134" r="30" fill="#4D776B" />
                <circle cx="278" cy="136" r="28" fill="#6C9B8A" />
                {animStep >= 1 && (
                  <>
                    <circle cx="305" cy="118" r="5" fill="#F7F9F5" />
                    <circle cx="323" cy="118" r="5" fill="#F7F9F5" />
                  </>
                )}
              </g>
              <circle cx="145" cy="118" r="34" fill="#D9B68C" stroke="#4A3C31" strokeWidth="3" />
              <text x="145" y="124" textAnchor="middle" fontSize="22">?</text>
            </g>
          )}

          {/* Scene: Bridge Built (Happy) */}
          {current.sceneKind === 'bridge_built' && (
            <g>
              <path d="M180 154 Q280 92 380 154" fill="none" stroke="#9C7A54" strokeWidth="18" strokeLinecap="round" />
              {animStep >= 1 && <circle cx="280" cy="84" r="16" fill="#C59E49" />}
              <circle cx="135" cy="124" r="32" fill="#D9B68C" stroke="#4A3C31" strokeWidth="3" />
              <text x="135" y="130" textAnchor="middle" fontSize="22">?</text>
            </g>
          )}

          {/* Scene: 1st-Order Non-Verbal False Belief (Ball moved while AuriKat left!) */}
          {(current.sceneKind === 'false_belief_ball' || current.sceneKind === 'diverse_desire') && (
            <g>
              <rect x="85" y="114" width="76" height="58" rx="10" fill="#6D94B4" stroke="#2B3330" strokeWidth="3" />
              <rect x="222" y="114" width="76" height="58" rx="10" fill="#6C9B8A" stroke="#2B3330" strokeWidth="3" />
              <rect x="358" y="114" width="76" height="58" rx="10" fill="#C4A882" stroke="#2B3330" strokeWidth="3" />
              {/* Ball starts in Blue (Form A) or Green (Form B) and wind moves it when character leaves */}
              <circle
                cx={animStep === 0 ? (formVariant === 'A' ? 123 : 260) : 396}
                cy="96"
                r="14"
                fill="#C59E49"
                stroke="#2B3330"
                strokeWidth="2.4"
                style={{ transition: 'cx 600ms ease' }}
              />
              {/* Character leaves at step 1, returns at step 2 */}
              <circle
                cx={animStep === 1 ? -40 : 60}
                cy="58"
                r="24"
                fill="#D9B68C"
                stroke="#4A3C31"
                strokeWidth="3"
                style={{ transition: 'cx 500ms ease' }}
              />
            </g>
          )}

          {/* Scene: 7-8+y Animated Intentionality (Helping / Hiding) */}
          {(current.sceneKind === 'intent_helping' || current.sceneKind === 'intent_hiding') && (
            <g>
              <rect x="240" y="96" width="52" height="72" rx="8" fill="#6D94B4" stroke="#2B3330" strokeWidth="2.8" />
              <circle
                cx={animStep === 0 ? 130 : current.sceneKind === 'intent_helping' ? 210 : 326}
                cy="132"
                r="22"
                fill="#C59E49"
                stroke="#2B3330"
                strokeWidth="2.8"
                style={{ transition: 'cx 650ms ease' }}
              />
              <circle
                cx={animStep === 0 ? 185 : current.sceneKind === 'intent_helping' ? 238 : 140}
                cy="132"
                r="20"
                fill="#6C9B8A"
                stroke="#2B3330"
                strokeWidth="2.8"
                style={{ transition: 'cx 650ms ease' }}
              />
            </g>
          )}

          {/* Physical Causality Control Scenes (Wilson 2021) */}
          {current.sceneKind === 'physical_ramp' && (
            <g>
              <line x1="90" y1="54" x2="260" y2="128" stroke="#4A3C31" strokeWidth="8" strokeLinecap="round" />
              <rect x="85" y="130" width="70" height="48" rx="8" fill="#6D94B4" />
              <rect x="225" y="130" width="70" height="48" rx="8" fill="#6C9B8A" />
              <rect x="365" y="130" width="70" height="48" rx="8" fill="#C4A882" />
              <circle
                cx={animStep === 0 ? 102 : animStep === 1 ? 190 : 258}
                cy={animStep === 0 ? 42 : animStep === 1 ? 82 : 114}
                r="14"
                fill="#C77A6B"
                style={{ transition: 'all 550ms ease' }}
              />
            </g>
          )}

          {current.sceneKind === 'physical_balloon' && (
            <g>
              <rect x="85" y="26" width="74" height="44" rx="8" fill="#6D94B4" />
              <rect x="225" y="128" width="74" height="44" rx="8" fill="#6C9B8A" />
              <rect x="365" y="128" width="74" height="44" rx="8" fill="#C4A882" />
              <circle
                cx="122"
                cy={animStep === 0 ? 156 : animStep === 1 ? 112 : 82}
                r="16"
                fill="#C59E49"
                style={{ transition: 'cy 550ms ease' }}
              />
            </g>
          )}
        </svg>
      </div>

      {/* 3 Pictographic Multiple-Choice Cards (>= 96px touch targets) */}
      <div className="ak-row" style={{ justifyContent: 'center', gap: 18 }}>
        {current.options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className="ak-primary-target"
            style={{
              minWidth: 108,
              minHeight: 108,
              opacity: animStep < 2 ? 0.5 : 1,
            }}
            disabled={animStep < 2}
            onClick={() => handleChoose(opt)}
            aria-label={`Opción ${opt.id}`}
          >
            <OptionCardGlyph option={opt} creatureInputs={creatureInputs} />
          </button>
        ))}
      </div>
    </section>
  );
};
