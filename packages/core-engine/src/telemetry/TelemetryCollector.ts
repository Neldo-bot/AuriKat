import type {
  DeviceTelemetryMeta,
  EmaEntry,
  GameId,
  PointerInputType,
  PointerSample,
  RawSessionPayload,
  SensoryAdjustmentEvent,
  SensoryCalmSettings,
  StrokeRecord,
  SubAgeBand,
  TabletPosture,
  TrialRecord,
} from '../types/domain.js';
import { PROTOCOL_VERSION } from '../types/domain.js';
import { analyzeStrokeKinematics } from './MotorKinematicsAnalyzer.js';

export const INTER_TRIAL_HOLDOVER_DEBOUNCE_MS = 350;

export interface IInertialSensorPort {
  isAvailable(): boolean;
  getTabletPosture(): TabletPosture;
}

/**
 * Extracts coalesced pointer samples with Safari < 18.2 feature-detection fallback (IC-2).
 */
export function extractPointerSamples(
  ev: PointerEvent,
  rect: DOMRect,
): { samples: PointerSample[]; coalescedSupported: boolean } {
  const pointerType: PointerInputType =
    ev.pointerType === 'touch' || ev.pointerType === 'pen' || ev.pointerType === 'mouse'
      ? ev.pointerType
      : 'unknown';

  const hasCoalesced = typeof ev.getCoalescedEvents === 'function';
  const rawList = hasCoalesced ? ev.getCoalescedEvents() : [ev];
  const events = rawList.length > 0 ? rawList : [ev];

  const samples: PointerSample[] = events.map((item) => ({
    x: item.clientX - rect.left,
    y: item.clientY - rect.top,
    t: Number.isFinite(item.timeStamp) && item.timeStamp > 0 ? item.timeStamp : performance.now(),
    pressure: typeof item.pressure === 'number' ? item.pressure : 0.5,
    width: typeof item.width === 'number' ? item.width : 1,
    height: typeof item.height === 'number' ? item.height : 1,
    pointerType,
    isCoalesced: hasCoalesced && events.length > 1,
  }));

  return { samples, coalescedSupported: hasCoalesced };
}

/**
 * Evaluates whether pressure reports genuine variation vs. constant synthetic 0.5 on fingers/mouse (IC-2).
 */
export function detectRealPressureSupport(samples: PointerSample[]): boolean {
  const active = samples.filter((s) => s.pressure > 0);
  if (active.length < 4) return false;
  const first = active[0].pressure;
  return active.some((s) => Math.abs(s.pressure - first) > 0.015);
}

/**
 * Computes effective sampling rate (Hz) from observed pointer timestamps.
 */
export function estimateSamplingHz(samples: PointerSample[]): number {
  if (samples.length < 3) return 60;
  const diffs: number[] = [];
  for (let i = 1; i < samples.length; i++) {
    const dt = samples[i].t - samples[i - 1].t;
    if (dt >= 2 && dt <= 100) diffs.push(dt);
  }
  if (diffs.length === 0) return 60;
  diffs.sort((a, b) => a - b);
  const medianDt = diffs[Math.floor(diffs.length / 2)];
  return Number(Math.min(240, Math.max(15, 1000 / medianDt)).toFixed(1));
}

export function encodeSensoryBitmask(settings: SensoryCalmSettings): string {
  const flags: string[] = [];
  if (settings.muted) flags.push('mute');
  if (settings.dimLight) flags.push('dim');
  if (settings.motionScale <= 0.05) flags.push('reducedMotion');
  else if (settings.motionScale < 0.9) flags.push('calmMotion');
  return flags.length ? flags.join('|') : 'default';
}

export function classifyHoldoverVsImpulsive(
  msSincePreviousTrialEnd: number,
  debounceMs = INTER_TRIAL_HOLDOVER_DEBOUNCE_MS,
): 'holdover_debounce' | 'pre_cue_impulsive' {
  return msSincePreviousTrialEnd <= debounceMs ? 'holdover_debounce' : 'pre_cue_impulsive';
}

export function generateUuidV4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function detectDefaultDeviceMeta(imuPort?: IInertialSensorPort): DeviceTelemetryMeta {
  const hasWindow = typeof window !== 'undefined';
  const w = hasWindow ? window.innerWidth : 1024;
  const h = hasWindow ? window.innerHeight : 768;
  const dpr = hasWindow && typeof window.devicePixelRatio === 'number' ? window.devicePixelRatio : 1;
  // Approximate physical diagonal in mm assuming ~96 CSS px per inch (25.4 mm / 96 px)
  const diagMm = Number(((Math.hypot(w, h) / 96) * 25.4).toFixed(1));
  const reducedMotion =
    hasWindow && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  return {
    pointerType: 'unknown',
    effectiveSamplingHz: 60,
    coalescedSupported:
      hasWindow &&
      typeof PointerEvent !== 'undefined' &&
      typeof PointerEvent.prototype.getCoalescedEvents === 'function',
    pressureSupported: false,
    viewportWidthPx: w,
    viewportHeightPx: h,
    viewportDiagMm: diagMm,
    devicePixelRatio: dpr,
    highResTimeOriginIsolated:
      hasWindow && typeof (window as unknown as { crossOriginIsolated?: boolean }).crossOriginIsolated === 'boolean'
        ? Boolean((window as unknown as { crossOriginIsolated?: boolean }).crossOriginIsolated)
        : false,
    imuAvailable: imuPort ? imuPort.isAvailable() : false,
    tabletFlatOnSurface: imuPort ? imuPort.getTabletPosture() : 'unknown',
    prefersReducedMotion: reducedMotion,
  };
}

export function createInitialSessionPayload(options?: {
  participantPseudoId?: string;
  ageMonths?: number;
  subAgeBand?: SubAgeBand;
  formVariant?: 'A' | 'B';
}): RawSessionPayload {
  const ageMonths = options?.ageMonths ?? 72; // 6 years default (within 4-8y Beta)
  const subAgeBand: SubAgeBand = options?.subAgeBand ?? (ageMonths < 72 ? '4_5' : '6_8');
  const deviceMeta = detectDefaultDeviceMeta();

  return {
    schemaVersion: '2.0.0',
    protocolVersion: PROTOCOL_VERSION,
    sessionId: generateUuidV4(),
    participantPseudoId: options?.participantPseudoId ?? `AK-${generateUuidV4().slice(0, 6).toUpperCase()}`,
    ageMonths,
    sexAssigned: 'NA',
    ageModule: 'm2_4_8',
    subAgeBand,
    formVariant: options?.formVariant ?? 'A',
    createdAtIsoYear: new Date().getFullYear(),
    exportedAtIso: new Date().toISOString(),
    assent: { shown: false, accepted: true },
    deviceMeta,
    customization: {
      species: 'aurikat',
      archetype: 'criatura_companera',
      paletteId: 'salvia_calma',
      accessory: 'au_charm',
      unlockedAccessories: ['au_charm', 'leaf_hat'],
      unlockedStickers: ['st_star'],
      sharedDaysCount: 1,
    },
    sensorySettingsFinal: {
      muted: false,
      dimLight: false,
      motionScale: deviceMeta.prefersReducedMotion ? 0 : 1,
      volume: 0.65,
    },
    sensoryAdjustments: [],
    trials: [],
    strokes: [],
    rhythmicTapInterIntervalsMs: [],
    emaEntries: [],
  };
}

/**
 * Pure helper to build a verified StrokeRecord and update session device metadata.
 */
export function buildStrokeRecord(params: {
  trialIndex: number;
  guideShape: StrokeRecord['guideShape'];
  startPoint: { x: number; y: number };
  targetPoint: { x: number; y: number };
  canvasWidth: number;
  canvasHeight: number;
  touchLifts: number;
  initiationLatencyMs: number;
  samples: PointerSample[];
}): StrokeRecord {
  const metrics = analyzeStrokeKinematics(
    params.samples,
    params.canvasWidth,
    params.canvasHeight,
    params.targetPoint,
  );
  return {
    strokeId: generateUuidV4(),
    trialIndex: params.trialIndex,
    guideShape: params.guideShape,
    startPoint: params.startPoint,
    targetPoint: params.targetPoint,
    canvasWidth: params.canvasWidth,
    canvasHeight: params.canvasHeight,
    touchLifts: params.touchLifts,
    initiationLatencyMs: Number(params.initiationLatencyMs.toFixed(2)),
    samples: params.samples,
    metrics,
  };
}

export function appendTrialToSession(session: RawSessionPayload, trial: TrialRecord): RawSessionPayload {
  return { ...session, trials: [...session.trials, trial] };
}

export function appendSensoryAdjustment(
  session: RawSessionPayload,
  adjustment: SensoryAdjustmentEvent,
  nextSettings: SensoryCalmSettings,
): RawSessionPayload {
  return {
    ...session,
    sensorySettingsFinal: { ...nextSettings },
    sensoryAdjustments: [...session.sensoryAdjustments, adjustment],
  };
}

export function appendEmaEntry(session: RawSessionPayload, entry: EmaEntry): RawSessionPayload {
  return {
    ...session,
    emaEntries: [...session.emaEntries, entry],
  };
}

export function updateDeviceMetaFromSamples(
  meta: DeviceTelemetryMeta,
  samples: PointerSample[],
  coalescedSupported: boolean,
): DeviceTelemetryMeta {
  if (samples.length === 0) return meta;
  const primaryType = samples[0].pointerType;
  const hz = estimateSamplingHz(samples);
  const realPressure = meta.pressureSupported || detectRealPressureSupport(samples);
  return {
    ...meta,
    pointerType: primaryType !== 'unknown' ? primaryType : meta.pointerType,
    effectiveSamplingHz: hz,
    coalescedSupported: meta.coalescedSupported || coalescedSupported,
    pressureSupported: realPressure,
  };
}

export function getActiveGameIds(trials: TrialRecord[]): GameId[] {
  return Array.from(new Set(trials.filter((t) => !t.isPractice).map((t) => t.gameId)));
}
