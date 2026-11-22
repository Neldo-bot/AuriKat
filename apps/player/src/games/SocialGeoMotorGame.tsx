import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildStrokeRecord,
  encodeSensoryBitmask,
  extractPointerSamples,
  generateUuidV4,
  gentleSoundEngine,
  type CreatureViewModelInputs,
  type PointerSample,
  type SensoryCalmSettings,
  type SessionPacingMode,
  type StrokeRecord,
  type TrialRecord,
} from '@aurikat/core-engine';
import { GuidingHandOverlay } from '../components/GuidingHandOverlay.js';
import { ProceduralCreatureRig } from '../components/ProceduralCreatureRig.js';

interface SocialGeoMotorGameProps {
  creatureInputs: CreatureViewModelInputs;
  pacingMode?: SessionPacingMode;
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

const ALL_GUIDE_TRAILS: GuideTrailSpec[] = [
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
 * Game 4 v2.1: «4. Burbujas y Cometas» (CLIN-06 + CLIN-07 + IC-1 + IC-2)
 * - Phase A: Two living bubble gardens (3 floating social AuriKat bubbles vs. 3 floating geometric mandala bubbles, strictly iso-salient)
 * - Phase B: Guided comet drag trail with GuidingHandOverlay on first trail, sparkling comet tail, and live AuriKat portrait tracking the finger
 */
export const SocialGeoMotorGame: React.FC<SocialGeoMotorGameProps> = ({
  creatureInputs,
  pacingMode = 'clinical_full',
  sensorySettings,
  onSamplesObserved,
  onComplete,
}) => {
  const isQuick = pacingMode === 'quick_demo';
  const phaseATargetTaps = isQuick ? 6 : 12;
  const guideTrails = useMemo(
    () => (isQuick ? ALL_GUIDE_TRAILS.slice(0, 4) : ALL_GUIDE_TRAILS),
    [isQuick],
  );

  const [stage, setStage] = useState<'phase_a' | 'phase_b'>('phase_a');
  const [phaseACount, setPhaseACount] = useState(0);
  const [pulseSide, setPulseSide] = useState<'social' | 'geometric' | null>(null);

  const [trailIdx, setTrailIdx] = useState(0);
  const [activePts, setActivePts] = useState<{ x: number; y: number }[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showDragHint, setShowDragHint] = useState(true);

  const trialsRef = useRef<TrialRecord[]>([]);
  const strokesRef = useRef<StrokeRecord[]>([]);
  const samplesBufferRef = useRef<PointerSample[]>([]);
  const touchLiftsRef = useRef<number>(0);
  const trialShownAtRef = useRef<number>(performance.now());
  const firstDownAtRef = useRef<number | null>(null);
  const lastTapAtRef = useRef<number | null>(null);
  const rhythmicIntervalsRef = useRef<number[]>([]);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const swapped = phaseACount >= phaseATargetTaps / 2;

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

    // IC-1 Iso-salience: identical audio parameters & identical visual pulse
    gentleSoundEngine.playCue(channel === 'social' ? 'bubble_pop' : 'gear_chime');
    setPulseSide(channel);
    window.setTimeout(() => setPulseSide(null), 190);

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

    if (nextCount >= phaseATargetTaps) {
      window.setTimeout(() => setStage('phase_b'), 380);
    }
  };

  const currentGuide = guideTrails[trailIdx];

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
    setShowDragHint(false);
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

    const last = scaled[scaled.length - 1];
    const dist = Math.hypot(last.x - currentGuide.target.x, last.y - currentGuide.target.y);
    if (dist <= 46 && samplesBufferRef.current.length >= 6) {
      finishCurrentStroke();
    }
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const buf = samplesBufferRef.current;
    if (buf.length >= 4) {
      const last = buf[buf.length - 1];
      const dist = Math.hypot(last.x - currentGuide.target.x, last.y - currentGuide.target.y);
      if (dist <= 64) {
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
    if (trailIdx + 1 >= guideTrails.length) {
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

  // Phase A: Iso-salient Social vs. Geometric Bubble Ponds (3 floating bubbles each!)
  const renderSocialBubbleGarden = (side: 'left' | 'right') => (
    <button
      type="button"
      className="ak-primary-target"
      style={{
        minHeight: 220,
        width: '100%',
        background: 'var(--ak-surface-raised)',
        transform: pulseSide === 'social' ? 'scale(0.95)' : undefined,
        position: 'relative',
        overflow: 'hidden',
      }}
      onClick={() => handlePhaseATap('social', side)}
      aria-label="Jardín de burbujas con AuriKat"
    >
      <div className="ak-row" style={{ justifyContent: 'center', gap: 10 }}>
        {(['happy', 'surprised', 'calm'] as const).map((emo, i) => (
          <div
            key={emo}
            style={{
              width: i === 0 ? 96 : 68,
              height: i === 0 ? 96 : 68,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 30% 30%, #FCFDFB, var(--ak-accent-soft))',
              border: '2.5px solid var(--ak-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ProceduralCreatureRig
              inputs={{
                ...creatureInputs,
                emotion: emo,
                action: 'wave',
                motionScale: sensorySettings.motionScale,
              }}
              size={i === 0 ? 78 : 54}
            />
          </div>
        ))}
      </div>
    </button>
  );

  const renderGeoBubbleGarden = (side: 'left' | 'right') => (
    <button
      type="button"
      className="ak-primary-target"
      style={{
        minHeight: 220,
        width: '100%',
        background: 'var(--ak-surface-raised)',
        transform: pulseSide === 'geometric' ? 'scale(0.95)' : undefined,
        position: 'relative',
        overflow: 'hidden',
      }}
      onClick={() => handlePhaseATap('geometric', side)}
      aria-label="Jardín de burbujas geométricas"
    >
      <div className="ak-row" style={{ justifyContent: 'center', gap: 10 }}>
        {[0, 1, 2].map((i) => {
          const sz = i === 0 ? 96 : 68;
          return (
            <div
              key={i}
              style={{
                width: sz,
                height: sz,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 30% 30%, #FCFDFB, var(--ak-accent-soft))',
                border: '2.5px solid var(--ak-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width={sz * 0.78} height={sz * 0.78} viewBox="0 0 100 100" aria-hidden="true">
                <g
                  transform="translate(50,50)"
                  style={{
                    transformOrigin: '50px 50px',
                    animation: sensorySettings.motionScale > 0 ? 'akFloat 3.6s ease-in-out infinite' : 'none',
                  }}
                >
                  <circle cx="0" cy="0" r="34" fill="none" stroke="var(--ak-accent)" strokeWidth="7" strokeDasharray="12 8" />
                  <polygon points="0,-24 21,12 -21,12" fill="none" stroke="var(--ak-au-gold)" strokeWidth="4" />
                  <polygon points="0,24 21,-12 -21,-12" fill="none" stroke="var(--ak-au-gold)" strokeWidth="4" />
                  <circle cx="0" cy="0" r="8" fill="var(--ak-accent)" />
                </g>
              </svg>
            </div>
          );
        })}
      </div>
    </button>
  );

  if (stage === 'phase_a') {
    return (
      <section className="ak-stage-card" aria-label="Jardín de Burbujas — Fase A">
        <div className="ak-game-microheader">
          <span className="ak-phase-pill">🫧 Tocá las burbujas que más te gusten</span>
          <div className="ak-progress-dots" aria-hidden="true">
            {Array.from({ length: phaseATargetTaps }, (_, i) => (
              <span key={i} className="ak-dot" data-state={i < phaseACount ? 'done' : i === phaseACount ? 'current' : 'todo'} />
            ))}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 20,
            width: '100%',
            maxWidth: 640,
          }}
        >
          {swapped ? renderGeoBubbleGarden('left') : renderSocialBubbleGarden('left')}
          {swapped ? renderSocialBubbleGarden('right') : renderGeoBubbleGarden('right')}
        </div>
      </section>
    );
  }

  const lastPt = activePts[activePts.length - 1] ?? currentGuide.start;
  const polylinePts = activePts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const lookNormX = Math.max(-1, Math.min(1, (lastPt.x - CANVAS_W / 2) / (CANVAS_W / 2)));
  const lookNormY = Math.max(-1, Math.min(1, (lastPt.y - CANVAS_H / 2) / (CANVAS_H / 2)));

  return (
    <section className="ak-stage-card" aria-label="Sendero de Cometas — Fase B">
      <div className="ak-game-microheader">
        <span className="ak-phase-pill">☄️ Llevá la estrella-cometa hasta el plato de AuriKat</span>
        <div className="ak-row" style={{ gap: 10 }}>
          <div className="ak-progress-dots" aria-hidden="true">
            {guideTrails.map((_, i) => (
              <span key={i} className="ak-dot" data-state={i < trailIdx ? 'done' : i === trailIdx ? 'current' : 'todo'} />
            ))}
          </div>
          <button
            type="button"
            className="ak-primary-target"
            style={{ minHeight: 46, minWidth: 112, padding: '6px 14px', flexDirection: 'row' }}
            onClick={() => setShowDragHint(true)}
          >
            <span>↻ Ver ejemplo</span>
          </button>
        </div>
      </div>

      {/* Live Companion Tracking the Child's Finger! */}
      <div className="ak-row" style={{ gap: 12 }}>
        <ProceduralCreatureRig
          inputs={{
            ...creatureInputs,
            lookX: lookNormX,
            lookY: lookNormY,
            emotion: isDrawing ? 'surprised' : 'happy',
          }}
          size={92}
        />
      </div>

      <div className="ak-touch-canvas" style={{ position: 'relative' }}>
        {(trailIdx === 0 && showDragHint && !isDrawing) && (
          <GuidingHandOverlay
            mode="drag"
            fromX="20%"
            fromY="50%"
            toX="80%"
            toY="50%"
            label="Arrastrá la estrella ★ → 🥣"
          />
        )}

        <svg
          ref={svgRef}
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
          style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* Pebble Path Guide */}
          <path
            d={currentGuide.pathD}
            fill="none"
            stroke="var(--ak-accent-soft)"
            strokeWidth="28"
            strokeLinecap="round"
          />
          <path
            d={currentGuide.pathD}
            fill="none"
            stroke="var(--ak-accent)"
            strokeWidth="4.5"
            strokeDasharray="10 12"
            strokeLinecap="round"
            opacity="0.72"
          />

          {/* Sparkling Comet Tail */}
          {activePts.length > 1 && (
            <>
              <polyline
                points={polylinePts}
                fill="none"
                stroke="var(--ak-au-gold)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.88"
              />
              {activePts
                .filter((_, i) => i % 4 === 0)
                .slice(-8)
                .map((pt, i) => (
                  <circle key={i} cx={pt.x} cy={pt.y} r={3 + (i % 3)} fill="#FAF0CA" />
                ))}
            </>
          )}

          {/* Target Food Bowl */}
          <circle
            cx={currentGuide.target.x}
            cy={currentGuide.target.y}
            r="34"
            fill="var(--ak-accent)"
            stroke="#2B3330"
            strokeWidth="3"
          />
          <text x={currentGuide.target.x} y={currentGuide.target.y + 9} textAnchor="middle" fontSize="24" fill="#FAF9F5">
            🥣
          </text>

          {/* Draggable Comet Star (moves with finger!) */}
          <g transform={`translate(${lastPt.x.toFixed(1)}, ${lastPt.y.toFixed(1)})`}>
            <circle cx="0" cy="0" r="28" fill="var(--ak-au-gold)" stroke="#2B3330" strokeWidth="3" />
            <text x="0" y="9" textAnchor="middle" fontSize="26" fill="#FAF9F5">
              ★
            </text>
          </g>
        </svg>
      </div>
    </section>
  );
};
