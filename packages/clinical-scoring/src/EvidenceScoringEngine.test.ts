import { describe, expect, it } from 'vitest';
import {
  auditSafeHarborCompliance,
  buildFhirR4SdcBundle,
  buildSessionSummaryCsv,
  buildTrialLevelCsv,
  EMPTY_EXTERNAL_SCORES,
  evaluateClinicalSession,
  getDemoClinicalCases,
  VERIFIED_LOINC_CODES,
} from './index.js';

describe('EvidenceScoringEngine & ClinicalExporters (CLIN-02 / CLIN-12 / SEC-04)', () => {
  const demos = getDemoClinicalCases();
  const typical = demos[0].session;
  const priority = demos[1].session;
  const indeterminate = demos[2].session;

  it('scores balanced profile as VALID with low observation indices and high DCCS two-vector score', () => {
    const report = evaluateClinicalSession(typical);
    expect(report.validityStatus).toBe('VALID');
    expect(report.dccsBreakdown.twoVectorScore).toBeGreaterThan(7.5);
    expect(report.dccsBreakdown.perseverativeErrors).toBe(0);
    expect(report.dccsBreakdown.regressiveErrors).toBe(0);
    expect(report.emaSummary.mssd).toBeLessThan(1.5);
    expect(report.geoprefExploratoryFlag.highSpecificityAlert).toBe(false);
    const ja = report.domains.find((d) => d.domainId === 'joint_attention')!;
    expect(ja.observationIndex).not.toBeNull();
    expect(ja.observationIndex!).toBeLessThan(30);
    expect(ja.evidenceTrace.length).toBeGreaterThanOrEqual(3);
  });

  it('captures high perseveration, regressive errors, GeoPref ASDGeo alert, motor variance and higher MSSD on priority case', () => {
    const report = evaluateClinicalSession(priority);
    expect(report.validityStatus).toBe('VALID');
    expect(report.dccsBreakdown.perseverativeErrors).toBeGreaterThanOrEqual(3);
    expect(report.dccsBreakdown.regressiveErrors).toBeGreaterThanOrEqual(3);
    expect(report.geoprefExploratoryFlag.highSpecificityAlert).toBe(true);
    expect(report.motorAggregate.rhythmicTappingDetected).toBe(true);
    expect(report.emaSummary.mssd).toBeGreaterThan(5);
    const flex = report.domains.find((d) => d.domainId === 'cognitive_flexibility')!;
    expect(flex.observationIndex!).toBeGreaterThan(55);
  });

  it('emits INDETERMINATE and nullifies ALL dimensional indices on incomplete / anticipatory sessions', () => {
    const report = evaluateClinicalSession(indeterminate);
    expect(report.validityStatus).toBe('INDETERMINATE');
    expect(report.validityReasons.length).toBeGreaterThanOrEqual(1);
    for (const d of report.domains) {
      expect(d.observationIndex).toBeNull();
      expect(d.uncertaintyHalfWidth).toBeNull();
    }
  });

  it('exports Safe Harbor compliant Trial-Level CSV, Summary CSV and valid HL7 FHIR R4 SDC Bundle', () => {
    const report = evaluateClinicalSession(typical);
    const trialCsv = buildTrialLevelCsv(typical);
    const summaryCsv = buildSessionSummaryCsv(typical, report, {
      ...EMPTY_EXTERNAL_SCORES,
      studyGroupArm: 'TD',
      castTotal: '6',
      sdqTotal: '8',
    });

    expect(trialCsv).toContain('participant_pseudo_id');
    expect(trialCsv).toContain('kin_gamma_nsr');
    expect(summaryCsv).toContain('ext_cast_total');
    expect(summaryCsv).not.toContain('mchat');
    expect(auditSafeHarborCompliance(trialCsv).passed).toBe(true);
    expect(auditSafeHarborCompliance(summaryCsv).passed).toBe(true);

    const fhir = buildFhirR4SdcBundle(typical, report, { ...EMPTY_EXTERNAL_SCORES, castTotal: '6' });
    expect(fhir.resourceType).toBe('Bundle');
    const serialized = JSON.stringify(fhir);
    expect(serialized).toContain(VERIFIED_LOINC_CODES.ageReported);
    expect(serialized).toContain('https://aurikat.org/fhir/CodeSystem/aurikat-biomarkers-v1');
    expect(serialized).toContain('QuestionnaireResponse');
    expect(serialized).toContain('DiagnosticReport');
  });
});
