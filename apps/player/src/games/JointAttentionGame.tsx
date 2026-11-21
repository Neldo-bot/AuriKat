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
  type SubAgeBand,
  type TrialRecord,
} from '@aurikat/core-engine';
import { ProceduralCreatureRig } from '../components/ProceduralCreatureRig.js';

interface JointAttentionGameProps {
  creatureInputs: CreatureViewModelInputs;
  subAgeBand: SubAgeBand;
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

function buildJaSequence(subAgeBand: SubAgeBand): JaTrialSpec[] {
  const sides: Side[] = ['left', 'right', 'center', 'right', 'left', 'center'];
  const practice: JaTrialSpec[] = [
    { blockType: 'practice', isPractice: true, targetSide: 'left', usePointing: true },
    { blockType: 'practice', isPractice: true, targetSide: 'right', usePointing: subAgeBand === '4_5' },
  ];
  const social: JaTrialSpec[] = sides.map((side, i) => ({
    blockType: 'social_cue',
    isPractice: false,
    targetSide: side,
    usePointing: subAgeBand === '4_5' && i < 3,
  }));
  const arrow: JaTrialSpec[] = (['right', 'center', 'left', 'center', 'right', 'left'] as Side[]).map((side) => ({
    blockType: 'arrow_cue',
    isPractice: false,
    targetSide: side,
    usePointing: false,
  }));
  const contingency: JaTrialSpec[] = [
    { blockType: 'contingency', isPractice: false, targetSide: 'left', usePointing: false, distractedGaze: false },
    { blockType: 'contingency', isPractice: false, targetSide: 'right', usePointing: false, distractedGaze: true },
    { blockType: 'contingency', isPractice: false, targetSide: 'center', usePointing: false, distractedGaze: false },
    { blockType: 'contingency', isPractice: false, targetSide: 'left', usePointing: false, distractedGaze: true },
  ];
  const microIja: JaTrialSpec[] = [
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

/**
 * Game 1: «¿Qué encontró AuriKat?» (CLIN-03 + IC-1 + IC-4)
 * - Magrid+ 2s silent demo + 2 unscored practice trials + Replay Demo button
 * - Social dynamic gaze+surprise vs. non-social arrow contrast (active SOA 300ms, never early offset)
 * - Congruent vs. incongruent contingency trials + Micro-IJA firefly finale
 * - Pre-cue taps logged silently without advancing trial (350ms holdover debounce)
 */
export const JointAttentionGame: React.FC<JointAttentionGameProps> = ({
  creatureInputs,
  subAgeBand,
  sensorySettings,
  onComplete,
}) => {
  const sequence = useMemo(() => buildJaSequence(subAgeBand), [subAgeBand]);
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

  // Magrid+ 2-second silent animated demo
  useEffect(() => {
    if (phase !== 'demo') return;
    setDemoStep(0);
    const t1 = window.setTimeout(() => setDemoStep(1), 650);
    const t2 = window.setTimeout(() => setDemoStep(2), 1450);
    const t3 = window.setTimeout(() => setPhase('play'), 2400);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [phase]);

  const current = sequence[trialIdx];

  // Controlled fixation (450ms) -> SOA (300ms) -> ready (gaze remains ACTIVE!)
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
    const t1 = window.setTimeout(() => {
      setCueState('cue_soa');
    }, 450);
    const t2 = window.setTimeout(() => {
      setCueState('ready');
      readyAtRef.current = performance.now();
    }, 750); // 450ms fixation + 300ms SOA

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

    // IC-1: Premature taps during fixation/SOA do NOT advance the trial!
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
    window.setTimeout(advanceOrFinish, 680);
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
    window.setTimeout(advanceOrFinish, 850);
  };

  // Compute live Rig ViewModel inputs (IC-4)
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

  return (
    <section className="ak-stage-card" aria-label="¿Qué encontró AuriKat?">
      <div className="ak-row" style={{ width: '100%', justifyContent: 'space-between' }}>
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
          className="ak-icon-btn"
          style={{ minWidth: 48, minHeight: 48 }}
          onClick={() => setPhase('demo')}
          aria-label="Ver demostración de nuevo"
          title="Ver demo"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <polyline points="3 3 3 8 8 8" />
          </svg>
        </button>
      </div>

      {/* Stage Area */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 620,
          minHeight: 240,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
        }}
      >
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
              minWidth: 74,
              minHeight: 74,
              borderRadius: '50%',
              border: '2px solid var(--ak-au-gold)',
              background: 'radial-gradient(circle, #F5E6B8, var(--ak-au-gold))',
              boxShadow: '0 0 20px rgba(197,158,73,0.45)',
              cursor: 'pointer',
              animation: sensorySettings.motionScale > 0 ? 'akFirefly 2.2s ease-in-out infinite' : 'none',
            }}
          >
            ✦
          </button>
        )}

        {/* Distractor butterfly on distracted contingency trials */}
        {phase === 'play' && current?.distractedGaze && cueState !== 'fixation' && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 12,
              left: current.targetSide === 'right' ? 28 : undefined,
              right: current.targetSide === 'left' ? 28 : undefined,
              fontSize: '1.8rem',
              opacity: 0.78,
            }}
          >
            🦋
          </div>
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

        {/* Non-Social Arrow Cue (Control Condition) */}
        {phase === 'play' && current?.blockType === 'arrow_cue' && cueState !== 'fixation' && (
          <div
            aria-hidden="true"
            style={{
              padding: '6px 18px',
              borderRadius: 999,
              background: 'var(--ak-accent-soft)',
              fontWeight: 800,
              fontSize: '1.5rem',
              color: 'var(--ak-accent)',
            }}
          >
            {current.targetSide === 'left' ? '↙' : current.targetSide === 'right' ? '↘' : '↓'}
          </div>
        )}
      </div>

      {/* 3 Large Pediatric Chests (>= 88px touch targets) */}
      {current?.blockType !== 'micro_ija' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(84px, 150px))',
            gap: 16,
            justifyContent: 'center',
            width: '100%',
          }}
        >
          {(['left', 'center', 'right'] as Side[]).map((side) => {
            const isDemoHighlight = phase === 'demo' && demoStep === 2 && side === 'right';
            const showStar =
              (revealedSide === side && current?.targetSide === side) || isDemoHighlight;
            return (
              <button
                key={side}
                type="button"
                className="ak-primary-target"
                style={{
                  minHeight: 96,
                  background: isDemoHighlight ? 'var(--ak-accent-soft)' : 'var(--ak-surface-raised)',
                  transform: isDemoHighlight ? 'scale(1.06)' : undefined,
                }}
                onClick={() => handleBoxTap(side)}
                aria-label={`Cofre ${side}`}
              >
                <svg width="46" height="46" viewBox="0 0 48 48" aria-hidden="true">
                  <rect x="6" y="16" width="36" height="24" rx="7" fill="#B58E65" stroke="#4A3C31" strokeWidth="2.6" />
                  <path d="M6 22 Q24 12 42 22" fill="#CFA97E" stroke="#4A3C31" strokeWidth="2.6" />
                  {showStar ? (
                    <polygon points="24,6 27,13 35,14 29,19 31,27 24,23 17,27 19,19 13,14 21,13" fill="var(--ak-au-gold)" />
                  ) : (
                    <circle cx="24" cy="28" r="4" fill="var(--ak-au-gold)" />
                  )}
                </svg>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="ak-subtle-box" style={{ textAlign: 'center' }}>
          ✦ ¡Mirá qué apareció arriba! Podés tocar a AuriKat o la luciérnaga.
        </div>
      )}
    </section>
  );
};
