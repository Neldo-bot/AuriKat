import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  classifyHoldoverVsImpulsive,
  encodeSensoryBitmask,
  generateUuidV4,
  gentleSoundEngine,
  INTER_TRIAL_HOLDOVER_DEBOUNCE_MS,
  type SensoryCalmSettings,
  type SubAgeBand,
  type TrialErrorCategory,
  type TrialRecord,
} from '@aurikat/core-engine';

interface CognitiveFlexibilityGameProps {
  subAgeBand: SubAgeBand;
  sensorySettings: SensoryCalmSettings;
  onComplete: (trials: TrialRecord[]) => void;
}

type DccsDimension = 'color' | 'shape';
type StimulusColor = 'blue' | 'coral';
type StimulusShape = 'star' | 'circle';

interface DccsTrialSpec {
  blockType: 'practice' | 'pre_switch' | 'post_switch' | 'mixed_switch' | 'mixed_repeat';
  isPractice: boolean;
  rule: DccsDimension;
  color: StimulusColor;
  shape: StimulusShape;
}

// Target boxes are fixed: Left = Blue Star, Right = Coral Circle
// Test stimuli are bivalent conflicting: Blue Circle OR Coral Star!
function buildDccsSequence(subAgeBand: SubAgeBand): DccsTrialSpec[] {
  const mixedCount = subAgeBand === '4_5' ? 24 : 30;
  const practice: DccsTrialSpec[] = [
    { blockType: 'practice', isPractice: true, rule: 'color', color: 'blue', shape: 'star' },
    { blockType: 'practice', isPractice: true, rule: 'color', color: 'coral', shape: 'circle' },
  ];
  const pre: DccsTrialSpec[] = Array.from({ length: 5 }, (_, i) => ({
    blockType: 'pre_switch',
    isPractice: false,
    rule: 'color',
    color: i % 2 === 0 ? 'blue' : 'coral',
    shape: i % 2 === 0 ? 'circle' : 'star',
  }));
  const post: DccsTrialSpec[] = Array.from({ length: 6 }, (_, i) => ({
    blockType: 'post_switch',
    isPractice: false,
    rule: 'shape',
    color: i % 2 === 0 ? 'coral' : 'blue',
    shape: i % 2 === 0 ? 'star' : 'circle',
  }));

  // Controlled 75% dominant (shape) / 25% switch (color) mixed block (NIH Toolbox DCCS structure)
  const mixed: DccsTrialSpec[] = [];
  let prevRule: DccsDimension = 'shape';
  for (let i = 0; i < mixedCount; i++) {
    const rule: DccsDimension = i === 3 || i === 8 || i === 14 || i === 19 || i === 25 ? 'color' : 'shape';
    const isSwitch = rule !== prevRule;
    mixed.push({
      blockType: isSwitch ? 'mixed_switch' : 'mixed_repeat',
      isPractice: false,
      rule,
      color: (i + (isSwitch ? 1 : 0)) % 2 === 0 ? 'blue' : 'coral',
      shape: (i + (isSwitch ? 1 : 0)) % 2 === 0 ? 'circle' : 'star',
    });
    prevRule = rule;
  }

  return [...practice, ...pre, ...post, ...mixed];
}

const COLOR_HEX: Record<StimulusColor, string> = {
  blue: '#5B85A8',
  coral: '#C77A6B',
};

const ShapeGlyph: React.FC<{ shape: StimulusShape; color: StimulusColor; size?: number }> = ({
  shape,
  color,
  size = 54,
}) => (
  <svg width={size} height={size} viewBox="0 0 60 60" aria-hidden="true">
    {shape === 'star' ? (
      <polygon
        points="30,6 37,21 54,23 41,34 45,51 30,42 15,51 19,34 6,23 23,21"
        fill={COLOR_HEX[color]}
        stroke="#2B3330"
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
    ) : (
      <circle
        cx="30"
        cy="30"
        r="21"
        fill={COLOR_HEX[color]}
        stroke="#2B3330"
        strokeWidth="2.8"
      />
    )}
  </svg>
);

/**
 * Game 2: «Las Cajas Cambiantes» (CLIN-04 + IC-1)
 * - NIH Toolbox DCCS staged structure (practice -> 5 pre -> 6 post -> 24/30 mixed)
 * - IC-1 Anti-Contamination: 100% NEUTRAL Gentle Fail State with ZERO corrective hint!
 * - Separates perseverative vs. regressive vs. non-systematic errors accurately.
 */
export const CognitiveFlexibilityGame: React.FC<CognitiveFlexibilityGameProps> = ({
  subAgeBand,
  sensorySettings,
  onComplete,
}) => {
  const sequence = useMemo(() => buildDccsSequence(subAgeBand), [subAgeBand]);
  const [phase, setPhase] = useState<'demo' | 'play' | 'done'>('demo');
  const [demoHighlight, setDemoHighlight] = useState(false);
  const [idx, setIdx] = useState(0);
  const [wobble, setWobble] = useState(false);

  const trialsRef = useRef<TrialRecord[]>([]);
  const shownAtRef = useRef<number>(performance.now());
  const prevEndRef = useRef<number>(0);
  const lastRuleRef = useRef<DccsDimension>('color');
  const correctSinceRuleSwitchRef = useRef<number>(0);
  const interruptedRef = useRef(false);

  useEffect(() => {
    const onVis = () => {
      if (document.hidden) interruptedRef.current = true;
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Magrid+ 2s silent demo
  useEffect(() => {
    if (phase !== 'demo') return;
    setDemoHighlight(false);
    const t1 = window.setTimeout(() => setDemoHighlight(true), 900);
    const t2 = window.setTimeout(() => {
      setPhase('play');
      shownAtRef.current = performance.now();
    }, 2200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [phase]);

  const current = sequence[idx];

  useEffect(() => {
    if (phase !== 'play' || !current) return;
    interruptedRef.current = false;
    if (current.rule !== lastRuleRef.current) {
      correctSinceRuleSwitchRef.current = 0;
      lastRuleRef.current = current.rule;
    }
    shownAtRef.current = performance.now();
  }, [phase, idx, current]);

  const handleBoxSelect = (boxSide: 'left' | 'right') => {
    if (phase !== 'play' || !current) return;
    const now = performance.now();
    if (prevEndRef.current > 0 && now - prevEndRef.current < INTER_TRIAL_HOLDOVER_DEBOUNCE_MS) {
      const cat = classifyHoldoverVsImpulsive(now - prevEndRef.current);
      trialsRef.current.push({
        trialId: generateUuidV4(),
        gameId: 'G2_DCCS',
        blockType: current.blockType,
        trialIndex: idx + 1,
        isPractice: current.isPractice,
        startedAtMs: now,
        rtMs: 0,
        accuracy: 0,
        errorCategory: cat,
        choiceChannel: boxSide,
        sensoryBitmask: encodeSensoryBitmask(sensorySettings),
        interruptedByVisibility: interruptedRef.current,
      });
      return;
    }

    const rtMs = Math.max(0, now - shownAtRef.current);
    // Left box = Blue Star, Right box = Coral Circle
    const expectedSide: 'left' | 'right' =
      current.rule === 'color'
        ? current.color === 'blue'
          ? 'left'
          : 'right'
        : current.shape === 'star'
          ? 'left'
          : 'right';

    const otherRuleSide: 'left' | 'right' =
      current.rule === 'color'
        ? current.shape === 'star'
          ? 'left'
          : 'right'
        : current.color === 'blue'
          ? 'left'
          : 'right';

    const correct = boxSide === expectedSide ? 1 : 0;
    let errorCategory: TrialErrorCategory = 'none';
    if (!correct) {
      if (boxSide === otherRuleSide && !current.isPractice && current.blockType !== 'pre_switch') {
        // Distinguish perseverative (before mastering new rule) vs. regressive (after >= 1 correct under new rule)
        errorCategory = correctSinceRuleSwitchRef.current >= 1 ? 'regressive' : 'perseverative';
      } else {
        errorCategory = 'non_systematic';
      }
    } else {
      correctSinceRuleSwitchRef.current += 1;
    }

    trialsRef.current.push({
      trialId: generateUuidV4(),
      gameId: 'G2_DCCS',
      blockType: current.blockType,
      trialIndex: idx + 1,
      isPractice: current.isPractice,
      startedAtMs: shownAtRef.current,
      rtMs,
      accuracy: correct,
      errorCategory,
      choiceChannel: boxSide,
      sensoryBitmask: encodeSensoryBitmask(sensorySettings),
      interruptedByVisibility: interruptedRef.current,
    });

    // IC-1: Strictly NEUTRAL feedback (no corrective flash on correct box!)
    gentleSoundEngine.playCue(correct ? 'tap_soft' : 'neutral_soft_fail');
    setWobble(true);
    prevEndRef.current = performance.now();

    window.setTimeout(() => {
      setWobble(false);
      if (idx + 1 >= sequence.length) {
        setPhase('done');
        gentleSoundEngine.playCue('celebrate_chime');
        onComplete(trialsRef.current);
      } else {
        setIdx((i) => i + 1);
      }
    }, 260);
  };

  const activeRule: DccsDimension = phase === 'demo' ? 'color' : current?.rule ?? 'color';
  const activeColor: StimulusColor = phase === 'demo' ? 'blue' : current?.color ?? 'blue';
  const activeShape: StimulusShape = phase === 'demo' ? 'circle' : current?.shape ?? 'circle';

  return (
    <section className="ak-stage-card" aria-label="Las Cajas Cambiantes">
      <div className="ak-row" style={{ width: '100%', justifyContent: 'space-between' }}>
        <div className="ak-progress-dots" aria-hidden="true">
          {sequence.filter((_, i) => i % 2 === 0).map((_, k) => (
            <span
              key={k}
              className="ak-dot"
              data-state={k * 2 < idx ? 'done' : Math.abs(k * 2 - idx) <= 1 ? 'current' : 'todo'}
            />
          ))}
        </div>
        <button
          type="button"
          className="ak-icon-btn"
          style={{ minWidth: 48, minHeight: 48 }}
          onClick={() => setPhase('demo')}
          aria-label="Ver demostración"
          title="Ver demo"
        >
          ↻
        </button>
      </div>

      {/* Zero-Text Pictographic Dimension Indicator (Paint Drop = COLOR vs. Outline = SHAPE) */}
      <div
        style={{
          padding: '10px 24px',
          borderRadius: 999,
          background: activeRule === 'color' ? '#E3EEF5' : '#EFE7DC',
          border: '2px solid var(--ak-accent)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 12,
        }}
        aria-label={activeRule === 'color' ? 'Regla color' : 'Regla forma'}
      >
        {activeRule === 'color' ? (
          <svg width="34" height="34" viewBox="0 0 36 36" aria-hidden="true">
            <path d="M18 4 C18 4 8 15 8 22 a10 10 0 0 0 20 0 C28 15 18 4 18 4 Z" fill="#5B85A8" />
            <circle cx="24" cy="24" r="5" fill="#C77A6B" />
          </svg>
        ) : (
          <svg width="34" height="34" viewBox="0 0 36 36" aria-hidden="true">
            <polygon points="12,6 15,13 22,14 16,19 18,26 12,22 6,26 8,19 2,14 9,13" fill="none" stroke="#2B3330" strokeWidth="2.5" />
            <circle cx="26" cy="24" r="7" fill="none" stroke="#2B3330" strokeWidth="2.5" />
          </svg>
        )}
      </div>

      {/* Center Bivalent Toy Card */}
      <div
        className={wobble ? 'ak-neutral-wobble' : undefined}
        style={{
          width: 146,
          height: 146,
          borderRadius: 28,
          background: 'var(--ak-bg)',
          border: '3px solid var(--ak-surface-raised)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'var(--ak-shadow-soft)',
        }}
      >
        <ShapeGlyph shape={activeShape} color={activeColor} size={86} />
      </div>

      {/* 2 Large Sorting Boxes (Left = Blue Star | Right = Coral Circle) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(126px, 210px))',
          gap: 24,
          justifyContent: 'center',
          width: '100%',
        }}
      >
        <button
          type="button"
          className="ak-primary-target"
          style={{
            minHeight: 118,
            background: phase === 'demo' && demoHighlight ? 'var(--ak-accent-soft)' : 'var(--ak-surface-raised)',
            transform: phase === 'demo' && demoHighlight ? 'scale(1.06)' : undefined,
          }}
          onClick={() => handleBoxSelect('left')}
          aria-label="Caja estrella azul"
        >
          <ShapeGlyph shape="star" color="blue" size={64} />
        </button>

        <button
          type="button"
          className="ak-primary-target"
          style={{ minHeight: 118, background: 'var(--ak-surface-raised)' }}
          onClick={() => handleBoxSelect('right')}
          aria-label="Caja círculo coral"
        >
          <ShapeGlyph shape="circle" color="coral" size={64} />
        </button>
      </div>
    </section>
  );
};
