import React, { useState } from 'react';
import type { RawSessionPayload } from '@aurikat/core-engine';
import {
  DEONTOLOGICAL_NOTICE,
  type ClinicalEvaluationReport,
  type ExternalBetaScores,
} from '@aurikat/clinical-scoring';
import { DomainRadarChart } from './DomainRadarChart.js';

interface PrintableClinicalReportProps {
  session: RawSessionPayload;
  report: ClinicalEvaluationReport;
  externalScores: ExternalBetaScores;
}

/**
 * Structured A4 Clinical Observation Report aligned with UADE, FePRA, Ley 26.657,
 * APA Ethical Standard 9 (9.01, 9.02(b), 9.06, 9.09) and ANMAT Disp. 64/2025 Parte 3.
 */
export const PrintableClinicalReport: React.FC<PrintableClinicalReportProps> = ({
  session,
  report,
  externalScores,
}) => {
  const [clinicianName, setClinicianName] = useState('');
  const [clinicianLicense, setClinicianLicense] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="cl-no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <strong>Vista Previa de Informe Clínico A4</strong>
          <span style={{ display: 'block', fontSize: '0.84rem', color: 'var(--cl-ink-muted)' }}>
            Optimizado con reglas <code>@media print</code> (evita cortes de tablas y gráficos entre páginas).
          </span>
        </div>
        <button type="button" className="cl-btn cl-btn-primary" onClick={() => window.print()}>
          Imprimir / Guardar PDF A4
        </button>
      </div>

      {/* Section 1: Pseudonymized Header & Deontological Frame */}
      <div className="cl-card cl-print-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid var(--cl-accent)', paddingBottom: 10 }}>
          <div>
            <h2 style={{ margin: 0 }}>Informe de Observación Conductual Digital — AuriKat</h2>
            <small style={{ color: 'var(--cl-ink-muted)' }}>
              Protocolo {report.protocolVersion} · Forma Paralela {report.formVariant} · Uso Exclusivo Profesional
            </small>
          </div>
          <span className="cl-badge" data-tone={report.validityStatus === 'INDETERMINATE' ? 'warn' : report.validityStatus === 'VALID_WITH_CAVEATS' ? 'gold' : undefined}>
            Validez: {report.validityStatus}
          </span>
        </div>

        <div className="cl-grid-3">
          <div><strong>ID Pseudonimizado:</strong> <span className="cl-mono">{session.participantPseudoId}</span></div>
          <div><strong>Edad:</strong> {Math.floor(session.ageMonths / 12)} años, {session.ageMonths % 12} meses ({session.ageMonths} m)</div>
          <div><strong>Hardware:</strong> {session.deviceMeta.pointerType} · {session.deviceMeta.effectiveSamplingHz} Hz</div>
        </div>

        <div className="cl-banner" data-tone="gold" style={{ fontSize: '0.82rem' }}>
          <strong>AVISO DEONTOLÓGICO Y REGULATORIO OBLIGATORIO:</strong> {DEONTOLOGICAL_NOTICE.regulatoryStatus}{' '}
          {DEONTOLOGICAL_NOTICE.ethicsNotice}
        </div>
      </div>

      {/* Section 2: 6-Domain Dimensional Profile + Uncertainty */}
      <div className="cl-card cl-print-section">
        <h3>Perfil Dimensional Neuroafirmativo (6 Ejes)</h3>
        <div className="cl-grid-2" style={{ alignItems: 'center' }}>
          <DomainRadarChart domains={report.domains} validityStatus={report.validityStatus} size={290} />
          <table className="cl-table">
            <thead>
              <tr>
                <th>Dominio de Observación</th>
                <th>Índice (0–100)</th>
                <th>Ensayos</th>
              </tr>
            </thead>
            <tbody>
              {report.domains.map((d) => (
                <tr key={d.domainId}>
                  <td>
                    <strong>{d.shortTitle}</strong>
                    {d.caveatFlag ? (
                      <div style={{ fontSize: '0.76rem', color: 'var(--cl-ink-muted)' }}>{d.caveatFlag}</div>
                    ) : null}
                  </td>
                  <td className="cl-mono">
                    {d.observationIndex !== null ? `${d.observationIndex} ±${d.uncertaintyHalfWidth}` : 'Bloqueado / N/A'}
                  </td>
                  <td className="cl-mono">{d.validTrialCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: Evidence Trace Summary & Key Quantitative Biomarkers */}
      <div className="cl-card cl-print-section">
        <h3>Trazabilidad de Evidencia (Evidence Trace · FDA CDS Criterio 4)</h3>
        <table className="cl-table">
          <thead>
            <tr>
              <th>Dominio</th>
              <th>Indicador Auditado</th>
              <th>Valor Observado</th>
            </tr>
          </thead>
          <tbody>
            {report.domains.flatMap((d) =>
              d.evidenceTrace.map((t) => (
                <tr key={`${d.domainId}-${t.metricKey}`}>
                  <td><strong>{d.shortTitle}</strong></td>
                  <td>{t.label}</td>
                  <td className="cl-mono">{t.observedValue}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>

      {/* Section 4: EMA Summary & External Contrast Scores */}
      <div className="cl-card cl-print-section">
        <h3>Seguimiento EMA y Escalas Externas de Contraste</h3>
        <div className="cl-grid-2">
          <div>
            <strong>Resumen EMA Diario:</strong> {report.emaSummary.entryCount} registros · Valencia media:{' '}
            {report.emaSummary.meanValence ?? 'N/A'} · Inestabilidad MSSD:{' '}
            {report.emaSummary.mssd ?? 'N/A'} · Asistido por cuidador: {report.emaSummary.pctCaregiverAssisted}%.
          </div>
          <div>
            <strong>Escalas Externas Registradas:</strong> CAST={externalScores.castTotal || 'N/A'}, SDQ=
            {externalScores.sdqTotal || 'N/A'}, ADOS-2 SA/RRB={externalScores.ados2SaCss || 'N/A'}/
            {externalScores.ados2RrbCss || 'N/A'}, CARS-2={externalScores.cars2Total || 'N/A'}, SRS-2=
            {externalScores.srs2TScore || 'N/A'}, MABC-2={externalScores.mabc2Percentile || 'N/A'}%.
          </div>
        </div>
      </div>

      {/* Section 5: Clinician Integration & Signature Block (Ley 26.657 / FePRA / UADE) */}
      <div className="cl-card cl-print-section">
        <h3>Síntesis Clínica Interdisciplinaria y Firma Profesional</h3>
        <textarea
          className="cl-input"
          rows={4}
          value={clinicalNotes}
          onChange={(e) => setClinicalNotes(e.target.value)}
          placeholder="Observaciones clínicas cualitativas, fortalezas del niño, necesidades de apoyo y articulación interdisciplinaria (Ley 26.657)..."
        />
        <div className="cl-grid-2" style={{ marginTop: 10 }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Profesional Responsable</label>
            <input
              className="cl-input"
              value={clinicianName}
              onChange={(e) => setClinicianName(e.target.value)}
              placeholder="Lic. / Dr. Nombre y Apellido"
            />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Matrícula Profesional (MN / MP)</label>
            <input
              className="cl-input"
              value={clinicianLicense}
              onChange={(e) => setClinicianLicense(e.target.value)}
              placeholder="Ej. MN 00.000"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
