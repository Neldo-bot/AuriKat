import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  classifyHoldoverVsImpulsive,
  encodeSensoryBitmask,
  generateUuidV4,
  gentleSoundEngine,
  INTER_TRIAL_HOLDOVER_DEBOUNCE_MS,
  type SensoryCalmSettings,
  type SessionPacingMode,
  type SubAgeBand,
  type TrialErrorCategory,
  type TrialRecord,
} from '@aurikat/core-engine';
import { GuidingHandOverlay } from '../components/GuidingHandOverlay.js';

interface CognitiveFlexibilityGameProps {
  subAgeBand: SubAgeBand;
  pacingMode?: SessionPacingMode;
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

/**
 * Target sorting boxes are fixed:
 * - Left Box = Blue Star
 * - Right Box = Coral Circle
 * Test cards are bivalent conflicting (Blue Circle OR Coral Star) so Color and Shape always point to opposite boxes!
 */
function buildDccsSequence(subAgeBand: SubAgeBand, pacingMode: SessionPacingMode): DccsTrialSpec[] {
  const isQuick = pacingMode === 'quick_demo';
  const preCount = isQuick ? 3 : 5;
  const postCount = isQuick ? 3 : 6;
  const mixedCount = isQuick ? 8 : subAgeBand === '4_5' ? 24 : 30;

  // 2 guided practice trials: 1 showing COLOR rule + 1 showing SHAPE rule!
  const practice: DccsTrialSpec[] = [
    { blockType: 'practice', isPractice: true, rule: 'color', color: 'blue', shape: 'circle' },
    { blockType: 'practice', isPractice: true, rule: 'shape', color: 'blue', shape: 'circle' },
  ];

  const pre: DccsTrialSpec[] = Array.from({ length: preCount }, (_, i) => ({
    blockType: 'pre_switch',
    isPractice: false,
    rule: 'color',
    color: i % 2 === 0 ? 'blue' : 'coral',
    shape: i % 2 === 0 ? 'circle' : 'star',
  }));

  const post: DccsTrialSpec[] = Array.from({ length: postCount }, (_, i) => ({
    blockType: 'post_switch',
    isPractice: false,
    rule: 'shape',
    color: i % 2 === 0 ? 'coral' : 'blue',
    shape: i % 2 === 0 ? 'star' : 'circle',
  }));

  const mixed: DccsTrialSpec[] = [];
  let prevRule: DccsDimension = 'shape';
  for (let i = 0; i < mixedCount; i++) {
    const switchIndices = isQuick ? [2, 5] : [3, 8, 14, 19, 25];
    const rule: DccsDimension = switchIndices.includes(i) ? 'color' : 'shape';
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
  size = 58,
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
 * Game 2 v2.1: «2. Ordená las Cajas» (CLIN-04 + IC-1)
 * - Unmistakable rotating Rule Signboard (COLOR paint palette vs. FORMA shape cutter)
 * - Flying card animation into mailbox sorting boxes
 * - 2 guided practice trials demonstrating BOTH rules with GuidingHandOverlay
 * - Scored trials preserve 100% neutral Gentle Fail State (zero corrective hint, IC-1)
 */
export const CognitiveFlexibilityGame: React.FC<CognitiveFlexibilityGameProps> = ({
  subAgeBand,
  pacingMode = 'clinical_full',
  sensorySettings,
  onComplete,
}) => {
  const sequence = useMemo(() => buildDccsSequence(subAgeBand, pacingMode), [subAgeBand, pacingMode]);
  const [phase, setPhase] = useState<'demo' | 'play' | 'done'>('demo');
  const [demoStep, setDemoStep] = useState<0 | 1>(0);
  const [idx, setIdx] = useState(0);
  const [flyDir, setFlyDir] = useState<'left' | 'right' | null>(null);
  const [ruleFlipKey, setRuleFlipKey] = useState(0);

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

  // Theatrical 2.4s animated demo showing COLOR -> Left Box, then FORMA -> Right Box
  useEffect(() => {
    if (phase !== 'demo') return;
    setDemoStep(0);
    const t1 = window.setTimeout(() => setDemoStep(1), 1150);
    const t2 = window.setTimeout(() => {
      setPhase('play');
      shownAtRef.current = performance.now();
    }, 2400);
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
      setRuleFlipKey((k) => k + 1);
    }
    shownAtRef.current = performance.now();
  }, [phase, idx, current]);

  const getExpectedSide = (rule: DccsDimension, color: StimulusColor, shape: StimulusShape): 'left' | 'right' => {
    return rule === 'color'
      ? color === 'blue'
        ? 'left'
        : 'right'
      : shape === 'star'
        ? 'left'
        : 'right';
  };

  const handleBoxSelect = (boxSide: 'left' | 'right') => {
    if (phase !== 'play' || !current || flyDir !== null) return;
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
    const expectedSide = getExpectedSide(current.rule, current.color, current.shape);
    const otherRuleSide = getExpectedSide(
      current.rule === 'color' ? 'shape' : 'color',
      current.color,
      current.shape,
    );

    const correct = boxSide === expectedSide ? 1 : 0;
    let errorCategory: TrialErrorCategory = 'none';
    if (!correct) {
      if (boxSide === otherRuleSide && !current.isPractice && current.blockType !== 'pre_switch') {
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

    // IC-1: Strictly NEUTRAL feedback on scored trials (card flies into chosen box either way!)
    gentleSoundEngine.playCue(correct ? 'tap_soft' : 'neutral_soft_fail');
    setFlyDir(boxSide);
    prevEndRef.current = performance.now();

    window.setTimeout(() => {
      setFlyDir(null);
      if (idx + 1 >= sequence.length) {
        setPhase('done');
        gentleSoundEngine.playCue('celebrate_chime');
        onComplete(trialsRef.current);
      } else {
        setIdx((i) => i + 1);
      }
    }, 270);
  };

  const activeRule: DccsDimension =
    phase === 'demo' ? (demoStep === 0 ? 'color' : 'shape') : current?.rule ?? 'color';
  const activeColor: StimulusColor = phase === 'demo' ? 'blue' : current?.color ?? 'blue';
  const activeShape: StimulusShape = phase === 'demo' ? 'circle' : current?.shape ?? 'circle';
  const expectedSideNow = getExpectedSide(activeRule, activeColor, activeShape);
  const showGuidingHand = phase === 'demo' || Boolean(current?.isPractice);

  return (
    <section className="ak-stage-card" aria-label="Ordená las Cajas">
      <div className="ak-game-microheader">
        <span className="ak-phase-pill">
          {phase === 'demo'
            ? '👀 Mirá cómo cambia la regla'
            : current?.isPractice
              ? '✨ Práctica guiada'
              : activeRule === 'color'
                ? '🎨 Guardá por COLOR'
                : '⭐ Guardá por FORMA'}
        </span>

        <div className="ak-row" style={{ gap: 10 }}>
          <div className="ak-progress-dots" aria-hidden="true">
            {sequence.map((_, i) => (
              <span
                key={i}
                className="ak-dot"
                data-state={i < idx ? 'done' : i === idx ? 'current' : 'todo'}
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

      {/* Giant Rotating Rule Signboard (COLOR vs FORMA) */}
      <div
        key={ruleFlipKey}
        className="ak-rule-signboard"
        style={{
          padding: '12px 28px',
          borderRadius: 22,
          background: activeRule === 'color' ? '#E3EEF5' : '#EFE7DC',
          border: '3px solid var(--ak-accent)',
          boxShadow: 'var(--ak-shadow-soft)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        {activeRule === 'color' ? (
          <>
            <svg width="42" height="42" viewBox="0 0 42 42" aria-hidden="true">
              <circle cx="15" cy="21" r="11" fill="#5B85A8" stroke="#2B3330" strokeWidth="2.4" />
              <circle cx="29" cy="21" r="11" fill="#C77A6B" stroke="#2B3330" strokeWidth="2.4" />
            </svg>
            <div style={{ textAlign: 'left' }}>
              <strong style={{ fontSize: '1.15rem', display: 'block' }}>COLOR</strong>
              <span style={{ fontSize: '0.82rem', color: 'var(--ak-ink-muted)' }}>Azul o Coral</span>
            </div>
          </>
        ) : (
          <>
            <svg width="42" height="42" viewBox="0 0 42 42" aria-hidden="true">
              <polygon
                points="14,7 17,15 26,16 19,22 21,31 14,26 7,31 9,22 2,16 11,15"
                fill="none"
                stroke="#2B3330"
                strokeWidth="2.8"
              />
              <circle cx="31" cy="24" r="8" fill="none" stroke="#2B3330" strokeWidth="2.8" />
            </svg>
            <div style={{ textAlign: 'left' }}>
              <strong style={{ fontSize: '1.15rem', display: 'block' }}>FORMA</strong>
              <span style={{ fontSize: '0.82rem', color: 'var(--ak-ink-muted)' }}>Estrella o Círculo</span>
            </div>
          </>
        )}
      </div>

      {/* Center Flying Toy Card */}
      <div
        className={flyDir === 'left' ? 'ak-fly-left' : flyDir === 'right' ? 'ak-fly-right' : undefined}
        style={{
          width: 152,
          height: 152,
          borderRadius: 28,
          background: 'var(--ak-bg)',
          border: '3px solid var(--ak-surface-raised)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          boxShadow: 'var(--ak-shadow-soft)',
        }}
      >
        <ShapeGlyph shape={activeShape} color={activeColor} size={88} />
      </div>

      {/* 2 Mailbox Sorting Boxes (Left = Blue Star | Right = Coral Circle) */}
      <div
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(136px, 225px))',
          gap: 24,
          justifyContent: 'center',
          width: '100%',
          maxWidth: 520,
        }}
      >
        {showGuidingHand && (
          <GuidingHandOverlay
            mode="tap"
            toX={expectedSideNow === 'left' ? '26%' : '74%'}
            toY="54%"
            label={activeRule === 'color' ? 'Mismo COLOR' : 'Misma FORMA'}
          />
        )}

        <button
          type="button"
          className={`ak-primary-target ${showGuidingHand && expectedSideNow === 'left' ? 'ak-practice-glow' : ''}`}
          style={{ minHeight: 132, background: 'var(--ak-surface-raised)' }}
          onClick={() => handleBoxSelect('left')}
          aria-label="Caja estrella azul"
        >
          {/* Mailbox slot */}
          <div style={{ width: '68%', height: 10, borderRadius: 99, background: 'rgba(43,51,48,0.22)' }} />
          <ShapeGlyph shape="star" color="blue" size={66} />
        </button>

        <button
          type="button"
          className={`ak-primary-target ${showGuidingHand && expectedSideNow === 'right' ? 'ak-practice-glow' : ''}`}
          style={{ minHeight: 132, background: 'var(--ak-surface-raised)' }}
          onClick={() => handleBoxSelect('right')}
          aria-label="Caja círculo coral"
        >
          <div style={{ width: '68%', height: 10, borderRadius: 99, background: 'rgba(43,51,48,0.22)' }} />
          <ShapeGlyph shape="circle" color="coral" size={66} />
        </button>
      </div>
    </section>
  );
};
