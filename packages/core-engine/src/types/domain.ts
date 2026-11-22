/**
 * Pure non-clinical domain primitives shared across the monorepo.
 * Zero diagnostic labels, zero scoring weights, zero external scale names.
 */

export const PROTOCOL_VERSION = '1.0.0-beta' as const;

export type AgeModuleId = 'm1_2_5' | 'm2_4_8' | 'm3_6_11' | 'm4_12_plus';
export type SubAgeBand = '4_5' | '6_8';
export type FormVariant = 'A' | 'B';

export type ArchetypeId =
  | 'cuento_pastel'
  | 'criatura_companera'
  | 'cozy_pixel'
  | 'anime_stylized'; // Reserved Phase 2+ slot (10-14+)

export type SpeciesId = 'aurikat' | 'nube_ajolote' | 'zorro_buho';

export type PaletteId =
  | 'salvia_calma'
  | 'arena_tibia'
  | 'lavanda_suave'
  | 'oceano_sereno'
  | 'atardecer_noche';

export type EmotionId =
  | 'neutral'
  | 'happy'
  | 'calm'
  | 'sad'
  | 'angry'
  | 'scared'
  | 'surprised';

export type CreatureActionId =
  | 'idle'
  | 'wave'
  | 'point_left'
  | 'point_center'
  | 'point_right'
  | 'celebrate_soft'
  | 'breathe'
  | 'look_away';

export type AccessoryId =
  | 'au_charm'
  | 'leaf_hat'
  | 'star_scarf'
  | 'round_glasses'
  | 'cloud_backpack'
  | 'flower_crown';

export type GameId =
  | 'G1_JA'
  | 'G2_DCCS'
  | 'G3_TOM'
  | 'G4A_PREF'
  | 'G4B_MOTOR';

export type TrialErrorCategory =
  | 'none'
  | 'perseverative'
  | 'regressive'
  | 'non_systematic'
  | 'pre_cue_impulsive'
  | 'holdover_debounce'
  | 'timeout';

export type PointerInputType = 'touch' | 'pen' | 'mouse' | 'unknown';
export type TabletPosture = 'flat' | 'handheld' | 'unknown';
export type EmaEntryMode = 'child_solo' | 'caregiver_assisted';
export type SessionPacingMode = 'clinical_full' | 'quick_demo';

export interface CozyPetNeeds {
  belly: number; // 35..100 (safe non-punitive floor >= 35)
  joy: number; // 35..100
  energy: number; // 35..100
  sleeping: boolean;
  lastUpdatedMs: number;
}

export interface SensoryCalmSettings {
  muted: boolean;
  dimLight: boolean;
  motionScale: number; // 0.0 (reduced/static) | 0.5 (calm) | 1.0 (gentle standard)
  volume: number; // 0..1
}

export interface SensoryAdjustmentEvent {
  timestampMs: number;
  setting: keyof SensoryCalmSettings | 'pause_opened';
  previousValue: boolean | number;
  nextValue: boolean | number;
  activeGameId: GameId | 'hub' | 'ema';
}

export interface DeviceTelemetryMeta {
  pointerType: PointerInputType;
  effectiveSamplingHz: number;
  coalescedSupported: boolean;
  pressureSupported: boolean;
  viewportWidthPx: number;
  viewportHeightPx: number;
  viewportDiagMm: number | null;
  devicePixelRatio: number;
  highResTimeOriginIsolated: boolean;
  imuAvailable: boolean;
  tabletFlatOnSurface: TabletPosture;
  prefersReducedMotion: boolean;
}

export interface PointerSample {
  x: number; // CSS px relative to active canvas
  y: number; // CSS px relative to active canvas
  t: number; // DOMHighResTimeStamp in ms
  pressure: number;
  width: number;
  height: number;
  pointerType: PointerInputType;
  isCoalesced: boolean;
}

export interface StrokeRecord {
  strokeId: string;
  trialIndex: number;
  guideShape: 'line_h' | 'line_diag' | 'arc_up' | 'arc_down';
  startPoint: { x: number; y: number };
  targetPoint: { x: number; y: number };
  canvasWidth: number;
  canvasHeight: number;
  touchLifts: number;
  initiationLatencyMs: number;
  samples: PointerSample[];
  metrics: StrokeKinematicsMetrics;
}

/**
 * 16 Pure-2D Kinematic Variables (IC-2: Simeoli 2021-2024 + 3 Butera 2025 + Torres Gamma/NSR).
 */
export interface StrokeKinematicsMetrics {
  sampleCountRaw: number;
  sampleCountResampled: number;
  durationMs: number;
  pathLengthNorm: number;
  directness: number; // 0..1 straightness index
  convexHullAreaNorm: number; // input for Butera Gesture Area Variance
  velMeanNorm: number; // diag / s
  velPeakNorm: number; // diag / s
  timeToPeakVelRatio: number; // 0..1
  submovementCount: number;
  accelMeanNorm: number; // diag / s^2
  accelSdNorm: number; // diag / s^2
  accelMinNorm: number; // Butera Minimum Gesture Acceleration
  normalizedJerk: number; // dimensionless jerk
  meanCurvature: number;
  angularDirectionChanges: number; // count of |dTheta| > 15 deg
  pauseCount: number;
  pauseDurationMs: number;
  endpointErrorNorm: number;
  gammaShapeK: number; // Torres MMS Gamma shape
  gammaScaleNsr: number; // Torres MMS Noise-to-Signal Ratio
}

export interface TrialRecord {
  trialId: string;
  gameId: GameId;
  blockType: string;
  trialIndex: number;
  isPractice: boolean;
  startedAtMs: number;
  rtMs: number;
  accuracy: 0 | 1 | null;
  errorCategory: TrialErrorCategory;
  choiceChannel?: 'social' | 'geometric' | 'left' | 'center' | 'right' | string;
  stimulusSide?: 'left' | 'center' | 'right';
  targetEmotion?: EmotionId;
  chosenEmotion?: EmotionId;
  sensoryBitmask: string;
  interruptedByVisibility: boolean;
  strokeMetrics?: StrokeKinematicsMetrics;
}

export type WeatherMoodId =
  | 'sun_happy'
  | 'breeze_calm'
  | 'cloud_tired_sad'
  | 'mist_worried'
  | 'storm_overwhelmed';

export type HabitId =
  | 'sleep'
  | 'food'
  | 'play_move'
  | 'calm_rest'
  | 'shared_time'
  | 'smooth_change';

export interface EmaEntry {
  entryId: string;
  relativeDayIndex: number; // Safe Harbor: relative day offset instead of exact personal calendar date
  isoDayBucket: string; // YYYY-MM-DD local day bucket (stripped/converted on Safe Harbor export)
  moodId: WeatherMoodId;
  valenceScore: -2 | -1 | 0 | 1 | 2;
  habits: HabitId[];
  entryMode: EmaEntryMode;
  durationMs: number;
  calmBreathUsed: boolean;
}

export interface PlayerCustomization {
  species: SpeciesId;
  archetype: Exclude<ArchetypeId, 'anime_stylized'>;
  paletteId: PaletteId;
  accessory: AccessoryId;
  unlockedAccessories: AccessoryId[];
  unlockedStickers: string[];
  sharedDaysCount: number; // Cumulative nurture counter (never punitive streaks!)
  petNeeds?: CozyPetNeeds;
}

export interface AssentRecord {
  shown: boolean;
  accepted: boolean;
  declinedAtMs?: number;
  acceptedAtMs?: number;
}

export interface RawSessionPayload {
  schemaVersion: '2.0.0';
  protocolVersion: typeof PROTOCOL_VERSION;
  sessionId: string;
  participantPseudoId: string;
  ageMonths: number;
  sexAssigned: 'F' | 'M' | 'X' | 'NA';
  ageModule: AgeModuleId;
  subAgeBand: SubAgeBand;
  formVariant: FormVariant;
  pacingMode?: SessionPacingMode;
  createdAtIsoYear: number;
  exportedAtIso: string;
  assent: AssentRecord;
  deviceMeta: DeviceTelemetryMeta;
  customization: PlayerCustomization;
  sensorySettingsFinal: SensoryCalmSettings;
  sensoryAdjustments: SensoryAdjustmentEvent[];
  trials: TrialRecord[];
  strokes: StrokeRecord[];
  rhythmicTapInterIntervalsMs: number[];
  emaEntries: EmaEntry[];
}
