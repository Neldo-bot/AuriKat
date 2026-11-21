import React, { useEffect, useRef, useState } from 'react';
import {
  buildStrokeRecord,
  encodeSensoryBitmask,
  extractPointerSamples,
  generateUuidV4,
  gentleSoundEngine,
  type CreatureViewModelInputs,
  type PointerSample,
  type SensoryCalmSettings,
  type StrokeRecord,
  type TrialRecord,
} from '@aurikat/core-engine';
import { ProceduralCreatureRig } from '../components/ProceduralCreatureRig.js';

interface SocialGeoMotorGameProps {
  creatureInputs: CreatureViewModelInputs;
  sensorySettings: SensoryCalmSettings;
  onSamplesObserved: (samples: PointerSample[], coalescedSupported: boolean) => void;
  onComplete: (result: {
    trials: TrialRecord[];
    strokes: StrokeRecord[];
    rhythmicTapIntervalsMs: number[];
  }) => void;
}

interface GuideTrailSpec {
  shape: StrokeRecord['guideShape'];
  start: { x: number; y: number };
  target: { x: number; y: number };
  pathD: string;
}

const GUIDE_TRAILS: GuideTrailSpec[] = [
  { shape: 'line_h', start: { x: 80, y: 150 }, target: { x: 460, y: 150 }, pathD: 'M 80 150 L 460 150' },
  { shape: 'line_h', start: { x: 460, y: 150 }, target: { x: 80, y: 150 }, pathD: 'M 460 150 L 80 150' },
  { shape: 'arc_up', start: { x: 80, y: 185 }, target: { x: 460, y: 185 }, pathD: 'M 80 185 Q 270 55 460 185' },
  { shape: 'arc_down', start: { x: 80, y: 115 }, target: { x: 460, y: 115 }, pathD: 'M 80 115 Q 270 245 460 115' },
  { shape: 'line_diag', start: { x: 85, y: 220 }, target: { x: 455, y: 80 }, pathD: 'M 85 220 L 455 80' },
  { shape: 'line_diag', start: { x: 85, y: 80 }, target: { x: 455, y: 220 }, pathD: 'M 85 80 L 455 220' },
  { shape: 'arc_up', start: { x: 460, y: 185 }, target: { x: 80, y: 185 }, pathD: 'M 460 185 Q 270 55 80 185' },
  { shape: 'line_h', start: { x: 80, y: 150 }, target: { x: 460, y: 150 }, pathD: 'M 80 150 L 460 150' },
];

const CANVAS_W = 540;
const CANVAS_H = 300;

/**
 * Game 4: «Jardín de Burbujas y Estrellas» (CLIN-06 + CLIN-07 + IC-1 + IC-2)
 * - Phase A: Strictly iso-salient Social vs. Geometric exploratory choice with midpoint L<->R swap
 * - Phase B: 8 guided 2D drag trails with coalesced pointer capture, finger-lift tolerance & Savitzky-Golay kinematics
 */
export const SocialGeoMotorGame: React.FC<SocialGeoMotorGameProps> = ({
  creatureInputs,
  sensorySettings,
  onSamplesObserved,
  onComplete,
}) => {
  const [stage, setStage] = useState<'phase_a' | 'phase_b'>('phase_a');
  const [phaseACount, setPhaseACount] = useState(0);
  const [pulseSide, setPulseSide] = useState<'social' | 'geometric' | null>(null);

  // Phase B drag state
  const [trailIdx, setTrailIdx] = useState(0);
  const [activePts, setActivePts] = useState<{ x: number; y: number }[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  const trialsRef = useRef<TrialRecord[]>([]);
  const strokesRef = useRef<StrokeRecord[]>([]);
  const samplesBufferRef = useRef<PointerSample[]>([]);
  const touchLiftsRef = useRef<number>(0);
  const trialShownAtRef = useRef<number>(performance.now());
  const firstDownAtRef = useRef<number | null>(null);
  const lastTapAtRef = useRef<number | null>(null);
  const rhythmicIntervalsRef = useRef<number[]>([]);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Midpoint Left <-> Right swap after 6 taps in Phase A (total 12 iso-salient interactions)
  const PHASE_A_TARGET_TAPS = 12;
  const swapped = phaseACount >= PHASE_A_TARGET_TAPS / 2;

  useEffect(() => {
    trialShownAtRef.current = performance.now();
    firstDownAtRef.current = null;
    touchLiftsRef.current = 0;
    samplesBufferRef.current = [];
    setActivePts([]);
  }, [stage, trailIdx]);

  const handlePhaseATap = (channel: 'social' | 'geometric', side: 'left' | 'right') => {
    const now = performance.now();
    if (lastTapAtRef.current !== null) {
      rhythmicIntervalsRef.current.push(now - lastTapAtRef.current);
    }
    lastTapAtRef.current = now;

    // IC-1 Iso-salience: identical audio cue parameters & identical pulse feedback for both sides!
    gentleSoundEngine.playCue(channel === 'social' ? 'bubble_pop' : 'gear_chime');
    setPulseSide(channel);
    window.setTimeout(() => setPulseSide(null), 180);

    const nextCount = phaseACount + 1;
    trialsRef.current.push({
      trialId: generateUuidV4(),
      gameId: 'G4A_PREF',
      blockType: swapped ? 'geopref_h2' : 'geopref_h1',
      trialIndex: nextCount,
      isPractice: false,
      startedAtMs: trialShownAtRef.current,
      rtMs: Math.max(0, now - trialShownAtRef.current),
      accuracy: null,
      errorCategory: 'none',
      choiceChannel: channel,
      stimulusSide: side,
      sensoryBitmask: encodeSensoryBitmask(sensorySettings),
      interruptedByVisibility: false,
    });
    trialShownAtRef.current = now;
    setPhaseACount(nextCount);

    if (nextCount >= PHASE_A_TARGET_TAPS) {
      window.setTimeout(() => setStage('phase_b'), 380);
    }
  };

  const currentGuide = GUIDE_TRAILS[trailIdx];

  const toCanvasCoords = (ev: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const { samples, coalescedSupported } = extractPointerSamples(ev.nativeEvent, rect);
    const scaleX = CANVAS_W / Math.max(1, rect.width);
    const scaleY = CANVAS_H / Math.max(1, rect.height);
    const scaled: PointerSample[] = samples.map((s) => ({
      ...s,
      x: s.x * scaleX,
      y: s.y * scaleY,
    }));
    onSamplesObserved(scaled, coalescedSupported);
    return scaled;
  };

  const handlePointerDown = (ev: React.PointerEvent<SVGSVGElement>) => {
    ev.currentTarget.setPointerCapture(ev.pointerId);
    const scaled = toCanvasCoords(ev);
    if (!scaled || scaled.length === 0) return;

    if (firstDownAtRef.current === null) {
      firstDownAtRef.current = performance.now();
    }
    setIsDrawing(true);
    samplesBufferRef.current.push(...scaled);
    setActivePts((prev) => [...prev, ...scaled.map((s) => ({ x: s.x, y: s.y }))]);
  };

  const handlePointerMove = (ev: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawing) return;
    const scaled = toCanvasCoords(ev);
    if (!scaled || scaled.length === 0) return;
    samplesBufferRef.current.push(...scaled);
    setActivePts((prev) => [...prev, ...scaled.map((s) => ({ x: s.x, y: s.y }))]);

    // Check if child reached the star target cleanly
    const last = scaled[scaled.length - 1];
    const dist = Math.hypot(last.x - currentGuide.target.x, last.y - currentGuide.target.y);
    if (dist <= 44 && samplesBufferRef.current.length >= 6) {
      finishCurrentStroke();
    }
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    // Pediatric finger-lift tolerance (IC-1 / Anthony 2012): do NOT punish/reset trail if child lifts mid-drag!
    const buf = samplesBufferRef.current;
    if (buf.length >= 4) {
      const last = buf[buf.length - 1];
      const dist = Math.hypot(last.x - currentGuide.target.x, last.y - currentGuide.target.y);
      if (dist <= 62) {
        finishCurrentStroke();
      } else {
        touchLiftsRef.current += 1;
      }
    }
  };

  const finishCurrentStroke = () => {
    setIsDrawing(false);
    const samples = [...samplesBufferRef.current];
    if (samples.length < 3) return;

    const initiationLatencyMs =
      firstDownAtRef.current !== null ? Math.max(0, firstDownAtRef.current - trialShownAtRef.current) : 0;

    const stroke = buildStrokeRecord({
      trialIndex: trailIdx + 1,
      guideShape: currentGuide.shape,
      startPoint: currentGuide.start,
      targetPoint: currentGuide.target,
      canvasWidth: CANVAS_W,
      canvasHeight: CANVAS_H,
      touchLifts: touchLiftsRef.current,
      initiationLatencyMs,
      samples,
    });

    strokesRef.current.push(stroke);
    trialsRef.current.push({
      trialId: generateUuidV4(),
      gameId: 'G4B_MOTOR',
      blockType: currentGuide.shape,
      trialIndex: trailIdx + 1,
      isPractice: false,
      startedAtMs: trialShownAtRef.current,
      rtMs: stroke.metrics.durationMs,
      accuracy: 1,
      errorCategory: 'none',
      sensoryBitmask: encodeSensoryBitmask(sensorySettings),
      interruptedByVisibility: false,
      strokeMetrics: stroke.metrics,
    });

    gentleSoundEngine.playCue('tap_soft');
    if (trailIdx + 1 >= GUIDE_TRAILS.length) {
      gentleSoundEngine.playCue('celebrate_chime');
      onComplete({
        trials: trialsRef.current,
        strokes: strokesRef.current,
        rhythmicTapIntervalsMs: rhythmicIntervalsRef.current,
      });
    } else {
      setTrailIdx((i) => i + 1);
    }
  };

  const renderSocialTile = (side: 'left' | 'right') => (
    <button
      type="button"
      className="ak-primary-target"
      style={{
        minHeight: 200,
        width: '100%',
        background: 'var(--ak-surface-raised)',
        transform: pulseSide === 'social' ? 'scale(0.96)' : undefined,
      }}
      onClick={() => handlePhaseATap('social', side)}
      aria-label="Burbujas con AuriKat"
    >
      <ProceduralCreatureRig
        inputs={{ ...creatureInputs, emotion: 'happy', action: 'wave', motionScale: sensorySettings.motionScale }}
        size={120}
      />
    </button>
  );

  const renderGeoTile = (side: 'left' | 'right') => (
    <button
      type="button"
      className="ak-primary-target"
      style={{
        minHeight: 200,
        width: '100%',
        background: 'var(--ak-surface-raised)',
        transform: pulseSide === 'geometric' ? 'scale(0.96)' : undefined,
      }}
      onClick={() => handlePhaseATap('geometric', side)}
      aria-label="Engranajes geométricos"
    >
      <svg width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
        <g
          transform="translate(60,60)"
          style={{
            transformOrigin: '60px 60px',
            animation: sensorySettings.motionScale > 0 ? 'akFloat 3.6s ease-in-out infinite' : 'none',
          }}
        >
          <circle cx="0" cy="0" r="38" fill="none" stroke="var(--ak-accent)" strokeWidth="8" strokeDasharray="14 10" />
          <polygon points="0,-24 21,12 -21,12" fill="none" stroke="var(--ak-au-gold)" strokeWidth="4" />
          <circle cx="0" cy="0" r="10" fill="var(--ak-accent)" />
        </g>
      </svg>
    </button>
  );

  if (stage === 'phase_a') {
    return (
      <section className="ak-stage-card" aria-label="Jardín de Burbujas — Fase A">
        <div className="ak-progress-dots" aria-hidden="true">
          {Array.from({ length: PHASE_A_TARGET_TAPS }, (_, i) => (
            <span key={i} className="ak-dot" data-state={i < phaseACount ? 'done' : i === phaseACount ? 'current' : 'todo'} />
          ))}
        </div>

        {/* Strictly iso-salient 2-column choice (swaps left <-> right at midpoint) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 20,
            width: '100%',
            maxWidth: 620,
          }}
        >
          {swapped ? renderGeoTile('left') : renderSocialTile('left')}
          {swapped ? renderSocialTile('right') : renderGeoTile('right')}
        </div>
      </section>
    );
  }

  const polylinePts = activePts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <section className="ak-stage-card" aria-label="Jardín de Estrellas — Trazos">
      <div className="ak-progress-dots" aria-hidden="true">
        {GUIDE_TRAILS.map((_, i) => (
          <span key={i} className="ak-dot" data-state={i < trailIdx ? 'done' : i === trailIdx ? 'current' : 'todo'} />
        ))}
      </div>

      <div className="ak-touch-canvas">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
          style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* Dashed guide path */}
          <path
            d={currentGuide.pathD}
            fill="none"
            stroke="var(--ak-accent-soft)"
            strokeWidth="22"
            strokeLinecap="round"
          />
          <path
            d={currentGuide.pathD}
            fill="none"
            stroke="var(--ak-accent)"
            strokeWidth="4"
            strokeDasharray="10 10"
            strokeLinecap="round"
            opacity="0.7"
          />

          {/* Live finger trail */}
          {activePts.length > 1 && (
            <polyline
              points={polylinePts}
              fill="none"
              stroke="var(--ak-au-gold)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Start luminous star */}
          <circle
            cx={currentGuide.start.x}
            cy={currentGuide.start.y}
            r="26"
            fill="var(--ak-au-gold)"
            stroke="#2B3330"
            strokeWidth="2.8"
          />
          <text x={currentGuide.start.x} y={currentGuide.start.y + 8} textAnchor="middle" fontSize="24" fill="#FAF9F5">
            ★
          </text>

          {/* Target companion food bowl */}
          <circle
            cx={currentGuide.target.x}
            cy={currentGuide.target.y}
            r="32"
            fill="var(--ak-accent)"
            stroke="#2B3330"
            strokeWidth="2.8"
          />
          <text x={currentGuide.target.x} y={currentGuide.target.y + 8} textAnchor="middle" fontSize="22" fill="#FAF9F5">
            🥣
          </text>
        </svg>
      </div>
    </section>
  );
};
