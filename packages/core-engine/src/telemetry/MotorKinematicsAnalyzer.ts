import type {
  PointerSample,
  StrokeKinematicsMetrics,
  StrokeRecord,
} from '../types/domain.js';

export interface UniformPoint2D {
  x: number; // Normalized by canvas diagonal
  y: number; // Normalized by canvas diagonal
  t: number; // Seconds starting from 0
}

/**
 * Uniform temporal resampling (IC-2) to eliminate sampling-rate bias
 * between 60 Hz iPad PWA/WKWebView and 120-240 Hz Android devices.
 */
export function resampleStrokeUniform(
  samples: PointerSample[],
  canvasWidth: number,
  canvasHeight: number,
  targetHz = 60,
): UniformPoint2D[] {
  if (samples.length === 0) return [];
  const diag = Math.max(1, Math.hypot(canvasWidth, canvasHeight));
  // Ensure monotonic timestamps and drop duplicates
  const sorted = [...samples].sort((a, b) => a.t - b.t);
  const clean: PointerSample[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].t > clean[clean.length - 1].t + 0.05) {
      clean.push(sorted[i]);
    }
  }
  if (clean.length === 1) {
    return [{ x: clean[0].x / diag, y: clean[0].y / diag, t: 0 }];
  }

  const t0 = clean[0].t;
  const totalMs = clean[clean.length - 1].t - t0;
  const dtMs = 1000 / targetHz;
  const steps = Math.max(2, Math.floor(totalMs / dtMs) + 1);
  const resampled: UniformPoint2D[] = [];

  let seg = 0;
  for (let k = 0; k < steps; k++) {
    const targetT = t0 + Math.min(totalMs, k * dtMs);
    while (seg < clean.length - 2 && clean[seg + 1].t < targetT) {
      seg++;
    }
    const p0 = clean[seg];
    const p1 = clean[seg + 1];
    const span = Math.max(1e-6, p1.t - p0.t);
    const alpha = Math.max(0, Math.min(1, (targetT - p0.t) / span));
    resampled.push({
      x: (p0.x + alpha * (p1.x - p0.x)) / diag,
      y: (p0.y + alpha * (p1.y - p0.y)) / diag,
      t: (targetT - t0) / 1000,
    });
  }
  return resampled;
}

/**
 * 5-point quadratic/cubic Savitzky-Golay smoothing filter [-3, 12, 17, 12, -3] / 35
 * Applied prior to numerical differentiation (IC-2).
 */
export function applySavitzkyGolay2D(points: UniformPoint2D[]): UniformPoint2D[] {
  const n = points.length;
  if (n < 5) return points.map((p) => ({ ...p }));
  const weights = [-3, 12, 17, 12, -3];
  const norm = 35;

  return points.map((pt, i) => {
    if (i < 2 || i > n - 3) {
      return { ...pt };
    }
    let sx = 0;
    let sy = 0;
    for (let k = -2; k <= 2; k++) {
      sx += points[i + k].x * weights[k + 2];
      sy += points[i + k].y * weights[k + 2];
    }
    return { x: sx / norm, y: sy / norm, t: pt.t };
  });
}

/**
 * Exact 2D Convex Hull area via Andrew's Monotone Chain (input for Butera 2025 Gesture Area Variance).
 */
export function computeConvexHullArea(points: { x: number; y: number }[]): number {
  if (points.length < 3) return 0;
  const pts = [...points].sort((a, b) => (a.x !== b.x ? a.x - b.x : a.y - b.y));
  const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: { x: number; y: number }[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: { x: number; y: number }[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
  if (hull.length < 3) return 0;

  let area2 = 0;
  for (let i = 0; i < hull.length; i++) {
    const j = (i + 1) % hull.length;
    area2 += hull[i].x * hull[j].y - hull[j].x * hull[i].y;
  }
  return Math.abs(area2) * 0.5;
}

/**
 * Torres et al. (PMC7563544) Micro-Movement Spikes (MMS) Gamma distribution fit (Method of Moments).
 * Computes shape k and scale theta (Noise-to-Signal Ratio = variance / mean).
 */
export function computeTorresGammaParams(speedSeries: number[]): { k: number; nsr: number } {
  const valid = speedSeries.filter((v) => Number.isFinite(v) && v > 1e-5);
  if (valid.length < 4) return { k: 1, nsr: 0 };

  // Extract local velocity peaks normalized by mean of peak + surrounding minima
  const spikes: number[] = [];
  for (let i = 1; i < valid.length - 1; i++) {
    if (valid[i] > valid[i - 1] && valid[i] >= valid[i + 1]) {
      const localAvg = (valid[i - 1] + valid[i] + valid[i + 1]) / 3;
      const mms = valid[i] / (valid[i] + localAvg + 1e-6);
      spikes.push(mms);
    }
  }
  const data = spikes.length >= 3 ? spikes : valid;
  const mean = data.reduce((s, v) => s + v, 0) / data.length;
  const variance = data.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, data.length - 1);
  if (mean <= 1e-8 || variance <= 1e-10) {
    return { k: 10, nsr: 0.001 };
  }
  const nsr = variance / mean; // Gamma scale parameter theta
  const k = (mean * mean) / variance; // Gamma shape parameter k
  return {
    k: Number(Math.min(100, Math.max(0.1, k)).toFixed(4)),
    nsr: Number(Math.min(10, Math.max(0.0001, nsr)).toFixed(5)),
  };
}

/**
 * Pure 2D Kinematic Analyzer (IC-2) computing all 16 verified metrics for a single stroke.
 */
export function analyzeStrokeKinematics(
  samples: PointerSample[],
  canvasWidth: number,
  canvasHeight: number,
  targetPoint: { x: number; y: number },
  targetHz = 60,
): StrokeKinematicsMetrics {
  const diag = Math.max(1, Math.hypot(canvasWidth, canvasHeight));
  const uniform = resampleStrokeUniform(samples, canvasWidth, canvasHeight, targetHz);
  const smooth = applySavitzkyGolay2D(uniform);

  if (smooth.length < 3) {
    return {
      sampleCountRaw: samples.length,
      sampleCountResampled: smooth.length,
      durationMs: 0,
      pathLengthNorm: 0,
      directness: 1,
      convexHullAreaNorm: 0,
      velMeanNorm: 0,
      velPeakNorm: 0,
      timeToPeakVelRatio: 0.5,
      submovementCount: 0,
      accelMeanNorm: 0,
      accelSdNorm: 0,
      accelMinNorm: 0,
      normalizedJerk: 0,
      meanCurvature: 0,
      angularDirectionChanges: 0,
      pauseCount: 0,
      pauseDurationMs: 0,
      endpointErrorNorm: 1,
      gammaShapeK: 1,
      gammaScaleNsr: 0,
    };
  }

  const durationS = Math.max(1e-4, smooth[smooth.length - 1].t - smooth[0].t);
  let pathLen = 0;
  const vx: number[] = [];
  const vy: number[] = [];
  const speed: number[] = [];
  const angles: number[] = [];

  for (let i = 1; i < smooth.length; i++) {
    const dx = smooth[i].x - smooth[i - 1].x;
    const dy = smooth[i].y - smooth[i - 1].y;
    const dt = Math.max(1e-4, smooth[i].t - smooth[i - 1].t);
    const ds = Math.hypot(dx, dy);
    pathLen += ds;
    vx.push(dx / dt);
    vy.push(dy / dt);
    speed.push(ds / dt);
    if (ds > 1e-4) {
      angles.push(Math.atan2(dy, dx));
    }
  }

  const euclid = Math.hypot(
    smooth[smooth.length - 1].x - smooth[0].x,
    smooth[smooth.length - 1].y - smooth[0].y,
  );
  const directness = pathLen > 1e-6 ? Math.min(1, euclid / pathLen) : 1;
  const convexHullAreaNorm = computeConvexHullArea(smooth);

  // Velocity stats & submovements
  const velMean = speed.reduce((s, v) => s + v, 0) / Math.max(1, speed.length);
  let velPeak = 0;
  let peakIdx = 0;
  for (let i = 0; i < speed.length; i++) {
    if (speed[i] > velPeak) {
      velPeak = speed[i];
      peakIdx = i;
    }
  }
  const timeToPeakVelRatio = speed.length > 1 ? peakIdx / (speed.length - 1) : 0.5;
  const peakProminence = Math.max(0.05, velPeak * 0.15);
  let submovementCount = 0;
  for (let i = 1; i < speed.length - 1; i++) {
    if (speed[i] > speed[i - 1] && speed[i] >= speed[i + 1] && speed[i] >= peakProminence) {
      submovementCount++;
    }
  }

  // Acceleration (scalar tangential + vector magnitude)
  const ax: number[] = [];
  const ay: number[] = [];
  const aTangential: number[] = [];
  const dtStep = durationS / Math.max(1, smooth.length - 1);
  for (let i = 1; i < vx.length; i++) {
    const dvx = (vx[i] - vx[i - 1]) / dtStep;
    const dvy = (vy[i] - vy[i - 1]) / dtStep;
    ax.push(dvx);
    ay.push(dvy);
    aTangential.push((speed[i] - speed[i - 1]) / dtStep);
  }
  const accelMag = ax.map((val, i) => Math.hypot(val, ay[i]));
  const accelMean = accelMag.reduce((s, v) => s + v, 0) / Math.max(1, accelMag.length);
  const accelVar =
    accelMag.reduce((s, v) => s + (v - accelMean) ** 2, 0) / Math.max(1, accelMag.length - 1);
  const accelSd = Math.sqrt(accelVar);
  const accelMin = aTangential.length > 0 ? Math.min(...aTangential) : 0;

  // Normalized dimensionless jerk: sqrt(0.5 * (T^5 / L^2) * integral(||j||^2 dt))
  let jerkSqIntegral = 0;
  for (let i = 1; i < ax.length; i++) {
    const jx = (ax[i] - ax[i - 1]) / dtStep;
    const jy = (ay[i] - ay[i - 1]) / dtStep;
    jerkSqIntegral += (jx * jx + jy * jy) * dtStep;
  }
  const normalizedJerk =
    pathLen > 1e-4
      ? Math.sqrt(0.5 * (Math.pow(durationS, 5) / (pathLen * pathLen)) * jerkSqIntegral)
      : 0;

  // Curvature & angular direction changes (> 15 deg = 0.2618 rad)
  let angularChanges = 0;
  let curvatureSum = 0;
  let curvatureCount = 0;
  for (let i = 1; i < angles.length; i++) {
    let dTheta = Math.abs(angles[i] - angles[i - 1]);
    if (dTheta > Math.PI) dTheta = 2 * Math.PI - dTheta;
    if (dTheta > (15 * Math.PI) / 180) {
      angularChanges++;
    }
    curvatureSum += dTheta;
    curvatureCount++;
  }
  const meanCurvature = curvatureCount > 0 ? curvatureSum / curvatureCount : 0;

  // Intra-stroke pauses (speed < 8% of mean or < 0.04 diag/s)
  const pauseThresh = Math.max(0.04, velMean * 0.12);
  let pauseCount = 0;
  let pauseSamples = 0;
  let inPause = false;
  for (let i = 1; i < speed.length - 1; i++) {
    if (speed[i] < pauseThresh) {
      pauseSamples++;
      if (!inPause) {
        inPause = true;
        pauseCount++;
      }
    } else {
      inPause = false;
    }
  }
  const pauseDurationMs = pauseSamples * dtStep * 1000;

  // Endpoint error normalized
  const last = smooth[smooth.length - 1];
  const endpointErrorNorm = Math.hypot(last.x - targetPoint.x / diag, last.y - targetPoint.y / diag);

  // Torres Gamma MMS
  const gamma = computeTorresGammaParams(speed);

  return {
    sampleCountRaw: samples.length,
    sampleCountResampled: smooth.length,
    durationMs: Number((durationS * 1000).toFixed(2)),
    pathLengthNorm: Number(pathLen.toFixed(4)),
    directness: Number(directness.toFixed(4)),
    convexHullAreaNorm: Number(convexHullAreaNorm.toFixed(6)),
    velMeanNorm: Number(velMean.toFixed(4)),
    velPeakNorm: Number(velPeak.toFixed(4)),
    timeToPeakVelRatio: Number(timeToPeakVelRatio.toFixed(4)),
    submovementCount,
    accelMeanNorm: Number(accelMean.toFixed(4)),
    accelSdNorm: Number(accelSd.toFixed(4)),
    accelMinNorm: Number(accelMin.toFixed(4)),
    normalizedJerk: Number(Math.min(5000, normalizedJerk).toFixed(2)),
    meanCurvature: Number(meanCurvature.toFixed(4)),
    angularDirectionChanges: angularChanges,
    pauseCount,
    pauseDurationMs: Number(pauseDurationMs.toFixed(1)),
    endpointErrorNorm: Number(endpointErrorNorm.toFixed(4)),
    gammaShapeK: gamma.k,
    gammaScaleNsr: gamma.nsr,
  };
}

export interface SessionMotorAggregate {
  strokeCount: number;
  meanDirectness: number;
  gestureDirectnessVariance: number; // Butera 2025 #1
  gestureAreaVariance: number; // Butera 2025 #2
  minGestureAccelerationMean: number; // Butera 2025 #3
  meanNormalizedJerk: number;
  meanVelNorm: number;
  meanSubmovements: number;
  meanGammaNsr: number;
  totalTouchLifts: number;
  rhythmicTappingDetected: boolean;
  rhythmicTapCv: number | null;
}

function sampleVariance(vals: number[]): number {
  if (vals.length < 2) return 0;
  const m = vals.reduce((s, v) => s + v, 0) / vals.length;
  return vals.reduce((s, v) => s + (v - m) ** 2, 0) / (vals.length - 1);
}

/**
 * Aggregates cross-stroke biomarkers (including the 3 Butera 2025 touch-only cerebellar metrics)
 * and computes rhythmic tapping coefficient of variation (CV_ITI < 0.15).
 */
export function aggregateSessionMotorMetrics(
  strokes: StrokeRecord[],
  rhythmicTapInterIntervalsMs: number[],
): SessionMotorAggregate {
  const n = strokes.length;
  const mean = (arr: number[]) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);

  let rhythmicTapCv: number | null = null;
  let rhythmicTappingDetected = false;
  const validIntervals = rhythmicTapInterIntervalsMs.filter((ms) => ms >= 120 && ms <= 1500);
  if (validIntervals.length >= 4) {
    const m = mean(validIntervals);
    const sd = Math.sqrt(sampleVariance(validIntervals));
    if (m > 0) {
      rhythmicTapCv = Number((sd / m).toFixed(4));
      rhythmicTappingDetected = rhythmicTapCv < 0.15;
    }
  }

  if (n === 0) {
    return {
      strokeCount: 0,
      meanDirectness: 0,
      gestureDirectnessVariance: 0,
      gestureAreaVariance: 0,
      minGestureAccelerationMean: 0,
      meanNormalizedJerk: 0,
      meanVelNorm: 0,
      meanSubmovements: 0,
      meanGammaNsr: 0,
      totalTouchLifts: 0,
      rhythmicTappingDetected,
      rhythmicTapCv,
    };
  }

  const directnessVals = strokes.map((s) => s.metrics.directness);
  const areaVals = strokes.map((s) => s.metrics.convexHullAreaNorm);
  const minAccelVals = strokes.map((s) => s.metrics.accelMinNorm);
  const jerkVals = strokes.map((s) => s.metrics.normalizedJerk);
  const velVals = strokes.map((s) => s.metrics.velMeanNorm);
  const subVals = strokes.map((s) => s.metrics.submovementCount);
  const nsrVals = strokes.map((s) => s.metrics.gammaScaleNsr);

  return {
    strokeCount: n,
    meanDirectness: Number(mean(directnessVals).toFixed(4)),
    gestureDirectnessVariance: Number(sampleVariance(directnessVals).toFixed(6)),
    gestureAreaVariance: Number(sampleVariance(areaVals).toFixed(8)),
    minGestureAccelerationMean: Number(mean(minAccelVals).toFixed(4)),
    meanNormalizedJerk: Number(mean(jerkVals).toFixed(2)),
    meanVelNorm: Number(mean(velVals).toFixed(4)),
    meanSubmovements: Number(mean(subVals).toFixed(2)),
    meanGammaNsr: Number(mean(nsrVals).toFixed(5)),
    totalTouchLifts: strokes.reduce((s, st) => s + st.touchLifts, 0),
    rhythmicTappingDetected,
    rhythmicTapCv,
  };
}
