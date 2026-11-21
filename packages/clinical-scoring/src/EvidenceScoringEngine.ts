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
  domains: DomainScoreResult[];
  dccsBreakdown: DccsBreakdown;
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
 * Deterministic transparent Evidence-Centered Design (ECD) Scoring Engine (CLIN-02 / CLIN-11).
 * Evaluates Session Validity Gate FIRST -> emits INDETERMINATE and blocks dimensional scores if invalid.
 */
export function evaluateClinicalSession(session: RawSessionPayload): ClinicalEvaluationReport {
  const scoredTrials = session.trials.filter((t) => !t.isPractice && t.errorCategory !== 'holdover_debounce');
  const practiceTrials = session.trials.filter((t) => t.isPractice);

  const g1 = scoredTrials.filter((t) => t.gameId === 'G1_JA');
  const g2 = scoredTrials.filter((t) => t.gameId === 'G2_DCCS');
  const g3 = scoredTrials.filter((t) => t.gameId === 'G3_TOM');
  const g4a = scoredTrials.filter((t) => t.gameId === 'G4A_PREF');

  const gamesWithMinimumData = [
    g1.length >= 6,
    g2.length >= 10,
    g3.length >= 4,
    g4a.length >= 4 || session.strokes.length >= 4,
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
    validityReasons.push(`Solo ${gamesWithMinimumData} de 4 minijuegos alcanzan el mínimo de ensayos puntuados (se requieren al menos 2).`);
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

  // Caveats (only downgrade VALID -> VALID_WITH_CAVEATS if not already INDETERMINATE)
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
  const motorAggregate = aggregateSessionMotorMetrics(session.strokes, session.rhythmicTapInterIntervalsMs);

  // Compute each of the 6 domains (nullified if global session is INDETERMINATE)
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

  let jaIndex: number | null = null;
  if (!isBlocked && g1.length >= 6 && socialAcc !== null) {
    const gapAcc = arrowAcc !== null ? Math.max(0, arrowAcc - socialAcc) : 1 - socialAcc;
    const rtPenalty = deltaSocialArrowRt !== null ? Math.max(0, Math.min(30, deltaSocialArrowRt / 18)) : 0;
    const ijaPenalty = ijaRate !== null ? (1 - ijaRate) * 28 : 10;
    const contPenalty = contingencyAcc !== null ? (1 - contingencyAcc) * 22 : 8;
    jaIndex = clamp0_100((1 - socialAcc) * 35 + gapAcc * 25 + rtPenalty + ijaPenalty + contPenalty);
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

  let tomIndex: number | null = null;
  if (!isBlocked && g3Social.length >= 4 && g3SocialAcc !== null) {
    const baseDiff = (1 - g3SocialAcc) * 65;
    const controlledGap = deltaTomPhys !== null ? Math.max(0, deltaTomPhys) * 35 : 0;
    tomIndex = clamp0_100(baseDiff * 0.7 + controlledGap);
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

  // --- 3. Cognitive Flexibility (NIH Toolbox DCCS) ---
  let dccsIndex: number | null = null;
  if (!isBlocked && g2.length >= 10) {
    const invTwoVec = (10 - dccsBreakdown.twoVectorScore) * 6.5;
    const persevContrib = Math.min(25, dccsBreakdown.perseverativeErrors * 5);
    const regresContrib = Math.min(25, dccsBreakdown.regressiveErrors * 6.5);
    dccsIndex = clamp0_100(invTwoVec + persevContrib + regresContrib);
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

  // --- 4. Exploratory GeoPref (4A) ---
  const geoChoices = g4a.filter((t) => t.choiceChannel === 'geometric').length;
  const socChoices = g4a.filter((t) => t.choiceChannel === 'social').length;
  const totalPref = geoChoices + socChoices;
  const geometricRatio = totalPref >= 4 ? Number((geoChoices / totalPref).toFixed(3)) : null;
  const highSpecificityAlert = geometricRatio !== null && geometricRatio >= 0.69;

  let geoprefIndex: number | null = null;
  if (!isBlocked && geometricRatio !== null) {
    geoprefIndex = clamp0_100(geometricRatio * 100);
  }
  const geoprefTrace: EvidenceTraceItem[] = [
    {
      metricKey: 'g4a_geo_ratio',
      label: 'Ratio de Preferencia Geométrica vs. Social',
      observedValue:
        geometricRatio !== null
          ? `${Math.round(geometricRatio * 100)}% geométrico (${geoChoices} geo / ${socChoices} social)`
          : 'Sin interacciones suficientes',
      direction: highSpecificityAlert ? 'atypical_observation' : 'contextual_note',
      weightNote: 'Indicador exploratorio ASDGeo: alta especificidad (94–98%), baja sensibilidad (17–35%); negativo NO descarta TEA.',
    },
  ];

  // --- 5. Pure 2D Motor Kinematics (4B) ---
  const motorMouseCaveat =
    session.deviceMeta.pointerType === 'mouse'
      ? 'Captura realizada con mouse; métricas táctiles no equiparables a arrastre digital.'
      : null;
  let motorIndex: number | null = null;
  if (!isBlocked && motorAggregate.strokeCount >= 4 && session.deviceMeta.pointerType !== 'mouse') {
    const directPenalty = Math.max(0, (0.92 - motorAggregate.meanDirectness) * 140);
    const varDirPenalty = Math.min(25, motorAggregate.gestureDirectnessVariance * 1800);
    const jerkPenalty = Math.min(30, Math.max(0, (motorAggregate.meanNormalizedJerk - 35) * 0.25));
    const nsrPenalty = Math.min(20, motorAggregate.meanGammaNsr * 250);
    const rhythmBonus = motorAggregate.rhythmicTappingDetected ? 12 : 0;
    motorIndex = clamp0_100(directPenalty + varDirPenalty + jerkPenalty + nsrPenalty + rhythmBonus);
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

  // --- 6. Sensory Modulation (Dunn SP-2 Audiovisual) ---
  const activeAvoidCount =
    (session.sensorySettingsFinal.muted ? 1 : 0) +
    (session.sensorySettingsFinal.dimLight ? 1 : 0) +
    (session.sensorySettingsFinal.motionScale <= 0.5 ? 1 : 0);
  const sensoryAdjustCount = session.sensoryAdjustments.length;
  let sensoryIndex: number | null = null;
  if (!isBlocked) {
    sensoryIndex = clamp0_100(activeAvoidCount * 22 + Math.min(34, sensoryAdjustCount * 7));
  }
  const sensoryTrace: EvidenceTraceItem[] = [
    {
      metricKey: 'sensory_bar_avoiding',
      label: 'Autorregulación Activa (Dunn Avoiding Audiovisual)',
      observedValue: `Silencio=${session.sensorySettingsFinal.muted ? 'Sí' : 'No'} | Luz tenue=${session.sensorySettingsFinal.dimLight ? 'Sí' : 'No'} | Movimiento=${Math.round(session.sensorySettingsFinal.motionScale * 100)}% (${sensoryAdjustCount} ajustes)`,
      direction: activeAvoidCount >= 2 || sensoryAdjustCount >= 3 ? 'atypical_observation' : 'contextual_note',
      weightNote: 'Solo canal audiovisual digital; no cubre canales táctil corporal, olfativo, propioceptivo ni Low Registration.',
    },
  ];

  const domainMap: Record<
    ClinicalDomainId,
    { score: number | null; n: number; caveat: string | null; trace: EvidenceTraceItem[] }
  > = {
    joint_attention: { score: jaIndex, n: g1.length, caveat: null, trace: jaTrace },
    emotion_tom: {
      score: tomIndex,
      n: g3Social.length,
      caveat: g3PhysCtrl.length >= 2 && g3PhysAcc < 0.6 ? 'Control físico bajo (<60%)' : null,
      trace: tomTrace,
    },
    cognitive_flexibility: { score: dccsIndex, n: g2.length, caveat: null, trace: dccsTrace },
    social_geo_pref: {
      score: geoprefIndex,
      n: totalPref,
      caveat: 'Exploratorio alta especificidad / baja sensibilidad (negativo no descarta TEA)',
      trace: geoprefTrace,
    },
    motor_kinematics_2d: {
      score: motorIndex,
      n: motorAggregate.strokeCount,
      caveat: motorMouseCaveat ?? 'Solapamiento TEA vs. DCD (71% Butera 2025) — contrastar con MABC-2',
      trace: motorTrace,
    },
    sensory_modulation: {
      score: sensoryIndex,
      n: Math.max(1, sensoryAdjustCount + 1),
      caveat: 'Solo canal audiovisual (triangular con SP-2)',
      trace: sensoryTrace,
    },
  };

  const domains: DomainScoreResult[] = CLINICAL_DOMAINS.map((spec) => {
    const entry = domainMap[spec.id];
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
    domains,
    dccsBreakdown,
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
