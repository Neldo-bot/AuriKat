import React from 'react';
import type { ClinicalEvaluationReport } from '@aurikat/clinical-scoring';

interface ClinicalInterpretationGuideProps {
  report: ClinicalEvaluationReport;
}

/**
 * ClinicalInterpretationGuide — Helps the clinical psychologist / psychiatrist interpret
 * the child's session through:
 * 1) Game 4A Breakdown (Sensory Profile 2 + CAST + SRS-2 everyday choices)
 * 2) Game 4B Breakdown (Navon Local-Global Perceptual Style + 3x3 Detail Search CEFT)
 * 3) Actionable Clinical Synthesis (Strengths, Hypotheses, Suggested External Scales, Caregiver Interview Prompts)
 */
export const ClinicalInterpretationGuide: React.FC<ClinicalInterpretationGuideProps> = ({
  report,
}) => {
  const { sensorySocialBreakdown: ss, detailNavonBreakdown: dn, clinicalGuide: guide } = report;

  const pctBar = (ratio: number | null, label: string, subnote: string) => {
    const pct = ratio !== null ? Math.round(ratio * 100) : null;
    return (
      <div className="cl-metric-box" style={{ gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontWeight: 700, color: 'var(--cl-ink)' }}>{label}</span>
          <strong className="cl-mono" style={{ fontSize: '1.1rem' }}>
            {pct !== null ? `${pct}%` : 'Sin datos'}
          </strong>
        </div>
        <div
          style={{
            width: '100%',
            height: 8,
            borderRadius: 99,
            background: '#E3EAE5',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${pct ?? 0}%`,
              height: '100%',
              background: pct !== null && pct >= 65 ? '#A98133' : 'var(--cl-accent)',
            }}
          />
        </div>
        <span style={{ fontSize: '0.76rem', color: 'var(--cl-ink-muted)' }}>{subnote}</span>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* SECTION 1: NEW GAME 4 PROTOTYPES INTERPRETATION (4A & 4B) */}
      <div className="cl-grid-2">
        {/* Card 4A: Sensory & Social Day (SP-2 + CAST + SRS-2) */}
        <div className="cl-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <h3 style={{ margin: 0 }}>🌈 Juego 4A · El Día de AuriKat (SP-2 · CAST · SRS-2)</h3>
            <span className="cl-badge">
              {ss.totalScoredScenes > 0 ? `${ss.totalScoredScenes} escenas` : 'No administrado'}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--cl-ink-muted)' }}>
            Transforma ítems de modulación sensorial cotidiana (Dunn SP-2), motivación social/orden (CAST / SRS-2) e
            invarianza de rutina (DSM-5-TR B.2) en elecciones visuales de 1 toque con el compañero.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pctBar(
              ss.sensoryCalmAvoidingRatio,
              'Preferencia Baja Carga Sensorial (SP-2 Avoiding / Sensitivity)',
              'Elección de silencio/auriculares, luz tibia, ropa sin etiquetas y movimiento suave.',
            )}
            {pctBar(
              ss.solitaryOrderPlayRatio,
              'Preferencia por Juego Individual Ordenado (CAST / SRS-2)',
              'Elección de ordenar bloques por color o rincón calmo frente a ronda grupal.',
            )}
            {pctBar(
              ss.routineSamenessRatio,
              'Preferencia por Rutina Predecible (BRIEF-2 Shift / B.2)',
              'Elección del camino conocido y plato separado frente a cambios sorpresivos.',
            )}
          </div>

          {ss.channelDecisions.length > 0 && (
            <details style={{ fontSize: '0.82rem' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700, color: 'var(--cl-accent)' }}>
                Ver desglose escena por escena ({ss.channelDecisions.length})
              </summary>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ss.channelDecisions.map((d, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      background: '#F4F7F5',
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <span>
                      <strong>{d.channelLabel}:</strong> {d.chosenLabel}
                    </span>
                    <span className="cl-mono" style={{ whiteSpace: 'nowrap' }}>
                      {d.rtMs} ms
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        {/* Card 4B: Detective de Detalles (Navon Local vs. Global + Visual Search CEFT) */}
        <div className="cl-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <h3 style={{ margin: 0 }}>🔎 Juego 4B · Detective de Detalles (Navon · CEFT)</h3>
            <span className="cl-badge">
              {dn.navonTotalChoices + dn.detailSearchTotalAttempts > 0
                ? dn.perceptualStyleLabel.split('(')[0].trim()
                : 'No administrado'}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--cl-ink-muted)' }}>
            Evalúa el balance entre procesamiento perceptivo local vs. global (figuras jerárquicas de Navon) y la
            velocidad de detección de detalles incrustados en grillas 3×3 (paradigma CEFT / Coherencia Central).
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pctBar(
              dn.localPreferenceRatio,
              'Preferencia por Componentes Locales (Navon)',
              'Porcentaje de figuras compuestas donde priorizó las piezas pequeñas sobre la silueta global.',
            )}
            {pctBar(
              dn.detailSearchAccuracy,
              'Efectividad en Búsqueda Visual de Detalles (Grilla 3×3)',
              dn.detailSearchMedianRtMs !== null
                ? `Tiempo mediano de hallazgo: ${Math.round(dn.detailSearchMedianRtMs)} ms (${dn.detailSearchHits} aciertos en ${dn.detailSearchTotalAttempts} toques).`
                : 'Sin tableros 3×3 registrados.',
            )}
          </div>

          <div className="cl-banner" style={{ fontSize: '0.82rem' }}>
            <strong>Síntesis Perceptiva (Enfoque Neuroafirmativo):</strong> {dn.perceptualStyleLabel}.{' '}
            {dn.clinicalSummaryText}
          </div>
        </div>
      </div>

      {/* SECTION 2: ACTIONABLE CLINICAL INTERPRETATION GUIDE FOR THE PSYCHOLOGIST */}
      <div className="cl-card" style={{ borderColor: 'var(--cl-accent)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ margin: 0 }}>
            🩺 Guía de Interpretación Clínica Asistida (Asistente para Entrevista y Triangulación)
          </h3>
          <span className="cl-badge">Reglas ECD Deterministas · Auditable (FDA CDS Criterio 4)</span>
        </div>

        <div className="cl-grid-2">
          <div className="cl-metric-box" style={{ background: '#F3F8F5' }}>
            <strong style={{ color: 'var(--cl-accent)', fontSize: '0.92rem' }}>
              🌟 1. Fortalezas y Recursos Conservados (CIF-IA)
            </strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: '0.85rem', lineHeight: 1.5 }}>
              {guide.strengths.map((s, i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  {s}
                </li>
              ))}
            </ul>
          </div>

          <div className="cl-metric-box" style={{ background: '#FBF8F1' }}>
            <strong style={{ color: '#7D5E1F', fontSize: '0.92rem' }}>
              🔍 2. Hipótesis Clínicas a Explorar en Observación Directa
            </strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: '0.85rem', lineHeight: 1.5 }}>
              {guide.clinicalHypothesesToExplore.map((h, i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  {h}
                </li>
              ))}
            </ul>
          </div>

          <div className="cl-metric-box">
            <strong style={{ color: 'var(--cl-ink)', fontSize: '0.92rem' }}>
              💬 3. Preguntas Sugeridas para Entrevista a Padres / Cuidadores
            </strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: '0.85rem', lineHeight: 1.5 }}>
              {guide.caregiverInterviewPrompts.map((p, i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  <em>«{p}»</em>
                </li>
              ))}
            </ul>
          </div>

          <div className="cl-metric-box">
            <strong style={{ color: 'var(--cl-ink)', fontSize: '0.92rem' }}>
              📋 4. Instrumentos Estandarizados Sugeridos para Contrastar
            </strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {guide.suggestedExternalScales.map((sc, i) => (
                <span key={i} className="cl-badge" style={{ fontSize: '0.8rem' }}>
                  {sc}
                </span>
              ))}
            </div>
            <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: 'var(--cl-ink-muted)' }}>
              Podés cargar los puntajes obtenidos en papel o plataforma oficial dentro de la pestaña{' '}
              <strong>«Validación Beta (CSV / FHIR)»</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
