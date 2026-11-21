import React, { useMemo } from 'react';
import type { RawSessionPayload } from '@aurikat/core-engine';
import {
  auditSafeHarborCompliance,
  buildFhirR4SdcBundle,
  buildSessionSummaryCsv,
  buildTrialLevelCsv,
  PSYCHOMETRIC_SCALE_ROADMAP,
  type ClinicalEvaluationReport,
  type ExternalBetaScores,
} from '@aurikat/clinical-scoring';

interface BetaValidationPanelProps {
  session: RawSessionPayload;
  report: ClinicalEvaluationReport;
  externalScores: ExternalBetaScores;
  onChangeExternalScores: (next: ExternalBetaScores) => void;
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Beta 4-8y Empirical Validation Panel (CLIN-10 / CLIN-12 / SEC-04):
 * Prioritizes free/accessible contrast scales (CAST + SDQ) + licensed clinical scales
 * (ADOS-2, CARS-2, SRS-2, SCQ, SP-2, BRIEF-2/P, Raven/K-BIT, MABC-2).
 * Zero copyrighted scale items stored or copied.
 */
export const BetaValidationPanel: React.FC<BetaValidationPanelProps> = ({
  session,
  report,
  externalScores,
  onChangeExternalScores,
}) => {
  const trialCsv = useMemo(() => buildTrialLevelCsv(session), [session]);
  const summaryCsv = useMemo(
    () => buildSessionSummaryCsv(session, report, externalScores),
    [session, report, externalScores],
  );
  const safeHarborTrial = useMemo(() => auditSafeHarborCompliance(trialCsv), [trialCsv]);
  const safeHarborSummary = useMemo(() => auditSafeHarborCompliance(summaryCsv), [summaryCsv]);

  const setField = <K extends keyof ExternalBetaScores>(key: K, val: ExternalBetaScores[K]) => {
    onChangeExternalScores({ ...externalScores, [key]: val });
  };

  const safeId = session.participantPseudoId.replace(/[^A-Za-z0-9_-]/g, '') || 'caso';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="cl-banner">
        <strong>Protocolo de Validación Empírica Beta (4–8 años · COSMIN + STARD 2015 + TRIPOD+AI):</strong> Los
        puntajes externos ingresados aquí corresponden a administraciones independientes realizadas por profesionales
        licenciados. AuriKat jamás almacena ni reproduce ítems con derechos de autor. M-CHAT-R/F (16–30m) y STAT
        (24–36m) fueron relocalizados a la futura Banda 1 (2–5 años).
      </div>

      {/* Group Arm + Free/Accessible Priority Scales (CAST + SDQ) */}
      <div className="cl-card" style={{ boxShadow: 'none' }}>
        <h3>1. Brazo de Estudio y Núcleo Accesible / Gratuito (Argentina Beta 0–1)</h3>
        <div className="cl-grid-3">
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>Brazo / Grupo Clínico</label>
            <select
              className="cl-input"
              value={externalScores.studyGroupArm}
              onChange={(e) => setField('studyGroupArm', e.target.value as ExternalBetaScores['studyGroupArm'])}
            >
              <option value="">Sin asignar</option>
              <option value="ASD_pure">TEA puro</option>
              <option value="ASD_ADHD">TEA + TDAH</option>
              <option value="Clinical_Control">Control Clínico (TDAH / DCD / TL)</option>
              <option value="TD">Desarrollo Típico (DT)</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>CAST Total (4–11a · Gratuita, 0–31)</label>
            <input
              type="number"
              className="cl-input"
              value={externalScores.castTotal}
              onChange={(e) => setField('castTotal', e.target.value)}
              placeholder="Ej. 15"
            />
          </div>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>SDQ Total / Hiperactividad (Gratuita papel)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number"
                className="cl-input"
                value={externalScores.sdqTotal}
                onChange={(e) => setField('sdqTotal', e.target.value)}
                placeholder="Total"
              />
              <input
                type="number"
                className="cl-input"
                value={externalScores.sdqHyperactivity}
                onChange={(e) => setField('sdqHyperactivity', e.target.value)}
                placeholder="Hiperact."
              />
            </div>
          </div>
        </div>
      </div>

      {/* Licensed Clinical Contrast & Confounder Covariates */}
      <div className="cl-card" style={{ boxShadow: 'none' }}>
        <h3>2. Criterios Clínicos Especializados y Covariables de Control (4–8 años)</h3>
        <div className="cl-grid-3">
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>ADOS-2 SA-CSS (1–10)</label>
            <input
              type="number"
              className="cl-input"
              value={externalScores.ados2SaCss}
              onChange={(e) => setField('ados2SaCss', e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>ADOS-2 RRB-CSS (1–10)</label>
            <input
              type="number"
              className="cl-input"
              value={externalScores.ados2RrbCss}
              onChange={(e) => setField('ados2RrbCss', e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>CARS-2 Total (ST / HF)</label>
            <input
              type="number"
              className="cl-input"
              value={externalScores.cars2Total}
              onChange={(e) => setField('cars2Total', e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>SRS-2 T-Score Total</label>
            <input
              type="number"
              className="cl-input"
              value={externalScores.srs2TScore}
              onChange={(e) => setField('srs2TScore', e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>SCQ Total (≥4 años, corte 15)</label>
            <input
              type="number"
              className="cl-input"
              value={externalScores.scqTotal}
              onChange={(e) => setField('scqTotal', e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>BRIEF-2 / BRIEF-P Shift (T-Score)</label>
            <input
              type="number"
              className="cl-input"
              value={externalScores.brief2ShiftT}
              onChange={(e) => setField('brief2ShiftT', e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>Sensory Profile 2 (Avoiding / Sensitivity)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number"
                className="cl-input"
                value={externalScores.sp2Avoiding}
                onChange={(e) => setField('sp2Avoiding', e.target.value)}
                placeholder="Avoiding"
              />
              <input
                type="number"
                className="cl-input"
                value={externalScores.sp2Sensitivity}
                onChange={(e) => setField('sp2Sensitivity', e.target.value)}
                placeholder="Sensit."
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>CI No Verbal (Raven / K-BIT / Leiter-3)</label>
            <input
              type="number"
              className="cl-input"
              value={externalScores.iqNonVerbalSs}
              onChange={(e) => setField('iqNonVerbalSs', e.target.value)}
              placeholder="Puntaje estándar"
            />
          </div>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>MABC-2 Percentil (Control DCD)</label>
            <input
              type="number"
              className="cl-input"
              value={externalScores.mabc2Percentile}
              onChange={(e) => setField('mabc2Percentile', e.target.value)}
              placeholder="Percentil 1–99"
            />
          </div>
        </div>
      </div>

      {/* Export Controls + Safe Harbor Verification */}
      <div className="cl-card" style={{ boxShadow: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h3>3. Exportación Estadística e Interoperabilidad Clínica</h3>
          <span className="cl-badge" data-tone={safeHarborTrial.passed && safeHarborSummary.passed ? undefined : 'warn'}>
            {safeHarborTrial.passed && safeHarborSummary.passed
              ? '✓ Verificado HIPAA Safe Harbor (18 identificadores)'
              : '⚠ Revisar posibles identificadores'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="cl-btn cl-btn-primary"
            onClick={() => downloadFile(trialCsv, `aurikat_trials_${safeId}.csv`, 'text/csv;charset=utf-8')}
          >
            Descargar CSV Trial-Level ({session.trials.length} ensayos)
          </button>
          <button
            type="button"
            className="cl-btn"
            onClick={() => downloadFile(summaryCsv, `aurikat_session_summary_${safeId}.csv`, 'text/csv;charset=utf-8')}
          >
            Descargar CSV Resumen + Escalas Externas
          </button>
          <button
            type="button"
            className="cl-btn"
            onClick={() => {
              const bundle = buildFhirR4SdcBundle(session, report, externalScores);
              downloadFile(
                JSON.stringify(bundle, null, 2),
                `aurikat_fhir_r4_sdc_${safeId}.json`,
                'application/fhir+json;charset=utf-8',
              );
            }}
          >
            Exportar Bundle HL7 FHIR R4 SDC (.json)
          </button>
        </div>
      </div>

      {/* Staged Scale Roadmap Reference */}
      <div className="cl-card" style={{ boxShadow: 'none' }}>
        <h3>Hoja de Ruta de Escalas Curadas Manualmente (2–5 / 4–8 / 6–11 / 12+)</h3>
        <table className="cl-table">
          <thead>
            <tr>
              <th>Banda</th>
              <th>Instrumento</th>
              <th>Rango</th>
              <th>Propiedad Intelectual</th>
              <th>Rol en AuriKat</th>
            </tr>
          </thead>
          <tbody>
            {PSYCHOMETRIC_SCALE_ROADMAP.map((item) => (
              <tr key={item.scaleName}>
                <td className="cl-mono">{item.band}</td>
                <td><strong>{item.scaleName}</strong></td>
                <td>{item.ageRange}</td>
                <td>{item.licenseStatus}</td>
                <td>{item.roleInAuriKat}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
