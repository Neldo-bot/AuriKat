import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  classifyHoldoverVsImpulsive,
  encodeSensoryBitmask,
  generateUuidV4,
  gentleSoundEngine,
  type CreatureActionId,
  type CreatureViewModelInputs,
  type EmotionId,
  type SensoryCalmSettings,
  type SessionPacingMode,
  type SubAgeBand,
  type TrialRecord,
} from '@aurikat/core-engine';
import { GuidingHandOverlay } from '../components/GuidingHandOverlay.js';
import { ProceduralCreatureRig } from '../components/ProceduralCreatureRig.js';

interface JointAttentionGameProps {
  creatureInputs: CreatureViewModelInputs;
  subAgeBand: SubAgeBand;
  pacingMode?: SessionPacingMode;
  sensorySettings: SensoryCalmSettings;
  onComplete: (trials: TrialRecord[]) => void;
}

type Side = 'left' | 'center' | 'right';

interface JaTrialSpec {
  blockType: 'practice' | 'social_cue' | 'arrow_cue' | 'contingency' | 'micro_ija';
  isPractice: boolean;
  targetSide: Side;
  usePointing: boolean;
  distractedGaze?: boolean;
}

function buildJaSequence(subAgeBand: SubAgeBand, pacingMode: SessionPacingMode): JaTrialSpec[] {
  const isQuick = pacingMode === 'quick_demo';
  const practice: JaTrialSpec[] = isQuick
    ? [{ blockType: 'practice', isPractice: true, targetSide: 'right', usePointing: true }]
    : [
        { blockType: 'practice', isPractice: true, targetSide: 'left', usePointing: true },
        { blockType: 'practice', isPractice: true, targetSide: 'right', usePointing: subAgeBand === '4_5' },
      ];

  const socialSides: Side[] = isQuick ? ['left', 'right', 'center'] : ['left', 'right', 'center', 'right', 'left', 'center'];
  const social: JaTrialSpec[] = socialSides.map((side, i) => ({
    blockType: 'social_cue',
    isPractice: false,
    targetSide: side,
    usePointing: subAgeBand === '4_5' && i < 3,
  }));

  const arrowSides: Side[] = isQuick ? ['right', 'left', 'center'] : ['right', 'center', 'left', 'center', 'right', 'left'];
  const arrow: JaTrialSpec[] = arrowSides.map((side) => ({
    blockType: 'arrow_cue',
    isPractice: false,
    targetSide: side,
    usePointing: false,
  }));

  const contingency: JaTrialSpec[] = isQuick
    ? [
        { blockType: 'contingency', isPractice: false, targetSide: 'left', usePointing: false, distractedGaze: false },
        { blockType: 'contingency', isPractice: false, targetSide: 'right', usePointing: false, distractedGaze: true },
      ]
    : [
        { blockType: 'contingency', isPractice: false, targetSide: 'left', usePointing: false, distractedGaze: false },
        { blockType: 'contingency', isPractice: false, targetSide: 'right', usePointing: false, distractedGaze: true },
        { blockType: 'contingency', isPractice: false, targetSide: 'center', usePointing: false, distractedGaze: false },
        { blockType: 'contingency', isPractice: false, targetSide: 'left', usePointing: false, distractedGaze: true },
      ];

  const microIja: JaTrialSpec[] = isQuick
    ? [{ blockType: 'micro_ija', isPractice: false, targetSide: 'right', usePointing: false }]
    : [
        { blockType: 'micro_ija', isPractice: false, targetSide: 'right', usePointing: false },
        { blockType: 'micro_ija', isPractice: false, targetSide: 'left', usePointing: false },
      ];

  return [...practice, ...social, ...arrow, ...contingency, ...microIja];
}

const SIDE_TO_LOOKX: Record<Side, number> = { left: -0.95, center: 0, right: 0.95 };
const SIDE_TO_ACTION: Record<Side, CreatureActionId> = {
  left: 'point_left',
  center: 'point_center',
  right: 'point_right',
};
const SIDE_TO_HAND_X: Record<Side, string> = {
  left: '18%',
  center: '50%',
  right: '82%',
};

/**
 * Game 1 v2.1: «1. ¿Dónde miró AuriKat?» (CLIN-03 + IC-1 + IC-4)
 * - Theatrical demo with golden dotted gaze ray from AuriKat's eyes to chest + GuidingHandOverlay + animated hinged lid
 * - Guided practice trials with soft golden outline + hand pointer
 * - Scored trials remove dotted ray/halo; contrast social gaze vs. giant compass arrow + Micro-IJA firefly with "!" bubble
 */
export const JointAttentionGame: React.FC<JointAttentionGameProps> = ({
  creatureInputs,
  subAgeBand,
  pacingMode = 'clinical_full',
  sensorySettings,
  onComplete,
}) => {
  const sequence = useMemo(() => buildJaSequence(subAgeBand, pacingMode), [subAgeBand, pacingMode]);
  const [phase, setPhase] = useState<'demo' | 'play' | 'done'>('demo');
  const [demoStep, setDemoStep] = useState<0 | 1 | 2>(0);
  const [trialIdx, setTrialIdx] = useState(0);
  const [cueState, setCueState] = useState<'fixation' | 'cue_soa' | 'ready' | 'feedback'>('fixation');
  const [revealedSide, setRevealedSide] = useState<Side | null>(null);
  const [sharedIjaCelebration, setSharedIjaCelebration] = useState(false);

  const trialsRef = useRef<TrialRecord[]>([]);
  const readyAtRef = useRef<number>(performance.now());
  const prevTrialEndRef = useRef<number>(0);
  const interruptedRef = useRef(false);

  useEffect(() => {
    const onVis = () => {
      if (document.hidden) interruptedRef.current = true;
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Theatrical 2.4s animated demo
  useEffect(() => {
    if (phase !== 'demo') return;
    setDemoStep(0);
    const t1 = window.setTimeout(() => setDemoStep(1), 650);
    const t2 = window.setTimeout(() => setDemoStep(2), 1450);
    const t3 = window.setTimeout(() => setPhase('play'), 2500);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [phase]);

  const current = sequence[trialIdx];

  useEffect(() => {
    if (phase !== 'play' || !current) return;
    setRevealedSide(null);
    setSharedIjaCelebration(false);
    interruptedRef.current = false;

    if (current.blockType === 'micro_ija') {
      setCueState('ready');
      readyAtRef.current = performance.now();
      return;
    }

    setCueState('fixation');
    const t1 = window.setTimeout(() => setCueState('cue_soa'), 450);
    const t2 = window.setTimeout(() => {
      setCueState('ready');
      readyAtRef.current = performance.now();
    }, 750);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [phase, trialIdx, current]);

  const advanceOrFinish = () => {
    prevTrialEndRef.current = performance.now();
    if (trialIdx + 1 >= sequence.length) {
      setPhase('done');
      gentleSoundEngine.playCue('celebrate_chime');
      onComplete(trialsRef.current);
    } else {
      setTrialIdx((i) => i + 1);
    }
  };

  const handleBoxTap = (side: Side) => {
    if (phase !== 'play' || !current || current.blockType === 'micro_ija') return;
    const now = performance.now();

    if (cueState === 'fixation' || cueState === 'cue_soa') {
      const cat = classifyHoldoverVsImpulsive(now - prevTrialEndRef.current);
      trialsRef.current.push({
        trialId: generateUuidV4(),
        gameId: 'G1_JA',
        blockType: current.blockType,
        trialIndex: trialIdx + 1,
        isPractice: current.isPractice,
        startedAtMs: now,
        rtMs: 0,
        accuracy: 0,
        errorCategory: cat,
        choiceChannel: side,
        stimulusSide: current.targetSide,
        sensoryBitmask: encodeSensoryBitmask(sensorySettings),
        interruptedByVisibility: interruptedRef.current,
      });
      return;
    }

    if (cueState !== 'ready') return;

    const rtMs = Math.max(0, now - readyAtRef.current);
    const correct = side === current.targetSide ? 1 : 0;

    trialsRef.current.push({
      trialId: generateUuidV4(),
      gameId: 'G1_JA',
      blockType: current.blockType,
      trialIndex: trialIdx + 1,
      isPractice: current.isPractice,
      startedAtMs: readyAtRef.current,
      rtMs,
      accuracy: correct,
      errorCategory: correct ? 'none' : 'non_systematic',
      choiceChannel: side,
      stimulusSide: current.targetSide,
      sensoryBitmask: encodeSensoryBitmask(sensorySettings),
      interruptedByVisibility: interruptedRef.current,
    });

    setCueState('feedback');
    setRevealedSide(side);
    gentleSoundEngine.playCue(correct ? 'animalese_happy' : 'neutral_soft_fail');
    window.setTimeout(advanceOrFinish, 720);
  };

  const handleMicroIjaChoice = (sharedWithAuriKat: boolean) => {
    if (phase !== 'play' || !current || current.blockType !== 'micro_ija' || cueState !== 'ready') return;
    const now = performance.now();
    const rtMs = Math.max(0, now - readyAtRef.current);
    trialsRef.current.push({
      trialId: generateUuidV4(),
      gameId: 'G1_JA',
      blockType: 'micro_ija',
      trialIndex: trialIdx + 1,
      isPractice: false,
      startedAtMs: readyAtRef.current,
      rtMs,
      accuracy: sharedWithAuriKat ? 1 : 0,
      errorCategory: 'none',
      choiceChannel: sharedWithAuriKat ? 'shared_with_aurikat' : 'object_direct',
      stimulusSide: current.targetSide,
      sensoryBitmask: encodeSensoryBitmask(sensorySettings),
      interruptedByVisibility: interruptedRef.current,
    });
    setCueState('feedback');
    setSharedIjaCelebration(sharedWithAuriKat);
    gentleSoundEngine.playCue(sharedWithAuriKat ? 'animalese_happy' : 'tap_soft');
    window.setTimeout(advanceOrFinish, 880);
  };

  let rigLookX = 0;
  let rigLookY = 0;
  let rigEmotion: EmotionId = 'neutral';
  let rigAction: CreatureActionId = 'idle';

  if (phase === 'demo') {
    rigLookX = demoStep >= 1 ? 0.95 : 0;
    rigLookY = demoStep >= 1 ? 0.45 : 0;
    rigEmotion = demoStep >= 1 ? 'surprised' : 'calm';
    rigAction = demoStep >= 1 ? 'point_right' : 'idle';
  } else if (current) {
    if (current.blockType === 'micro_ija') {
      if (sharedIjaCelebration) {
        rigLookX = SIDE_TO_LOOKX[current.targetSide];
        rigLookY = -0.5;
        rigEmotion = 'happy';
        rigAction = 'celebrate_soft';
      } else {
        rigAction = 'look_away';
        rigEmotion = 'calm';
      }
    } else if (cueState !== 'fixation') {
      if (current.blockType === 'arrow_cue') {
        rigLookX = 0;
        rigLookY = 0;
        rigEmotion = 'neutral';
      } else if (current.distractedGaze) {
        rigLookX = -SIDE_TO_LOOKX[current.targetSide] * 0.7;
        rigLookY = -0.65;
        rigEmotion = 'calm';
      } else {
        rigLookX = SIDE_TO_LOOKX[current.targetSide];
        rigLookY = 0.45;
        rigEmotion = cueState === 'feedback' ? 'happy' : 'surprised';
        if (current.usePointing) rigAction = SIDE_TO_ACTION[current.targetSide];
      }
    }
  }

  const showDottedGazeRay =
    (phase === 'demo' && demoStep >= 1) ||
    (phase === 'play' && current?.isPractice && cueState !== 'fixation');
  const rayTargetSide: Side = phase === 'demo' ? 'right' : current?.targetSide ?? 'right';

  return (
    <section className="ak-stage-card" aria-label="¿Dónde miró AuriKat?">
      {/* Clear Optional Micro-Header */}
      <div className="ak-game-microheader">
        <div className="ak-row" style={{ gap: 10 }}>
          <span className="ak-phase-pill">
            {phase === 'demo'
              ? '👀 Mirá el ejemplo'
              : current?.isPractice
                ? '✨ Práctica guiada'
                : current?.blockType === 'arrow_cue'
                  ? '🧭 Seguí la brújula'
                  : current?.blockType === 'micro_ija'
                    ? '✦ ¡Sorpresa en el cielo!'
                    : '👀 ¿Dónde miró AuriKat?'}
          </span>
        </div>

        <div className="ak-row" style={{ gap: 10 }}>
          <div className="ak-progress-dots" aria-hidden="true">
            {sequence.map((_, i) => (
              <span
                key={i}
                className="ak-dot"
                data-state={i < trialIdx ? 'done' : i === trialIdx ? 'current' : 'todo'}
              />
            ))}
          </div>
          <button
            type="button"
            className="ak-primary-target"
            style={{ minHeight: 46, minWidth: 112, padding: '6px 14px', flexDirection: 'row' }}
            onClick={() => setPhase('demo')}
          >
            <span>↻ Ver ejemplo</span>
          </button>
        </div>
      </div>

      {/* Theatrical Stage Area */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 620,
          minHeight: 245,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
        }}
      >
        {/* Golden Dotted Gaze Ray (Visible ONLY during Demo & Practice so the mechanic is 100% obvious!) */}
        {showDottedGazeRay && (
          <svg
            viewBox="0 0 600 240"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }}
          >
            <line
              x1="300"
              y1="95"
              x2={rayTargetSide === 'left' ? 110 : rayTargetSide === 'center' ? 300 : 490}
              y2="235"
              stroke="var(--ak-au-gold)"
              strokeWidth="4"
              strokeDasharray="10 8"
              strokeLinecap="round"
            />
          </svg>
        )}

        {/* Micro-IJA unexpected glowing firefly */}
        {phase === 'play' && current?.blockType === 'micro_ija' && (
          <button
            type="button"
            onClick={() => handleMicroIjaChoice(false)}
            aria-label="Luciérnaga luminosa"
            style={{
              position: 'absolute',
              top: 8,
              right: current.targetSide === 'right' ? 18 : undefined,
              left: current.targetSide === 'left' ? 18 : undefined,
              minWidth: 78,
              minHeight: 78,
              borderRadius: '50%',
              border: '3px solid var(--ak-au-gold)',
              background: 'radial-gradient(circle, #FAF0CA, var(--ak-au-gold))',
              boxShadow: '0 0 22px rgba(197,158,73,0.52)',
              cursor: 'pointer',
              fontSize: '1.6rem',
              animation: sensorySettings.motionScale > 0 ? 'akFirefly 2.2s ease-in-out infinite' : 'none',
            }}
          >
            ✦
          </button>
        )}

        {/* Distractor butterfly on incongruent contingency trials */}
        {phase === 'play' && current?.distractedGaze && cueState !== 'fixation' && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 12,
              left: current.targetSide === 'right' ? 28 : undefined,
              right: current.targetSide === 'left' ? 28 : undefined,
              fontSize: '1.9rem',
              opacity: 0.85,
            }}
          >
            🦋
          </div>
        )}

        {/* Micro-IJA call bubble on AuriKat */}
        {phase === 'play' && current?.blockType === 'micro_ija' && !sharedIjaCelebration && (
          <button
            type="button"
            onClick={() => handleMicroIjaChoice(true)}
            className="ak-nurture-pill"
            style={{
              position: 'absolute',
              top: 10,
              border: '2px solid var(--ak-accent)',
              cursor: 'pointer',
              zIndex: 8,
            }}
          >
            💬 ¡Tocá a AuriKat para mostrarle!
          </button>
        )}

        <ProceduralCreatureRig
          inputs={{
            ...creatureInputs,
            lookX: rigLookX,
            lookY: rigLookY,
            emotion: rigEmotion,
            action: rigAction,
          }}
          size={195}
          onTap={current?.blockType === 'micro_ija' ? () => handleMicroIjaChoice(true) : undefined}
        />

        {/* Giant Animated Compass Arrow Cue (Non-Social Control Condition) */}
        {phase === 'play' && current?.blockType === 'arrow_cue' && cueState !== 'fixation' && (
          <div
            aria-hidden="true"
            style={{
              padding: '8px 22px',
              borderRadius: 999,
              background: 'var(--ak-accent)',
              color: '#F7F9F5',
              fontWeight: 900,
              fontSize: '1.45rem',
              boxShadow: 'var(--ak-shadow-soft)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>🧭</span>
            <span>{current.targetSide === 'left' ? '↙' : current.targetSide === 'right' ? '↘' : '↓'}</span>
          </div>
        )}
      </div>

      {/* 3 Treasure Chests with Animated Hinged Lid + GuidingHandOverlay in Demo/Practice */}
      {current?.blockType !== 'micro_ija' ? (
        <div
          style={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(92px, 165px))',
            gap: 18,
            justifyContent: 'center',
            width: '100%',
            maxWidth: 580,
          }}
        >
          {(phase === 'demo' && demoStep >= 1) ||
          (phase === 'play' && current?.isPractice && cueState === 'ready') ? (
            <GuidingHandOverlay
              mode="tap"
              toX={SIDE_TO_HAND_X[rayTargetSide]}
              toY="52%"
              label="Tocá el cofre"
            />
          ) : null}

          {(['left', 'center', 'right'] as Side[]).map((side) => {
            const isDemoTarget = phase === 'demo' && demoStep === 2 && side === 'right';
            const isPracticeTarget = phase === 'play' && current?.isPractice && cueState === 'ready' && current.targetSide === side;
            const isOpened = (revealedSide === side) || isDemoTarget;
            const hasStar =
              (revealedSide === side && current?.targetSide === side) || isDemoTarget;

            return (
              <button
                key={side}
                type="button"
                className={`ak-primary-target ${isPracticeTarget ? 'ak-practice-glow' : ''}`}
                style={{
                  minHeight: 108,
                  background: isOpened ? 'var(--ak-accent-soft)' : 'var(--ak-surface-raised)',
                  transform: isDemoTarget ? 'scale(1.06)' : undefined,
                }}
                onClick={() => handleBoxTap(side)}
                aria-label={`Cofre ${side}`}
              >
                <svg width="62" height="62" viewBox="0 0 60 60" aria-hidden="true">
                  {/* Chest Base */}
                  <rect x="8" y="26" width="44" height="24" rx="6" fill="#B58E65" stroke="#4A3C31" strokeWidth="2.8" />
                  <rect x="8" y="34" width="44" height="4" fill="#8C6D4E" />
                  {/* Hinged Chest Lid */}
                  <g
                    transform={isOpened ? 'translate(0, -10) rotate(-18 10 26)' : 'translate(0, 0)'}
                    style={{ transition: 'transform 240ms ease' }}
                  >
                    <path d="M8 26 Q30 12 52 26 Z" fill="#CFA97E" stroke="#4A3C31" strokeWidth="2.8" />
                    <rect x="26" y="22" width="8" height="8" rx="2" fill="var(--ak-au-gold)" stroke="#4A3C31" strokeWidth="2" />
                  </g>
                  {/* Popping Golden Star */}
                  {hasStar ? (
                    <polygon
                      points="30,3 34,13 45,14 37,21 39,31 30,25 21,31 23,21 15,14 26,13"
                      fill="var(--ak-au-gold)"
                      stroke="#4A3C31"
                      strokeWidth="1.8"
                    />
                  ) : null}
                </svg>
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
};
