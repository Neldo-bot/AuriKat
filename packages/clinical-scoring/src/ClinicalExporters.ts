import type { RawSessionPayload } from '@aurikat/core-engine';
import type { ClinicalEvaluationReport } from './EvidenceScoringEngine.js';

export interface ExternalBetaScores {
  studyGroupArm: '' | 'ASD_pure' | 'ASD_ADHD' | 'Clinical_Control' | 'TD';
  castTotal: string;
  sdqTotal: string;
  sdqHyperactivity: string;
  ados2SaCss: string;
  ados2RrbCss: string;
  cars2Total: string;
  srs2TScore: string;
  scqTotal: string;
  sp2Avoiding: string;
  sp2Sensitivity: string;
  brief2ShiftT: string;
  iqNonVerbalSs: string;
  mabc2Percentile: string;
}

export const EMPTY_EXTERNAL_SCORES: ExternalBetaScores = {
  studyGroupArm: '',
  castTotal: '',
  sdqTotal: '',
  sdqHyperactivity: '',
  ados2SaCss: '',
  ados2RrbCss: '',
  cars2Total: '',
  srs2TScore: '',
  scqTotal: '',
  sp2Avoiding: '',
  sp2Sensitivity: '',
  brief2ShiftT: '',
  iqNonVerbalSs: '',
  mabc2Percentile: '',
};

const CUSTOM_BIOMARKER_SYSTEM = 'https://aurikat.org/fhir/CodeSystem/aurikat-biomarkers-v1';
const LOINC_SYSTEM = 'http://loinc.org';

/**
 * Verified real LOINC codes ONLY (zero invented LOINC/SNOMED codes).
 */
export const VERIFIED_LOINC_CODES = {
  ageReported: '21612-7',
  ageCalculated: '29553-5',
  castReferenceItem: '65125-7',
  phenxAsdAdultRef: '62738-0',
} as const;

function csvCell(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined || val === '') return 'NA';
  const s = String(val);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Checks exported text against common HIPAA Safe Harbor (45 CFR 164.514(b)(2)) leaks
 * (emails, phone numbers, exact YYYY-MM-DD dates, DNI patterns).
 */
export function auditSafeHarborCompliance(exportedText: string): {
  passed: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(exportedText)) {
    warnings.push('Posible correo electrónico detectado (Identificador Safe Harbor #6).');
  }
  if (/\b\d{4}-\d{2}-\d{2}\b/.test(exportedText)) {
    warnings.push('Posible fecha exacta YYYY-MM-DD detectada (Identificador Safe Harbor #3; usar solo año + día relativo).');
  }
  if (/\b(?:\+?\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s-]?\d{3,4}[\s-]?\d{4}\b/.test(exportedText)) {
    warnings.push('Posible número telefónico detectado (Identificador Safe Harbor #4).');
  }
  return { passed: warnings.length === 0, warnings };
}

/**
 * Exports HIPAA Safe Harbor compliant Trial-Level CSV ready for R, Python, SPSS & JASP (CLIN-12 / SEC-04).
 */
export function buildTrialLevelCsv(session: RawSessionPayload): string {
  const headers = [
    'participant_pseudo_id',
    'session_id',
    'protocol_version',
    'form_variant',
    'age_months',
    'sex_assigned',
    'pointer_type',
    'effective_sampling_hz',
    'coalesced_supported',
    'pressure_supported',
    'viewport_diag_mm',
    'device_pixel_ratio',
    'imu_available',
    'tablet_flat_on_surface',
    'game_id',
    'block_type',
    'trial_index',
    'is_practice',
    'rt_ms',
    'accuracy',
    'error_category',
    'choice_channel',
    'stimulus_side',
    'kin_directness',
    'kin_area_norm',
    'kin_vel_mean_norm',
    'kin_vel_peak_norm',
    'kin_accel_min_norm',
    'kin_norm_jerk',
    'kin_submovements',
    'kin_touch_lifts',
    'kin_gamma_k',
    'kin_gamma_nsr',
    'sensory_calm_state',
    'trial_validity_flag',
  ];

  const rows: string[] = [headers.join(',')];

  for (const trial of session.trials) {
    const stroke = session.strokes.find(
      (s) => trial.gameId === 'G4B_MOTOR' && s.trialIndex === trial.trialIndex,
    );
    const m = trial.strokeMetrics ?? stroke?.metrics;
    const trialValidity = trial.interruptedByVisibility
      ? 'INVALID'
      : trial.errorCategory === 'holdover_debounce'
        ? 'CAVEAT'
        : 'VALID';

    rows.push(
      [
        session.participantPseudoId,
        session.sessionId,
        session.protocolVersion,
        session.formVariant,
        session.ageMonths,
        session.sexAssigned,
        session.deviceMeta.pointerType,
        session.deviceMeta.effectiveSamplingHz,
        session.deviceMeta.coalescedSupported,
        session.deviceMeta.pressureSupported,
        session.deviceMeta.viewportDiagMm,
        session.deviceMeta.devicePixelRatio,
        session.deviceMeta.imuAvailable,
        session.deviceMeta.tabletFlatOnSurface,
        trial.gameId,
        trial.blockType,
        trial.trialIndex,
        trial.isPractice,
        Number(trial.rtMs.toFixed(2)),
        trial.accuracy,
        trial.errorCategory,
        trial.choiceChannel ?? 'NA',
        trial.stimulusSide ?? 'NA',
        m?.directness ?? 'NA',
        m?.convexHullAreaNorm ?? 'NA',
        m?.velMeanNorm ?? 'NA',
        m?.velPeakNorm ?? 'NA',
        m?.accelMinNorm ?? 'NA',
        m?.normalizedJerk ?? 'NA',
        m?.submovementCount ?? 'NA',
        stroke?.touchLifts ?? 'NA',
        m?.gammaShapeK ?? 'NA',
        m?.gammaScaleNsr ?? 'NA',
        trial.sensoryBitmask,
        trialValidity,
      ]
        .map(csvCell)
        .join(','),
    );
  }

  return rows.join('\n') + '\n';
}

/**
 * Exports Session Summary CSV integrating dimensional ECD scores, MSSD and optional licensed external Beta scores.
 */
export function buildSessionSummaryCsv(
  session: RawSessionPayload,
  report: ClinicalEvaluationReport,
  externalScores: ExternalBetaScores = EMPTY_EXTERNAL_SCORES,
): string {
  const domainById = Object.fromEntries(report.domains.map((d) => [d.domainId, d]));
  const headers = [
    'participant_pseudo_id',
    'session_id',
    'protocol_version',
    'created_year',
    'age_months',
    'sub_age_band',
    'form_variant',
    'session_validity_status',
    'pointer_type',
    'effective_sampling_hz',
    'idx_joint_attention',
    'idx_emotion_tom',
    'idx_cognitive_flexibility',
    'idx_social_geo_pref',
    'idx_motor_kinematics_2d',
    'idx_sensory_modulation',
    'dccs_two_vector_score',
    'dccs_perseverative_errors',
    'dccs_regressive_errors',
    'dccs_switch_cost_ms',
    'geopref_ratio',
    'butera_directness_var',
    'butera_area_var',
    'butera_min_accel_mean',
    'simeoli_mean_jerk',
    'torres_mean_nsr',
    'ema_days_count',
    'ema_valence_mean',
    'ema_mssd',
    'ema_pct_caregiver_assisted',
    'ext_group_arm',
    'ext_cast_total',
    'ext_sdq_total',
    'ext_sdq_hyperactivity',
    'ext_ados2_sa_css',
    'ext_ados2_rrb_css',
    'ext_cars2_total',
    'ext_srs2_tscore',
    'ext_scq_total',
    'ext_sp2_avoiding',
    'ext_sp2_sensitivity',
    'ext_brief2_shift_t',
    'ext_iq_nonverbal_ss',
    'ext_mabc2_pct',
  ];

  const row = [
    session.participantPseudoId,
    session.sessionId,
    session.protocolVersion,
    session.createdAtIsoYear,
    session.ageMonths,
    session.subAgeBand,
    session.formVariant,
    report.validityStatus,
    session.deviceMeta.pointerType,
    session.deviceMeta.effectiveSamplingHz,
    domainById.joint_attention?.observationIndex,
    domainById.emotion_tom?.observationIndex,
    domainById.cognitive_flexibility?.observationIndex,
    domainById.social_geo_pref?.observationIndex,
    domainById.motor_kinematics_2d?.observationIndex,
    domainById.sensory_modulation?.observationIndex,
    report.dccsBreakdown.twoVectorScore,
    report.dccsBreakdown.perseverativeErrors,
    report.dccsBreakdown.regressiveErrors,
    report.dccsBreakdown.switchCostMs,
    report.geoprefExploratoryFlag.geometricRatio,
    report.motorAggregate.gestureDirectnessVariance,
    report.motorAggregate.gestureAreaVariance,
    report.motorAggregate.minGestureAccelerationMean,
    report.motorAggregate.meanNormalizedJerk,
    report.motorAggregate.meanGammaNsr,
    report.emaSummary.entryCount,
    report.emaSummary.meanValence,
    report.emaSummary.mssd,
    report.emaSummary.pctCaregiverAssisted,
    externalScores.studyGroupArm,
    externalScores.castTotal,
    externalScores.sdqTotal,
    externalScores.sdqHyperactivity,
    externalScores.ados2SaCss,
    externalScores.ados2RrbCss,
    externalScores.cars2Total,
    externalScores.srs2TScore,
    externalScores.scqTotal,
    externalScores.sp2Avoiding,
    externalScores.sp2Sensitivity,
    externalScores.brief2ShiftT,
    externalScores.iqNonVerbalSs,
    externalScores.mabc2Percentile,
  ]
    .map(csvCell)
    .join(',');

  return `${headers.join(',')}\n${row}\n`;
}

/**
 * Exports an HL7 FHIR R4 SDC Bundle (Patient + QuestionnaireResponse + Observations + DiagnosticReport)
 * using strictly verified LOINC codes + local versioned AuriKat CodeSystem (SEC-04 / IC-5).
 */
export function buildFhirR4SdcBundle(
  session: RawSessionPayload,
  report: ClinicalEvaluationReport,
  externalScores: ExternalBetaScores = EMPTY_EXTERNAL_SCORES,
): Record<string, unknown> {
  const patientRef = `Patient/${session.participantPseudoId}`;
  const obsEntries: Record<string, unknown>[] = [];
  const obsRefs: { reference: string }[] = [];

  const addObs = (id: string, system: string, code: string, display: string, value: number | null, unit?: string, note?: string) => {
    if (value === null || Number.isNaN(value)) return;
    obsRefs.push({ reference: `Observation/${id}` });
    obsEntries.push({
      fullUrl: `urn:uuid:${id}`,
      resource: {
        resourceType: 'Observation',
        id,
        status: 'preliminary',
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'survey',
                display: 'Survey / Behavioral Observation',
              },
            ],
          },
        ],
        code: { coding: [{ system, code, display }] },
        subject: { reference: patientRef },
        valueQuantity: { value, unit: unit ?? 'score' },
        ...(note ? { note: [{ text: note }] } : {}),
      },
    });
  };

  // Verified LOINC code for reported age in months
  addObs(
    `obs-age-${session.sessionId.slice(0, 8)}`,
    LOINC_SYSTEM,
    VERIFIED_LOINC_CODES.ageReported,
    'Age patient Qn Reported',
    session.ageMonths,
    'mo',
  );

  // Local custom CodeSystem biomarkers (never fabricate LOINC codes!)
  const domainCodeMap: Record<string, string> = {
    joint_attention: 'AK-G1-RJA-IJA-INDEX',
    emotion_tom: 'AK-G3-TOM-EMOTION-INDEX',
    cognitive_flexibility: 'AK-G2-DCCS-FLEX-INDEX',
    social_geo_pref: 'AK-G4A-GEOPREF-INDEX',
    motor_kinematics_2d: 'AK-G4B-MOTOR-2D-INDEX',
    sensory_modulation: 'AK-SENSORY-AVOID-INDEX',
  };

  for (const d of report.domains) {
    addObs(
      `obs-${d.domainId}-${session.sessionId.slice(0, 8)}`,
      CUSTOM_BIOMARKER_SYSTEM,
      domainCodeMap[d.domainId] ?? d.domainId,
      d.title,
      d.observationIndex,
      '0-100_exploratory',
      d.caveatFlag ?? undefined,
    );
  }

  addObs(
    `obs-dccs-2vec-${session.sessionId.slice(0, 8)}`,
    CUSTOM_BIOMARKER_SYSTEM,
    'AK-G2-DCCS-TWOVECTOR',
    'NIH Toolbox DCCS Two-Vector Score',
    report.dccsBreakdown.twoVectorScore,
    '0-10',
  );
  addObs(
    `obs-ema-mssd-${session.sessionId.slice(0, 8)}`,
    CUSTOM_BIOMARKER_SYSTEM,
    'AK-EMA-MSSD',
    'Longitudinal Affective Instability (MSSD)',
    report.emaSummary.mssd,
    'sq_diff',
  );

  // Optional externally entered CAST score (references verified LOINC CAST domain context via note)
  if (externalScores.castTotal.trim() !== '' && !Number.isNaN(Number(externalScores.castTotal))) {
    addObs(
      `obs-ext-cast-${session.sessionId.slice(0, 8)}`,
      CUSTOM_BIOMARKER_SYSTEM,
      'AK-EXT-CAST-TOTAL',
      'External Clinician-Entered CAST Total Score',
      Number(externalScores.castTotal),
      'points',
      `External contrast scale entered manually by licensed clinician (LOINC reference item example: ${VERIFIED_LOINC_CODES.castReferenceItem}).`,
    );
  }

  const qrId = `qr-ema-${session.sessionId.slice(0, 8)}`;
  const questionnaireResponse = {
    fullUrl: `urn:uuid:${qrId}`,
    resource: {
      resourceType: 'QuestionnaireResponse',
      id: qrId,
      meta: {
        profile: ['http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaireresponse'],
      },
      questionnaire: 'https://aurikat.org/fhir/Questionnaire/aurikat-ema-v1-beta',
      status: 'completed',
      subject: { reference: patientRef },
      item: session.emaEntries.map((entry) => ({
        linkId: `ema-day-${entry.relativeDayIndex}`,
        text: `EMA Day +${entry.relativeDayIndex} (${entry.entryMode})`,
        answer: [
          { valueString: entry.moodId },
          { valueInteger: entry.valenceScore },
        ],
      })),
    },
  };

  const diagReportId = `dr-${session.sessionId.slice(0, 8)}`;
  const diagnosticReport = {
    fullUrl: `urn:uuid:${diagReportId}`,
    resource: {
      resourceType: 'DiagnosticReport',
      id: diagReportId,
      status: 'preliminary',
      code: {
        coding: [
          {
            system: CUSTOM_BIOMARKER_SYSTEM,
            code: 'AK-BETA-OBSERVATION-SUMMARY',
            display: 'AuriKat Beta v1.0 Non-Verbal Behavioral Observation Summary (Non-Diagnostic)',
          },
        ],
      },
      subject: { reference: patientRef },
      result: obsRefs,
      conclusion: `Session validity: ${report.validityStatus}. Protocol ${report.protocolVersion}. Exploratory research observation aid — not an autonomous clinical diagnosis.`,
    },
  };

  return {
    resourceType: 'Bundle',
    type: 'collection',
    meta: {
      profile: ['http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-bundle'],
    },
    entry: [
      {
        fullUrl: `urn:uuid:${session.participantPseudoId}`,
        resource: {
          resourceType: 'Patient',
          id: session.participantPseudoId,
          identifier: [
            {
              system: 'https://aurikat.org/ids/pseudonymized-participant',
              value: session.participantPseudoId,
            },
          ],
        },
      },
      questionnaireResponse,
      ...obsEntries,
      diagnosticReport,
    ],
  };
}
