import {
  aggregateSessionMotorMetrics,
  type EmaEntry,
  type RawSessionPayload,
  type SessionMotorAggregate,
  type TrialRecord,
} from '@aurikat/core-engine';
import { CLINICAL_DOMAINS, type ClinicalDomainId } from './ClinicalProtocolRegistry.js';

export type SessionValidityStatus = 'VALID' | 'VALID_WITH_CAVEATS' | 'INDETERMINATE';

export interface EvidenceTraceItem {
  metricKey: string;
  label: string;
  observedValue: string;
  direction: 'atypical_observation' | 'typical_observation' | 'contextual_note';
  weightNote: string;
}

export interface DomainScoreResult {
  domainId: ClinicalDomainId;
  title: string;
  shortTitle: string;
  observationIndex: number | null; // 0-100 observation intensity (null when INDETERMINATE or insufficient data)
  uncertaintyHalfWidth: number | null; // +/- band based on valid trial count
  validTrialCount: number;
  caveatFlag: string | null;
  evidenceTrace: EvidenceTraceItem[];
}

export interface DccsBreakdown {
  preSwitchAcc: number;
  postSwitchAcc: number;
  mixedAcc: number;
  overallAcc: number;
  accuracyVector: number; // 0-5
  rtVector: number; // 0-5 (computed only if overallAcc >= 0.80)
  twoVectorScore: number; // 0-10 NIH Toolbox DCCS composite
  switchCostMs: number | null;
  perseverativeErrors: number;
  regressiveErrors: number;
  nonSystematicErrors: number;
}

export interface EmaLongitudinalSummary {
  entryCount: number;
  meanValence: number | null;
  mssd: number | null; // Mean Square Successive Difference (affective instability)
  pctCaregiverAssisted: number;
  ageSoloCaveat: boolean;
  calmBreathUses: number;
  habitCompletionRate: number;
}

export interface SensorySocialDayBreakdown {
  totalScoredScenes: number;
  sensoryCalmAvoidingRatio: number | null;
  solitaryOrderPlayRatio: number | null;
  routineSamenessRatio: number | null;
  channelDecisions: Array<{
    channel: string;
    channelLabel: string;
    chosen: string;
    chosenLabel: string;
    rtMs: number;
  }>;
  clinicalSummaryText: string;
}

export interface DetailNavonBreakdown {
  navonTotalChoices: number;
  localPreferenceRatio: number | null;
  detailSearchTotalAttempts: number;
  detailSearchHits: number;
  detailSearchAccuracy: number | null;
  detailSearchMedianRtMs: number | null;
  perceptualStyleLabel: string;
  clinicalSummaryText: string;
}

export interface ClinicalGuideSummary {
  strengths: string[];
  clinicalHypothesesToExplore: string[];
  suggestedExternalScales: string[];
  caregiverInterviewPrompts: string[];
}

export interface ClinicalEvaluationReport {
  protocolVersion: string;
  participantPseudoId: string;
  sessionId: string;
  ageMonths: number;
  subAgeBand: '4_5' | '6_8';
  formVariant: 'A' | 'B';
  validityStatus: SessionValidityStatus;
  validityReasons: string[];
  caveats: string[];
  canShowPartialPreview: boolean;
  domains: DomainScoreResult[];
  partialDomainsPreview: DomainScoreResult[];
  dccsBreakdown: DccsBreakdown;
  sensorySocialBreakdown: SensorySocialDayBreakdown;
  detailNavonBreakdown: DetailNavonBreakdown;
  clinicalGuide: ClinicalGuideSummary;
  motorAggregate: SessionMotorAggregate;
  emaSummary: EmaLongitudinalSummary;
  geoprefExploratoryFlag: {
    geometricRatio: number | null;
    totalInteractions: number;
    highSpecificityAlert: boolean;
    interpretationRule: string;
  };
  generatedAtIso: string;
}

function clamp0_100(v: number): number {
  return Math.round(Math.max(0, Math.min(100, v)));
}

function median(vals: number[]): number | null {
  if (vals.length === 0) return null;
  const s = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function uncertaintyFromTrials(n: number, base = 18): number {
  if (n <= 0) return 25;
  return Math.round(Math.max(5, Math.min(24, base / Math.sqrt(Math.max(1, n / 4)))));
}

/**
 * Computes longitudinal MSSD (Mean Square Successive Difference) and EMA metrics (CLIN-09).
 */
export function computeEmaSummary(entries: EmaEntry[], ageMonths: number): EmaLongitudinalSummary {
  if (entries.length === 0) {
    return {
      entryCount: 0,
      meanValence: null,
      mssd: null,
      pctCaregiverAssisted: 0,
      ageSoloCaveat: false,
      calmBreathUses: 0,
      habitCompletionRate: 0,
    };
  }
  const sorted = [...entries].sort((a, b) => a.relativeDayIndex - b.relativeDayIndex);
  const meanValence = Number(
    (sorted.reduce((s, e) => s + e.valenceScore, 0) / sorted.length).toFixed(2),
  );

  let mssd: number | null = null;
  if (sorted.length >= 2) {
    let sqDiffSum = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      const diff = sorted[i + 1].valenceScore - sorted[i].valenceScore;
      sqDiffSum += diff * diff;
    }
    mssd = Number((sqDiffSum / (sorted.length - 1)).toFixed(3));
  }

  const assistedCount = sorted.filter((e) => e.entryMode === 'caregiver_assisted').length;
  const pctCaregiverAssisted = Math.round((assistedCount / sorted.length) * 100);
  const ageSoloCaveat = ageMonths < 84 && pctCaregiverAssisted < 50; // < 7 years solo EMA reliability caution
  const calmBreathUses = sorted.filter((e) => e.calmBreathUsed).length;
  const habitCompletionRate = Number(
    (sorted.reduce((s, e) => s + e.habits.length / 6, 0) / sorted.length).toFixed(2),
  );

  return {
    entryCount: sorted.length,
    meanValence,
    mssd,
    pctCaregiverAssisted,
    ageSoloCaveat,
    calmBreathUses,
    habitCompletionRate,
  };
}

/**
 * NIH Toolbox DCCS Two-Vector Scoring (Accuracy 0-5 + log10 RT 0-5 when Acc >= 80%) (CLIN-04).
 */
export function computeDccsBreakdown(dccsTrials: TrialRecord[]): DccsBreakdown {
  const scored = dccsTrials.filter((t) => !t.isPractice && t.errorCategory !== 'holdover_debounce');
  const pre = scored.filter((t) => t.blockType === 'pre_switch');
  const post = scored.filter((t) => t.blockType === 'post_switch');
  const mixed = scored.filter((t) => t.blockType === 'mixed_switch' || t.blockType === 'mixed_repeat');

  const acc = (list: TrialRecord[]) =>
    list.length ? list.filter((t) => t.accuracy === 1).length / list.length : 0;

  const preSwitchAcc = Number(acc(pre).toFixed(3));
  const postSwitchAcc = Number(acc(post).toFixed(3));
  const mixedAcc = Number(acc(mixed).toFixed(3));
  const overallAcc = Number(acc(scored).toFixed(3));

  const accuracyVector = Number((overallAcc * 5).toFixed(2));
  let rtVector = 0;
  const switchCorrectRts = scored
    .filter((t) => (t.blockType === 'mixed_switch' || t.blockType === 'post_switch') && t.accuracy === 1)
    .map((t) => Math.max(500, Math.min(3000, t.rtMs)));
  const repeatCorrectRts = scored
    .filter((t) => t.blockType === 'mixed_repeat' && t.accuracy === 1)
    .map((t) => t.rtMs);

  const medSwitchRt = median(switchCorrectRts);
  const medRepeatRt = median(repeatCorrectRts);
  const switchCostMs =
    medSwitchRt !== null && medRepeatRt !== null ? Math.round(medSwitchRt - medRepeatRt) : null;

  if (overallAcc >= 0.8 && medSwitchRt !== null) {
    const logMin = Math.log10(500);
    const logMax = Math.log10(3000);
    const rawRtVec = 5 - 5 * ((Math.log10(medSwitchRt) - logMin) / (logMax - logMin));
    rtVector = Number(Math.max(0, Math.min(5, rawRtVec)).toFixed(2));
  }

  return {
    preSwitchAcc,
    postSwitchAcc,
    mixedAcc,
    overallAcc,
    accuracyVector,
    rtVector,
    twoVectorScore: Number((accuracyVector + rtVector).toFixed(2)),
    switchCostMs,
    perseverativeErrors: scored.filter((t) => t.errorCategory === 'perseverative').length,
    regressiveErrors: scored.filter((t) => t.errorCategory === 'regressive').length,
    nonSystematicErrors: scored.filter((t) => t.errorCategory === 'non_systematic').length,
  };
}

/**
 * Computes Game 4A («El Día de AuriKat» — Sensory Profile 2 + CAST + SRS-2) breakdown.
 */
export function computeSensorySocialBreakdown(trials: TrialRecord[]): SensorySocialDayBreakdown {
  const scored = trials.filter((t) => !t.isPractice && t.gameId === 'G4_SENSORY_SOCIAL');
  if (scored.length === 0) {
    return {
      totalScoredScenes: 0,
      sensoryCalmAvoidingRatio: null,
      solitaryOrderPlayRatio: null,
      routineSamenessRatio: null,
      channelDecisions: [],
      clinicalSummaryText: 'Sin datos registrados en Prototipo 4A (El Día de AuriKat).',
    };
  }

  const sensoryChannels = scored.filter((t) =>
    ['auditory', 'visual', 'tactile', 'movement'].includes(t.blockType),
  );
  const socialChannels = scored.filter((t) => t.blockType === 'social_play');
  const routineChannels = scored.filter((t) => t.blockType === 'routine_change');

  const calmCount = sensoryChannels.filter((t) => t.choiceChannel === 'calm_avoiding').length;
  const solitaryCount = socialChannels.filter((t) => t.choiceChannel === 'solitary_order').length;
  const routineSameCount = routineChannels.filter((t) => t.choiceChannel === 'routine_same').length;

  const sensoryCalmAvoidingRatio =
    sensoryChannels.length > 0 ? Number((calmCount / sensoryChannels.length).toFixed(3)) : null;
  const solitaryOrderPlayRatio =
    socialChannels.length > 0 ? Number((solitaryCount / socialChannels.length).toFixed(3)) : null;
  const routineSamenessRatio =
    routineChannels.length > 0 ? Number((routineSameCount / routineChannels.length).toFixed(3)) : null;

  const channelNames: Record<string, string> = {
    auditory: 'Canal Auditivo (SP-2)',
    visual: 'Canal Visual (SP-2)',
    tactile: 'Canal Táctil / Texturas (SP-2)',
    movement: 'Canal Vestibular / Movimiento (SP-2)',
    social_play: 'Juego Social vs. Orden Solitario (CAST / SRS-2)',
    routine_change: 'Transiciones e Invarianza de Rutina (BRIEF-2 / B.2)',
  };

  const choiceNames: Record<string, string> = {
    calm_avoiding: 'Entorno calmo / baja estimulación (Avoiding / Sensitivity)',
    intense_seeking: 'Estímulo intenso / rítmico (Seeking)',
    solitary_order: 'Juego individual estructurado / orden por color',
    group_social: 'Juego grupal compartido con pares',
    routine_same: 'Rutina predecible / camino conocido',
    routine_novel: 'Cambio novedoso / sorpresa',
  };

  const channelDecisions = scored.map((t) => ({
    channel: t.blockType,
    channelLabel: channelNames[t.blockType] ?? t.blockType,
    chosen: t.choiceChannel ?? 'unknown',
    chosenLabel: choiceNames[t.choiceChannel ?? ''] ?? String(t.choiceChannel ?? ''),
    rtMs: t.rtMs,
  }));

  const parts: string[] = [];
  if (sensoryCalmAvoidingRatio !== null) {
    parts.push(
      `Preferencia por baja carga sensorial (SP-2 Avoiding/Sensitivity): ${Math.round(sensoryCalmAvoidingRatio * 100)}% (${calmCount}/${sensoryChannels.length})`,
    );
  }
  if (solitaryOrderPlayRatio !== null) {
    parts.push(
      `Elección de juego estructurado individual (CAST/SRS-2): ${Math.round(solitaryOrderPlayRatio * 100)}% (${solitaryCount}/${socialChannels.length})`,
    );
  }
  if (routineSamenessRatio !== null) {
    parts.push(
      `Preferencia por rutina predecible (Criterio B.2): ${Math.round(routineSamenessRatio * 100)}% (${routineSameCount}/${routineChannels.length})`,
    );
  }

  return {
    totalScoredScenes: scored.length,
    sensoryCalmAvoidingRatio,
    solitaryOrderPlayRatio,
    routineSamenessRatio,
    channelDecisions,
    clinicalSummaryText: parts.join(' · '),
  };
}

/**
 * Computes Game 4B («Detective de Detalles» — Navon Local vs. Global & Visual Detail Search CEFT) breakdown.
 */
export function computeDetailNavonBreakdown(trials: TrialRecord[]): DetailNavonBreakdown {
  const scored = trials.filter((t) => !t.isPractice && t.gameId === 'G4_DETAIL_NAVON');
  const navon = scored.filter((t) => t.blockType === 'navon_choice');
  const search = scored.filter((t) => t.blockType === 'detail_search');

  if (scored.length === 0) {
    return {
      navonTotalChoices: 0,
      localPreferenceRatio: null,
      detailSearchTotalAttempts: 0,
      detailSearchHits: 0,
      detailSearchAccuracy: null,
      detailSearchMedianRtMs: null,
      perceptualStyleLabel: 'Sin datos de Detective de Detalles',
      clinicalSummaryText: 'Sin datos registrados en Prototipo 4B (Detective de Detalles).',
    };
  }

  const localCount = navon.filter((t) => t.choiceChannel === 'local').length;
  const localPreferenceRatio =
    navon.length > 0 ? Number((localCount / navon.length).toFixed(3)) : null;

  const hits = search.filter((t) => t.accuracy === 1);
  const detailSearchAccuracy =
    search.length > 0 ? Number((hits.length / search.length).toFixed(3)) : null;
  const detailSearchMedianRtMs = median(hits.map((t) => t.rtMs));

  let perceptualStyleLabel = 'Estilo Perceptivo Balanceado (Local-Global)';
  if (localPreferenceRatio !== null && localPreferenceRatio >= 0.65) {
    perceptualStyleLabel = 'Estilo Orientado al Detalle Local (Fortaleza Perceptiva Analítica)';
  } else if (localPreferenceRatio !== null && localPreferenceRatio <= 0.35) {
    perceptualStyleLabel = 'Estilo Orientado a la Configuración Global (Gestalt)';
  }

  const summaryParts: string[] = [];
  if (localPreferenceRatio !== null) {
    summaryParts.push(
      `Elección de componentes locales (Navon): ${Math.round(localPreferenceRatio * 100)}% (${localCount}/${navon.length})`,
    );
  }
  if (detailSearchAccuracy !== null) {
    summaryParts.push(
      `Búsqueda visual 3×3 (CEFT): ${hits.length} hallazgos en ${search.length} toques (${Math.round(detailSearchAccuracy * 100)}% efectividad${
        detailSearchMedianRtMs !== null ? `, RT mediano ${Math.round(detailSearchMedianRtMs)} ms` : ''
      })`,
    );
  }

  return {
    navonTotalChoices: navon.length,
    localPreferenceRatio,
    detailSearchTotalAttempts: search.length,
    detailSearchHits: hits.length,
    detailSearchAccuracy,
    detailSearchMedianRtMs,
    perceptualStyleLabel,
    clinicalSummaryText: summaryParts.join(' · '),
  };
}

/**
 *Deterministic, neuroaffirming Clinical Interpretation Guide for the Psychologist (CLIN-11).
 */
function buildClinicalGuideSummary(params: {
  jaIndex: number | null;
  socialAcc: number | null;
  arrowAcc: number | null;
  ijaRate: number | null;
  tomIndex: number | null;
  g3SocialAcc: number | null;
  g3PhysAcc: number;
  dccsBreakdown: DccsBreakdown;
  sensorySocial: SensorySocialDayBreakdown;
  detailNavon: DetailNavonBreakdown;
  sensoryIndex: number | null;
  emaSummary: EmaLongitudinalSummary;
}): ClinicalGuideSummary {
  const strengths: string[] = [];
  const hypotheses: string[] = [];
  const scales = new Set<string>(['CAST (Cribado 4–11a, gratuita)', 'SDQ (Comorbilidades)']);
  const prompts: string[] = [];

  // 1. Strengths detection
  if (params.arrowAcc !== null && params.arrowAcc >= 0.8) {
    strengths.push(
      `Atención visomotora basal conservada ante pistas direccionales no sociales (${Math.round(params.arrowAcc * 100)}% en control de brújula).`,
    );
  }
  if (params.dccsBreakdown.preSwitchAcc >= 0.8) {
    strengths.push(
      `Comprensión y categorización de reglas visuales simples preservada (${Math.round(params.dccsBreakdown.preSwitchAcc * 100)}% en bloque Pre-Switch).`,
    );
  }
  if (params.g3PhysAcc >= 0.8) {
    strengths.push(
      `Razonamiento causal físico y comprensión secuencial de historietas conservados (${Math.round(params.g3PhysAcc * 100)}% en control físico).`,
    );
  }
  if (
    params.detailNavon.detailSearchAccuracy !== null &&
    params.detailNavon.detailSearchAccuracy >= 0.75
  ) {
    strengths.push(
      `Fortaleza perceptiva en discriminación visual de detalles (${Math.round(params.detailNavon.detailSearchAccuracy * 100)}% de efectividad en búsqueda 3×3${
        params.detailNavon.detailSearchMedianRtMs !== null
          ? `, mediana ${Math.round(params.detailNavon.detailSearchMedianRtMs)} ms`
          : ''
      }).`,
    );
  }
  if (strengths.length === 0) {
    strengths.push(
      'Tolerancia adecuada al formato interactivo digital sin episodios de abandono abrupto durante las actividades completadas.',
    );
  }

  // 2. Hypotheses & Scales & Interview Prompts
  if (
    params.socialAcc !== null &&
    params.arrowAcc !== null &&
    params.arrowAcc - params.socialAcc >= 0.2
  ) {
    hypotheses.push(
      `Brecha en Atención Conjunta Receptiva (RJA): mejor rendimiento con señal geométrica (${Math.round(params.arrowAcc * 100)}%) que con mirada social de AuriKat (${Math.round(params.socialAcc * 100)}%).`,
    );
    scales.add('ADOS-2 (SA-CSS) / SRS-2 (Comunicación Social)');
    prompts.push(
      '¿Cómo responde en casa o jardín cuando un adulto señala o mira hacia un objeto lejano sin nombrarlo?',
    );
  }
  if (params.ijaRate !== null && params.ijaRate < 0.5) {
    hypotheses.push(
      'Baja frecuencia de Iniciación de Atención Conjunta (Micro-IJA): priorizó resolver el cofre directamente antes que compartir la luciérnaga con el compañero.',
    );
    scales.add('ADOS-2 / SCQ');
    prompts.push(
      '¿Suele traer objetos o señalar cosas espontáneamente solo para compartir interés con ustedes (sin pedir ayuda)?',
    );
  }
  if (
    params.dccsBreakdown.perseverativeErrors >= 2 ||
    params.dccsBreakdown.regressiveErrors >= 2 ||
    params.dccsBreakdown.twoVectorScore < 6.5
  ) {
    hypotheses.push(
      `Costo de flexibilidad ejecutiva en DCCS (Puntaje bicomponente ${params.dccsBreakdown.twoVectorScore}/10; ${params.dccsBreakdown.perseverativeErrors} errores perseverativos y ${params.dccsBreakdown.regressiveErrors} regresivos).`,
    );
    scales.add('BRIEF-2 / BRIEF-P (Subescala Shift / Flexibilidad)');
    prompts.push(
      '¿Qué ocurre en la vida diaria cuando cambia un plan sin aviso previo o hay que pasar de una actividad favorita a otra?',
    );
  }
  if (params.g3SocialAcc !== null && params.g3PhysAcc - params.g3SocialAcc >= 0.25) {
    hypotheses.push(
      `Diferencial Mentalista vs. Físico (Δ ToM = ${Math.round((params.g3PhysAcc - params.g3SocialAcc) * 100)}%): comprende la secuencia física pero requiere mayor apoyo para inferir creencias falsas o emociones epistémicas (sorpresa).`,
    );
    scales.add('SRS-2 (Cognición Social) / ADOS-2');
    prompts.push(
      '¿Cómo interpreta bromas sencillas, sorpresas o situaciones donde otra persona no sabe algo que él/ella sí vio?',
    );
  }
  if (
    params.sensorySocial.sensoryCalmAvoidingRatio !== null &&
    params.sensorySocial.sensoryCalmAvoidingRatio >= 0.65
  ) {
    hypotheses.push(
      `Preferencia marcada (${Math.round(params.sensorySocial.sensoryCalmAvoidingRatio * 100)}%) por entornos de baja carga sensorial (sonidos suaves, luz tenue, ropa sin etiquetas) en «El Día de AuriKat».`,
    );
    scales.add('Sensory Profile 2 (Dunn — Cuadrantes Avoiding y Sensitivity)');
    prompts.push(
      '¿Se cubre los oídos ante ruidos cotidianos (licuadora, cumpleaños), rechaza etiquetas de ropa o prefiere ambientes de luz suave?',
    );
  }
  if (
    params.sensorySocial.solitaryOrderPlayRatio !== null &&
    params.sensorySocial.solitaryOrderPlayRatio >= 0.5
  ) {
    hypotheses.push(
      `Preferencia por juego estructurado individual / ordenamiento por categorías (${Math.round(params.sensorySocial.solitaryOrderPlayRatio * 100)}%) frente a juegos grupales abiertos.`,
    );
    scales.add('SRS-2 (Motivación Social y RRB) / CAST');
    prompts.push(
      'En momentos de juego libre, ¿prefiere alinear/clasificar objetos o jugar en paralelo antes que sumarse a juegos grupales con reglas cambiantes?',
    );
  }
  if (
    params.detailNavon.localPreferenceRatio !== null &&
    params.detailNavon.localPreferenceRatio >= 0.65
  ) {
    hypotheses.push(
      `Procesamiento perceptivo prioritariamente local (${Math.round(params.detailNavon.localPreferenceRatio * 100)}% de elecciones locales en figuras jerárquicas de Navon): estilo cognitivo detallista.`,
    );
    prompts.push(
      '¿Suele notar pequeños detalles visuales, patrones o cambios mínimos en el hogar que pasan desapercibidos para los demás?',
    );
  }

  if (hypotheses.length === 0) {
    hypotheses.push(
      'Perfil conductual equilibrado en las tareas administradas, sin indicadores marcados de rigidez ejecutiva ni asimetría social-física.',
    );
  }
  if (prompts.length === 0) {
    prompts.push(
      'Indagar cómo se desenvuelve en transiciones cotidianas, regulación sensorial en entornos ruidosos y reciprocidad con pares de su edad.',
    );
  }

  return {
    strengths,
    clinicalHypothesesToExplore: hypotheses,
    suggestedExternalScales: Array.from(scales),
    caregiverInterviewPrompts: prompts,
  };
}

/**
 * Deterministic transparent Evidence-Centered Design (ECD) Scoring Engine (CLIN-02 / CLIN-11).
 * Evaluates Session Validity Gate FIRST -> emits INDETERMINATE and blocks dimensional scores if invalid,
 * while computing partialDomainsPreview when a clean 1-game test session is imported.
 */
export function evaluateClinicalSession(session: RawSessionPayload): ClinicalEvaluationReport {
  const scoredTrials = session.trials.filter((t) => !t.isPractice && t.errorCategory !== 'holdover_debounce');
  const practiceTrials = session.trials.filter((t) => t.isPractice);
  const isQuick = session.pacingMode === 'quick_demo';

  const g1 = scoredTrials.filter((t) => t.gameId === 'G1_JA');
  const g2 = scoredTrials.filter((t) => t.gameId === 'G2_DCCS');
  const g3 = scoredTrials.filter((t) => t.gameId === 'G3_TOM');
  const g4a = scoredTrials.filter((t) => t.gameId === 'G4A_PREF');
  const g4ss = scoredTrials.filter((t) => t.gameId === 'G4_SENSORY_SOCIAL');
  const g4dn = scoredTrials.filter((t) => t.gameId === 'G4_DETAIL_NAVON');

  const minG1 = isQuick ? 4 : 6;
  const minG2 = isQuick ? 6 : 10;
  const minG3 = isQuick ? 3 : 4;
  const minG4 = isQuick ? 3 : 4;

  const gamesWithMinimumData = [
    g1.length >= minG1,
    g2.length >= minG2,
    g3.length >= minG3,
    g4a.length >= minG4 ||
      session.strokes.length >= minG4 ||
      g4ss.length >= minG4 ||
      g4dn.length >= minG4,
  ].filter(Boolean).length;

  const anticipatoryOrTimeout = scoredTrials.filter(
    (t) => t.errorCategory === 'timeout' || (t.rtMs > 0 && t.rtMs < 150) || t.rtMs > 15000,
  ).length;
  const badTimingRatio = scoredTrials.length > 0 ? anticipatoryOrTimeout / scoredTrials.length : 1;

  // Check monolateral disengagement bias across directional trials
  const sideChoices = scoredTrials
    .map((t) => t.choiceChannel)
    .filter((c): c is string => c === 'left' || c === 'center' || c === 'right');
  let maxSideRatio = 0;
  if (sideChoices.length >= 8) {
    const counts: Record<string, number> = {};
    for (const c of sideChoices) counts[c] = (counts[c] ?? 0) + 1;
    maxSideRatio = Math.max(...Object.values(counts)) / sideChoices.length;
  }

  // Practice comprehension check (DCCS & ToM)
  const failedPracticeOnly =
    practiceTrials.length >= 4 &&
    practiceTrials.filter((t) => t.accuracy === 1).length === 0;

  const validityReasons: string[] = [];
  const caveats: string[] = [];
  let validityStatus: SessionValidityStatus = 'VALID';

  if (gamesWithMinimumData < 2) {
    validityStatus = 'INDETERMINATE';
    validityReasons.push(`Solo ${gamesWithMinimumData} de 4 minijuegos alcanzan el mínimo de ensayos puntuados (se requieren al menos 2 para validación completa).`);
  }
  if (failedPracticeOnly) {
    validityStatus = 'INDETERMINATE';
    validityReasons.push('Sin aciertos en los ensayos de práctica no puntuados Magrid+ (posible incomprensión de consigna visual o fatiga).');
  }
  if (scoredTrials.length > 0 && badTimingRatio > 0.4) {
    validityStatus = 'INDETERMINATE';
    validityReasons.push(`Alta proporción (${Math.round(badTimingRatio * 100)}%) de respuestas anticipatorias (<150 ms) o agotamiento de tiempo (>15 s).`);
  }
  if (maxSideRatio >= 0.95) {
    validityStatus = 'INDETERMINATE';
    validityReasons.push(`Sesgo espacial monolateral extremo (${Math.round(maxSideRatio * 100)}% en una misma posición).`);
  }

  const isQualityContaminated =
    failedPracticeOnly ||
    (scoredTrials.length > 0 && badTimingRatio > 0.4) ||
    maxSideRatio >= 0.95;

  const canShowPartialPreview =
    validityStatus === 'INDETERMINATE' &&
    !isQualityContaminated &&
    (gamesWithMinimumData >= 1 || g4ss.length > 0 || g4dn.length > 0 || session.emaEntries.length > 0);

  // Caveats (only downgrade VALID -> VALID_WITH_CAVEATS if not already INDETERMINATE)
  if (isQuick) {
    caveats.push('Sesión administrada en Modo Prueba Rápida (quick_demo): número reducido de ensayos para demostración ágil.');
  }
  if (session.deviceMeta.pointerType === 'mouse') {
    caveats.push('Dispositivo de entrada: mouse (se excluye inferencia táctil directa en Cinemática Motora 2D).');
  }
  if (session.deviceMeta.effectiveSamplingHz < 40) {
    caveats.push(`Tasa de muestreo táctil baja (${session.deviceMeta.effectiveSamplingHz} Hz < 40 Hz recomendados para cinemática fina).`);
  }
  const g3PhysCtrl = g3.filter((t) => t.blockType === 'physical_ctrl');
  const g3PhysAcc = g3PhysCtrl.length
    ? g3PhysCtrl.filter((t) => t.accuracy === 1).length / g3PhysCtrl.length
    : 1;
  if (g3PhysCtrl.length >= 2 && g3PhysAcc < 0.6) {
    caveats.push(`Precisión reducida (${Math.round(g3PhysAcc * 100)}%) en ítems control de causalidad física del Juego 3 (posible factor dominio-general o comprensión secuencial).`);
  }
  const emaSummary = computeEmaSummary(session.emaEntries, session.ageMonths);
  if (emaSummary.ageSoloCaveat) {
    caveats.push('EMA Diario: niño < 7 años con predominio de registro autónomo sin cuidador (menor fiabilidad esperada según literatura EMA).');
  }
  if (gamesWithMinimumData === 2 || gamesWithMinimumData === 3) {
    caveats.push(`Batería parcialmente completada (${gamesWithMinimumData}/4 minijuegos); algunos ejes se reportan sin puntaje.`);
  }

  if (validityStatus === 'VALID' && caveats.length > 0) {
    validityStatus = 'VALID_WITH_CAVEATS';
  }
  if (validityStatus === 'VALID') {
    validityReasons.push('Sesión completa dentro de parámetros fisiológicos de latencia, comprensión de práctica y calidad de muestreo.');
  }

  const dccsBreakdown = computeDccsBreakdown(session.trials.filter((t) => t.gameId === 'G2_DCCS'));
  const sensorySocialBreakdown = computeSensorySocialBreakdown(session.trials);
  const detailNavonBreakdown = computeDetailNavonBreakdown(session.trials);
  const motorAggregate = aggregateSessionMotorMetrics(session.strokes, session.rhythmicTapInterIntervalsMs);

  const isBlocked = validityStatus === 'INDETERMINATE';

  // --- 1. Joint Attention ---
  const g1Social = g1.filter((t) => t.blockType === 'social_cue');
  const g1Arrow = g1.filter((t) => t.blockType === 'arrow_cue');
  const g1Contingency = g1.filter((t) => t.blockType === 'contingency');
  const g1Ija = g1.filter((t) => t.blockType === 'micro_ija');
  const g1PreCue = session.trials.filter((t) => t.gameId === 'G1_JA' && t.errorCategory === 'pre_cue_impulsive').length;

  const socialAcc = g1Social.length ? g1Social.filter((t) => t.accuracy === 1).length / g1Social.length : null;
  const arrowAcc = g1Arrow.length ? g1Arrow.filter((t) => t.accuracy === 1).length / g1Arrow.length : null;
  const socialRt = median(g1Social.filter((t) => t.accuracy === 1).map((t) => t.rtMs));
  const arrowRt = median(g1Arrow.filter((t) => t.accuracy === 1).map((t) => t.rtMs));
  const deltaSocialArrowRt = socialRt !== null && arrowRt !== null ? Math.round(socialRt - arrowRt) : null;
  const ijaRate = g1Ija.length ? g1Ija.filter((t) => t.accuracy === 1).length / g1Ija.length : null;
  const contingencyAcc = g1Contingency.length
    ? g1Contingency.filter((t) => t.accuracy === 1).length / g1Contingency.length
    : null;

  let rawJaIndex: number | null = null;
  if (!isQualityContaminated && g1.length >= minG1 && socialAcc !== null) {
    const gapAcc = arrowAcc !== null ? Math.max(0, arrowAcc - socialAcc) : 1 - socialAcc;
    const rtPenalty = deltaSocialArrowRt !== null ? Math.max(0, Math.min(30, deltaSocialArrowRt / 18)) : 0;
    const ijaPenalty = ijaRate !== null ? (1 - ijaRate) * 28 : 10;
    const contPenalty = contingencyAcc !== null ? (1 - contingencyAcc) * 22 : 8;
    rawJaIndex = clamp0_100((1 - socialAcc) * 35 + gapAcc * 25 + rtPenalty + ijaPenalty + contPenalty);
  }
  const jaTrace: EvidenceTraceItem[] = [
    {
      metricKey: 'g1_social_vs_arrow_acc',
      label: 'Precisión Pista Social vs. Flecha',
      observedValue:
        socialAcc !== null && arrowAcc !== null
          ? `Social ${Math.round(socialAcc * 100)}% vs. Flecha ${Math.round(arrowAcc * 100)}%`
          : 'Sin datos suficientes',
      direction: socialAcc !== null && arrowAcc !== null && arrowAcc - socialAcc >= 0.2 ? 'atypical_observation' : 'typical_observation',
      weightNote: 'Contraste central RJA (Bayliss & Tipper; PMC9543973)',
    },
    {
      metricKey: 'g1_delta_rt',
      label: 'Diferencia RT (Social − Flecha)',
      observedValue: deltaSocialArrowRt !== null ? `${deltaSocialArrowRt >= 0 ? '+' : ''}${deltaSocialArrowRt} ms` : 'N/A',
      direction: deltaSocialArrowRt !== null && deltaSocialArrowRt > 220 ? 'atypical_observation' : 'typical_observation',
      weightNote: 'Latencia diferencial de orientación',
    },
    {
      metricKey: 'g1_micro_ija',
      label: 'Iniciación de Atención Conjunta (Micro-IJA)',
      observedValue: ijaRate !== null ? `${Math.round(ijaRate * 100)}% (${g1Ija.filter((t) => t.accuracy === 1).length}/${g1Ija.length})` : 'N/A',
      direction: ijaRate !== null && ijaRate < 0.5 ? 'atypical_observation' : 'typical_observation',
      weightNote: 'Indicador frontal volitivo (Mundy & Newell)',
    },
    {
      metricKey: 'g1_precue_impulsive',
      label: 'Toques impulsivos pre-pista (descontado debounce)',
      observedValue: `${g1PreCue} eventos`,
      direction: g1PreCue >= 4 ? 'contextual_note' : 'typical_observation',
      weightNote: 'Posible señal de impulsividad (controlar comorbilidad TDAH)',
    },
  ];

  // --- 2. Emotion & Non-Verbal ToM ---
  const g3Social = g3.filter((t) => t.blockType !== 'physical_ctrl');
  const g3SocialAcc = g3Social.length ? g3Social.filter((t) => t.accuracy === 1).length / g3Social.length : null;
  const g3Surprise = g3Social.filter((t) => t.targetEmotion === 'surprised');
  const g3SurpriseAcc = g3Surprise.length ? g3Surprise.filter((t) => t.accuracy === 1).length / g3Surprise.length : null;
  const deltaTomPhys = g3SocialAcc !== null ? Number((g3PhysAcc - g3SocialAcc).toFixed(3)) : null;

  let rawTomIndex: number | null = null;
  if (!isQualityContaminated && g3Social.length >= 2 && g3SocialAcc !== null) {
    const baseDiff = (1 - g3SocialAcc) * 65;
    const controlledGap = deltaTomPhys !== null ? Math.max(0, deltaTomPhys) * 35 : 0;
    rawTomIndex = clamp0_100(baseDiff * 0.7 + controlledGap);
  }
  const tomTrace: EvidenceTraceItem[] = [
    {
      metricKey: 'g3_social_acc',
      label: 'Precisión en escenas emocionales y mentalistas',
      observedValue: g3SocialAcc !== null ? `${Math.round(g3SocialAcc * 100)}% (${g3Social.length} escenas)` : 'N/A',
      direction: g3SocialAcc !== null && g3SocialAcc < 0.65 ? 'atypical_observation' : 'typical_observation',
      weightNote: `Forma paralela ${session.formVariant} — Nivel ${session.subAgeBand === '4_5' ? '4–6a' : '7–8+a'}`,
    },
    {
      metricKey: 'g3_physical_ctrl_gap',
      label: 'Brecha Control Físico − Mentalista (Δ ToM)',
      observedValue: deltaTomPhys !== null ? `Físico ${Math.round(g3PhysAcc * 100)}% vs. ToM ${Math.round((g3SocialAcc ?? 0) * 100)}% (Δ=${Math.round(deltaTomPhys * 100)}%)` : 'N/A',
      direction: deltaTomPhys !== null && deltaTomPhys >= 0.25 ? 'atypical_observation' : 'contextual_note',
      weightNote: 'Aislamiento dominio-general (Wilson 2021)',
    },
    {
      metricKey: 'g3_surprise',
      label: 'Reconocimiento de emoción epistémica (Sorpresa)',
      observedValue: g3SurpriseAcc !== null ? `${Math.round(g3SurpriseAcc * 100)}%` : 'N/A',
      direction: g3SurpriseAcc !== null && g3SurpriseAcc < 0.5 ? 'atypical_observation' : 'typical_observation',
      weightNote: 'Emoción ligada a actualización de creencias',
    },
  ];

  // --- 3. Cognitive Flexibility (NIH Toolbox DCCS + Routine Sameness from 4A) ---
  let rawDccsIndex: number | null = null;
  if (!isQualityContaminated && g2.length >= minG2) {
    const invTwoVec = (10 - dccsBreakdown.twoVectorScore) * 6.5;
    const persevContrib = Math.min(25, dccsBreakdown.perseverativeErrors * 5);
    const regresContrib = Math.min(25, dccsBreakdown.regressiveErrors * 6.5);
    rawDccsIndex = clamp0_100(invTwoVec + persevContrib + regresContrib);
  }
  const dccsTrace: EvidenceTraceItem[] = [
    {
      metricKey: 'g2_twovector',
      label: 'Puntuación Bicomponente NIH Toolbox DCCS',
      observedValue: `${dccsBreakdown.twoVectorScore}/10 (Acc=${dccsBreakdown.accuracyVector}/5, log-RT=${dccsBreakdown.rtVector}/5)`,
      direction: dccsBreakdown.twoVectorScore < 6.5 ? 'atypical_observation' : 'typical_observation',
      weightNote: 'Evita efecto techo en 5–8 años (Doebel & Zelazo; NIH Toolbox)',
    },
    {
      metricKey: 'g2_perseverative_regressive',
      label: 'Errores Perseverativos vs. Regresivos',
      observedValue: `Perseverativos: ${dccsBreakdown.perseverativeErrors} | Regresivos: ${dccsBreakdown.regressiveErrors} | No sist.: ${dccsBreakdown.nonSystematicErrors}`,
      direction: dccsBreakdown.regressiveErrors >= 2 || dccsBreakdown.perseverativeErrors >= 3 ? 'atypical_observation' : 'typical_observation',
      weightNote: 'Errores regresivos asociados a rigidez conductual (D’Cruz et al.)',
    },
    {
      metricKey: 'g2_switch_cost',
      label: 'Costo de Cambio en Bloque Mixto (Switch Cost)',
      observedValue: dccsBreakdown.switchCostMs !== null ? `${dccsBreakdown.switchCostMs >= 0 ? '+' : ''}${dccsBreakdown.switchCostMs} ms` : 'N/A',
      direction: dccsBreakdown.switchCostMs !== null && dccsBreakdown.switchCostMs > 320 ? 'atypical_observation' : 'typical_observation',
      weightNote: 'Mediana ensayos switch − repeat correctos',
    },
  ];
  if (sensorySocialBreakdown.routineSamenessRatio !== null) {
    dccsTrace.push({
      metricKey: 'g4a_routine_sameness',
      label: 'Preferencia por Rutina Predecible (Juego 4A)',
      observedValue: `${Math.round(sensorySocialBreakdown.routineSamenessRatio * 100)}% invariancia de rutina`,
      direction: sensorySocialBreakdown.routineSamenessRatio >= 0.75 ? 'atypical_observation' : 'contextual_note',
      weightNote: 'Escenas de cambio de camino/plato en El Día de AuriKat (Criterio B.2)',
    });
  }

  // --- 4. Social / Perceptual Preference (GeoPref Classic OR 4A Social Play + 4B Navon Local-Global) ---
  const geoChoices = g4a.filter((t) => t.choiceChannel === 'geometric').length;
  const socChoices = g4a.filter((t) => t.choiceChannel === 'social').length;
  const totalPref = geoChoices + socChoices;
  const geometricRatio = totalPref >= minG4 ? Number((geoChoices / totalPref).toFixed(3)) : null;
  const highSpecificityAlert = geometricRatio !== null && geometricRatio >= 0.69;

  let rawGeoprefIndex: number | null = null;
  if (!isQualityContaminated) {
    if (geometricRatio !== null) {
      rawGeoprefIndex = clamp0_100(geometricRatio * 100);
    } else if (
      sensorySocialBreakdown.solitaryOrderPlayRatio !== null ||
      detailNavonBreakdown.localPreferenceRatio !== null
    ) {
      const sol = sensorySocialBreakdown.solitaryOrderPlayRatio ?? 0.4;
      const loc = detailNavonBreakdown.localPreferenceRatio ?? 0.4;
      rawGeoprefIndex = clamp0_100(sol * 55 + loc * 45);
    }
  }
  const geoprefTrace: EvidenceTraceItem[] = [];
  if (geometricRatio !== null || (g4ss.length === 0 && g4dn.length === 0)) {
    geoprefTrace.push({
      metricKey: 'g4a_geo_ratio',
      label: 'Ratio de Preferencia Geométrica vs. Social',
      observedValue:
        geometricRatio !== null
          ? `${Math.round(geometricRatio * 100)}% geométrico (${geoChoices} geo / ${socChoices} social)`
          : 'Sin interacciones suficientes',
      direction: highSpecificityAlert ? 'atypical_observation' : 'contextual_note',
      weightNote: 'Indicador exploratorio ASDGeo: alta especificidad (94–98%), baja sensibilidad (17–35%); negativo NO descarta TEA.',
    });
  }
  if (sensorySocialBreakdown.solitaryOrderPlayRatio !== null) {
    geoprefTrace.push({
      metricKey: 'g4ss_social_order',
      label: 'Juego Solitario Ordenado vs. Grupal (Prototipo 4A — CAST / SRS-2)',
      observedValue: `${Math.round(sensorySocialBreakdown.solitaryOrderPlayRatio * 100)}% juego estructurado individual`,
      direction: sensorySocialBreakdown.solitaryOrderPlayRatio >= 0.6 ? 'atypical_observation' : 'typical_observation',
      weightNote: 'Elección entre ronda grupal y ordenamiento de bloques/rincón calmo',
    });
  }
  if (detailNavonBreakdown.localPreferenceRatio !== null) {
    geoprefTrace.push({
      metricKey: 'g4dn_navon_local',
      label: 'Procesamiento Perceptivo Local vs. Global (Prototipo 4B — Navon / CEFT)',
      observedValue: `${Math.round(detailNavonBreakdown.localPreferenceRatio * 100)}% local · Búsqueda 3×3: ${
        detailNavonBreakdown.detailSearchAccuracy !== null
          ? `${Math.round(detailNavonBreakdown.detailSearchAccuracy * 100)}%`
          : 'N/A'
      }`,
      direction: detailNavonBreakdown.localPreferenceRatio >= 0.65 ? 'atypical_observation' : 'typical_observation',
      weightNote: detailNavonBreakdown.perceptualStyleLabel,
    });
  }

  // --- 5. Pure 2D Motor Kinematics (4B Classic) ---
  const motorMouseCaveat =
    session.deviceMeta.pointerType === 'mouse'
      ? 'Captura realizada con mouse; métricas táctiles no equiparables a arrastre digital.'
      : null;
  let rawMotorIndex: number | null = null;
  if (!isQualityContaminated && motorAggregate.strokeCount >= minG4 && session.deviceMeta.pointerType !== 'mouse') {
    const directPenalty = Math.max(0, (0.92 - motorAggregate.meanDirectness) * 140);
    const varDirPenalty = Math.min(25, motorAggregate.gestureDirectnessVariance * 1800);
    const jerkPenalty = Math.min(30, Math.max(0, (motorAggregate.meanNormalizedJerk - 35) * 0.25));
    const nsrPenalty = Math.min(20, motorAggregate.meanGammaNsr * 250);
    const rhythmBonus = motorAggregate.rhythmicTappingDetected ? 12 : 0;
    rawMotorIndex = clamp0_100(directPenalty + varDirPenalty + jerkPenalty + nsrPenalty + rhythmBonus);
  }
  const motorTrace: EvidenceTraceItem[] = [
    {
      metricKey: 'g4b_butera_triad',
      label: 'Tríada Táctil sin IMU (Butera et al., 2025)',
      observedValue: `Var. Rectitud=${motorAggregate.gestureDirectnessVariance.toFixed(4)} | Var. Área=${motorAggregate.gestureAreaVariance.toExponential(2)} | Accel Mín=${motorAggregate.minGestureAccelerationMean.toFixed(2)}`,
      direction: motorAggregate.gestureDirectnessVariance > 0.008 ? 'atypical_observation' : 'typical_observation',
      weightNote: 'Variables correlacionadas con activación cerebelar; advertencia diferencial TEA vs. DCD (71%).',
    },
    {
      metricKey: 'g4b_simeoli_smoothness',
      label: 'Rectitud Media y Normalized Jerk (Simeoli 2021–24)',
      observedValue: `Rectitud=${motorAggregate.meanDirectness.toFixed(2)} | Jerk=${motorAggregate.meanNormalizedJerk.toFixed(1)} | Submov.=${motorAggregate.meanSubmovements.toFixed(1)}`,
      direction: motorAggregate.meanDirectness < 0.78 || motorAggregate.meanNormalizedJerk > 110 ? 'atypical_observation' : 'typical_observation',
      weightNote: `Preprocesado a 60 Hz uniforme + Savitzky-Golay (muestreo real ${session.deviceMeta.effectiveSamplingHz} Hz).`,
    },
    {
      metricKey: 'g4b_torres_nsr',
      label: 'Ruido Sensoriomotor Gamma NSR (Torres et al.)',
      observedValue: `NSR=${motorAggregate.meanGammaNsr.toFixed(4)} | Levantamientos=${motorAggregate.totalTouchLifts}`,
      direction: motorAggregate.meanGammaNsr > 0.04 ? 'atypical_observation' : 'typical_observation',
      weightNote: 'Parámetro de escala de picos de micro-movimiento.',
    },
  ];

  // --- 6. Sensory Modulation (Dunn SP-2 Audiovisual Bar + Game 4A Sensory Choices) ---
  const activeAvoidCount =
    (session.sensorySettingsFinal.muted ? 1 : 0) +
    (session.sensorySettingsFinal.dimLight ? 1 : 0) +
    (session.sensorySettingsFinal.motionScale <= 0.5 ? 1 : 0);
  const sensoryAdjustCount = session.sensoryAdjustments.length;
  let rawSensoryIndex: number | null = null;
  if (!isQualityContaminated) {
    const barScore = activeAvoidCount * 22 + Math.min(34, sensoryAdjustCount * 7);
    if (sensorySocialBreakdown.sensoryCalmAvoidingRatio !== null) {
      const gameSensoryScore = Math.round(sensorySocialBreakdown.sensoryCalmAvoidingRatio * 75);
      rawSensoryIndex = clamp0_100(Math.max(barScore, Math.round(barScore * 0.45 + gameSensoryScore * 0.85)));
    } else {
      rawSensoryIndex = clamp0_100(barScore);
    }
  }
  const sensoryTrace: EvidenceTraceItem[] = [
    {
      metricKey: 'sensory_bar_avoiding',
      label: 'Autorregulación Activa en Barra Superior (Dunn Avoiding Audiovisual)',
      observedValue: `Silencio=${session.sensorySettingsFinal.muted ? 'Sí' : 'No'} | Luz tenue=${session.sensorySettingsFinal.dimLight ? 'Sí' : 'No'} | Movimiento=${Math.round(session.sensorySettingsFinal.motionScale * 100)}% (${sensoryAdjustCount} ajustes)`,
      direction: activeAvoidCount >= 2 || sensoryAdjustCount >= 3 ? 'atypical_observation' : 'contextual_note',
      weightNote: 'Ajustes de calma realizados en vivo durante la sesión.',
    },
  ];
  if (sensorySocialBreakdown.sensoryCalmAvoidingRatio !== null) {
    sensoryTrace.push({
      metricKey: 'g4ss_sp2_choices',
      label: 'Elecciones Sensoriales Cotidianas (Prototipo 4A — Dunn SP-2)',
      observedValue: `${Math.round(sensorySocialBreakdown.sensoryCalmAvoidingRatio * 100)}% elección de baja carga sensorial (sonido, luz, textura, movimiento)`,
      direction: sensorySocialBreakdown.sensoryCalmAvoidingRatio >= 0.65 ? 'atypical_observation' : 'typical_observation',
      weightNote: 'Cubre canales auditivo, visual, táctil (etiquetas/texturas) y vestibular en escenas ilustradas.',
    });
  }

  const prefTrialCount = Math.max(totalPref, g4ss.length + g4dn.length);

  const rawDomainMap: Record<
    ClinicalDomainId,
    { score: number | null; n: number; caveat: string | null; trace: EvidenceTraceItem[] }
  > = {
    joint_attention: { score: rawJaIndex, n: g1.length, caveat: null, trace: jaTrace },
    emotion_tom: {
      score: rawTomIndex,
      n: g3Social.length,
      caveat: g3PhysCtrl.length >= 2 && g3PhysAcc < 0.6 ? 'Control físico bajo (<60%)' : null,
      trace: tomTrace,
    },
    cognitive_flexibility: { score: rawDccsIndex, n: g2.length, caveat: null, trace: dccsTrace },
    social_geo_pref: {
      score: rawGeoprefIndex,
      n: prefTrialCount,
      caveat:
        g4ss.length > 0 || g4dn.length > 0
          ? 'Integra preferencias de juego (4A) y estilo perceptivo Local/Global (4B)'
          : 'Exploratorio alta especificidad / baja sensibilidad (negativo no descarta TEA)',
      trace: geoprefTrace,
    },
    motor_kinematics_2d: {
      score: rawMotorIndex,
      n: motorAggregate.strokeCount,
      caveat: motorMouseCaveat ?? 'Solapamiento TEA vs. DCD (71% Butera 2025) — contrastar con MABC-2',
      trace: motorTrace,
    },
    sensory_modulation: {
      score: rawSensoryIndex,
      n: Math.max(1, sensoryAdjustCount + g4ss.length + 1),
      caveat:
        g4ss.length > 0
          ? 'Combina Barra Sensorial en vivo + escenas SP-2 de El Día de AuriKat'
          : 'Solo canal audiovisual (triangular con SP-2)',
      trace: sensoryTrace,
    },
  };

  const partialDomainsPreview: DomainScoreResult[] = CLINICAL_DOMAINS.map((spec) => {
    const entry = rawDomainMap[spec.id];
    return {
      domainId: spec.id,
      title: spec.title,
      shortTitle: spec.shortTitle,
      observationIndex: entry.score,
      uncertaintyHalfWidth: entry.score !== null ? uncertaintyFromTrials(entry.n) : null,
      validTrialCount: entry.n,
      caveatFlag: entry.caveat,
      evidenceTrace: entry.trace,
    };
  });

  const domains: DomainScoreResult[] = partialDomainsPreview.map((d) =>
    isBlocked
      ? {
          ...d,
          observationIndex: null,
          uncertaintyHalfWidth: null,
        }
      : d,
  );

  const clinicalGuide = buildClinicalGuideSummary({
    jaIndex: rawJaIndex,
    socialAcc,
    arrowAcc,
    ijaRate,
    tomIndex: rawTomIndex,
    g3SocialAcc,
    g3PhysAcc,
    dccsBreakdown,
    sensorySocial: sensorySocialBreakdown,
    detailNavon: detailNavonBreakdown,
    sensoryIndex: rawSensoryIndex,
    emaSummary,
  });

  return {
    protocolVersion: session.protocolVersion,
    participantPseudoId: session.participantPseudoId,
    sessionId: session.sessionId,
    ageMonths: session.ageMonths,
    subAgeBand: session.subAgeBand,
    formVariant: session.formVariant,
    validityStatus,
    validityReasons,
    caveats,
    canShowPartialPreview,
    domains,
    partialDomainsPreview,
    dccsBreakdown,
    sensorySocialBreakdown,
    detailNavonBreakdown,
    clinicalGuide,
    motorAggregate,
    emaSummary,
    geoprefExploratoryFlag: {
      geometricRatio,
      totalInteractions: totalPref,
      highSpecificityAlert,
      interpretationRule:
        'Una preferencia geométrica alta (>=69%) es un marcador exploratorio de alta especificidad (subtipo ASDGeo); un resultado equilibrado o social JAMÁS descarta TEA.',
    },
    generatedAtIso: new Date().toISOString(),
  };
}
