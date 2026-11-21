import { describe, expect, it } from 'vitest';
import {
  aggregateSessionMotorMetrics,
  analyzeStrokeKinematics,
  applySavitzkyGolay2D,
  buildStrokeRecord,
  classifyHoldoverVsImpulsive,
  computeConvexHullArea,
  detectRealPressureSupport,
  resampleStrokeUniform,
  RiveViewModelAdapterStub,
  type PointerSample,
} from './index.js';

function createLineSamples(jitter = 0, hz = 60, count = 40): PointerSample[] {
  const dt = 1000 / hz;
  return Array.from({ length: count }, (_, i) => {
    const u = i / (count - 1);
    const ease = 10 * u ** 3 - 15 * u ** 4 + 6 * u ** 5;
    return {
      x: 50 + 400 * ease,
      y: 150 + jitter * Math.sin(i * 1.6) * Math.sin(Math.PI * u),
      t: 1000 + i * dt,
      pressure: 0.5,
      width: 22,
      height: 22,
      pointerType: 'touch',
      isCoalesced: true,
    };
  });
}

describe('MotorKinematicsAnalyzer (IC-2)', () => {
  it('computes near-perfect directness and low jerk on a smooth minimum-jerk line', () => {
    const samples = createLineSamples(0, 60, 45);
    const metrics = analyzeStrokeKinematics(samples, 500, 300, { x: 450, y: 150 });
    expect(metrics.directness).toBeGreaterThan(0.98);
    expect(metrics.endpointErrorNorm).toBeLessThan(0.02);
    expect(metrics.convexHullAreaNorm).toBeLessThan(0.001);
    expect(metrics.normalizedJerk).toBeLessThan(80);
  });

  it('distinguishes high-jitter sinuous strokes from smooth strokes across Simeoli/Butera/Torres metrics', () => {
    const smooth = analyzeStrokeKinematics(createLineSamples(0, 60, 45), 500, 300, { x: 450, y: 150 });
    const noisy = analyzeStrokeKinematics(createLineSamples(28, 60, 45), 500, 300, { x: 450, y: 150 });
    expect(noisy.directness).toBeLessThan(smooth.directness);
    expect(noisy.convexHullAreaNorm).toBeGreaterThan(smooth.convexHullAreaNorm);
    expect(noisy.angularDirectionChanges).toBeGreaterThan(smooth.angularDirectionChanges);
    expect(noisy.normalizedJerk).toBeGreaterThan(smooth.normalizedJerk);
  });

  it('normalizes 120 Hz and 60 Hz captures to uniform 60 Hz grid with Savitzky-Golay smoothing', () => {
    const s60 = resampleStrokeUniform(createLineSamples(2, 60, 40), 500, 300, 60);
    const s120 = resampleStrokeUniform(createLineSamples(2, 120, 79), 500, 300, 60);
    expect(Math.abs(s60.length - s120.length)).toBeLessThanOrEqual(2);
    const smoothed = applySavitzkyGolay2D(s120);
    expect(smoothed.length).toBe(s120.length);
  });

  it('computes exact convex hull area for a unit square and detects rhythmic tapping CV < 0.15', () => {
    const area = computeConvexHullArea([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
      { x: 0.5, y: 0.5 },
    ]);
    expect(area).toBeCloseTo(1, 5);

    const st1 = buildStrokeRecord({
      trialIndex: 1,
      guideShape: 'line_h',
      startPoint: { x: 50, y: 150 },
      targetPoint: { x: 450, y: 150 },
      canvasWidth: 500,
      canvasHeight: 300,
      touchLifts: 0,
      initiationLatencyMs: 400,
      samples: createLineSamples(2, 60, 40),
    });
    const st2 = buildStrokeRecord({
      trialIndex: 2,
      guideShape: 'line_h',
      startPoint: { x: 50, y: 150 },
      targetPoint: { x: 450, y: 150 },
      canvasWidth: 500,
      canvasHeight: 300,
      touchLifts: 1,
      initiationLatencyMs: 550,
      samples: createLineSamples(24, 60, 40),
    });
    const agg = aggregateSessionMotorMetrics([st1, st2], [300, 305, 298, 302, 300]);
    expect(agg.gestureDirectnessVariance).toBeGreaterThan(0);
    expect(agg.gestureAreaVariance).toBeGreaterThan(0);
    expect(agg.rhythmicTappingDetected).toBe(true);
    expect(agg.rhythmicTapCv).not.toBeNull();
    expect(agg.rhythmicTapCv!).toBeLessThan(0.15);
  });

  it('detects constant 0.5 finger pressure, classifies holdover debounce and blocks CDN Rive WASM', () => {
    expect(detectRealPressureSupport(createLineSamples(0, 60, 10))).toBe(false);
    expect(classifyHoldoverVsImpulsive(200)).toBe('holdover_debounce');
    expect(classifyHoldoverVsImpulsive(600)).toBe('pre_cue_impulsive');
    expect(
      () =>
        new RiveViewModelAdapterStub({
          localWasmUrl: 'https://unpkg.com/@rive-app/canvas/rive.wasm',
          localRivUrl: '/assets/aurikat.riv',
          shouldDisableRiveListeners: true,
        }),
    ).toThrow(/third-party CDN/i);
  });
});
