import React, { useState } from 'react';
import type { DeviceTelemetryMeta, SessionMotorAggregate, StrokeRecord } from '@aurikat/core-engine';

interface KinematicsInspectorProps {
  strokes: StrokeRecord[];
  aggregate: SessionMotorAggregate;
  deviceMeta: DeviceTelemetryMeta;
}

/**
 * KinematicsInspector (CLIN-07 / IC-2):
 * Visualizes actual child trajectories colored by instantaneous velocity,
 * displays all Simeoli / Butera (3 touch-only) / Torres Gamma-NSR indicators,
 * device metadata, and the mandatory ASD vs. DCD (71%) differential warning.
 */
export const KinematicsInspector: React.FC<KinematicsInspectorProps> = ({
  strokes,
  aggregate,
  deviceMeta,
}) => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const active = strokes[selectedIdx] ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Mandatory ASD vs DCD differential warning (Butera et al., 2025 PMC11802596) */}
      <div className="cl-banner" data-tone="gold">
        <strong>Advertencia Diferencial TEA vs. DCD (Butera et al., 2025):</strong> La cinemática motora táctil
        presenta solapamiento significativo entre TEA y Trastorno del Desarrollo de la Coordinación (71% precisión
        diferencial TEA vs. DCD; 57% en 3 clases). Interpretar siempre junto a destreza motora basal (MABC-2) y
        ejes socio-comunicativos.
      </div>

      {/* Hardware & Preprocessing Audit Row (IC-2) */}
      <div className="cl-grid-3">
        <div className="cl-metric-box">
          <span>Modalidad y Muestreo Efectivo</span>
          <strong>
            {deviceMeta.pointerType.toUpperCase()} · {deviceMeta.effectiveSamplingHz} Hz
          </strong>
          <span>
            Coalesced: {deviceMeta.coalescedSupported ? 'Sí' : 'No (fallback)'} | Presión real:{' '}
            {deviceMeta.pressureSupported ? 'Sí' : 'No (0.5 constante)'}
          </span>
        </div>
        <div className="cl-metric-box">
          <span>Preprocesamiento IC-2</span>
          <strong>60 Hz + Savitzky-Golay</strong>
          <span>
            IMU: {deviceMeta.imuAvailable ? 'Disponible' : 'Touch-only'} | Postura: {deviceMeta.tabletFlatOnSurface}
          </span>
        </div>
        <div className="cl-metric-box">
          <span>Repetición Táctil Rítmica</span>
          <strong>{aggregate.rhythmicTappingDetected ? 'Patrón detectado' : 'No detectado'}</strong>
          <span>
            CV intervalos: {aggregate.rhythmicTapCv !== null ? aggregate.rhythmicTapCv.toFixed(3) : 'N/A'} (umbral &lt;0.15)
          </span>
        </div>
      </div>

      {/* Butera 2025 Touch-Only Triad + Simeoli + Torres Aggregates */}
      <div className="cl-grid-3">
        <div className="cl-metric-box">
          <span>Var. Rectitud (Butera #1)</span>
          <strong className="cl-mono">{aggregate.gestureDirectnessVariance.toFixed(5)}</strong>
          <span>Rectitud media: {aggregate.meanDirectness.toFixed(3)}</span>
        </div>
        <div className="cl-metric-box">
          <span>Var. Área Convexo (Butera #2)</span>
          <strong className="cl-mono">{aggregate.gestureAreaVariance.toExponential(2)}</strong>
          <span>Normalized Jerk medio: {aggregate.meanNormalizedJerk.toFixed(1)}</span>
        </div>
        <div className="cl-metric-box">
          <span>Accel. Mín. (Butera #3) &amp; Gamma NSR</span>
          <strong className="cl-mono">{aggregate.minGestureAccelerationMean.toFixed(2)}</strong>
          <span>Torres NSR medio: {aggregate.meanGammaNsr.toFixed(4)} | Lifts: {aggregate.totalTouchLifts}</span>
        </div>
      </div>

      {/* Interactive Stroke Trajectory Viewer */}
      {strokes.length === 0 ? (
        <div className="cl-banner">No se registraron trazos de arrastre en Juego 4B durante esta sesión.</div>
      ) : (
        <div className="cl-card" style={{ boxShadow: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <h3>Inspección Vectorial de Trazos Reales ({strokes.length} trazos)</h3>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {strokes.map((st, i) => (
                <button
                  key={st.strokeId}
                  type="button"
                  className="cl-btn"
                  style={{
                    padding: '6px 11px',
                    background: i === selectedIdx ? 'var(--cl-accent)' : undefined,
                    color: i === selectedIdx ? '#FCFDFB' : undefined,
                  }}
                  onClick={() => setSelectedIdx(i)}
                >
                  #{st.trialIndex}
                </button>
              ))}
            </div>
          </div>

          {active && (
            <div className="cl-grid-2" style={{ alignItems: 'center' }}>
              <svg
                viewBox={`0 0 ${active.canvasWidth} ${active.canvasHeight}`}
                style={{
                  width: '100%',
                  background: '#F3F4F0',
                  borderRadius: 12,
                  border: '1px solid var(--cl-border)',
                }}
              >
                {/* Ideal straight baseline */}
                <line
                  x1={active.startPoint.x}
                  y1={active.startPoint.y}
                  x2={active.targetPoint.x}
                  y2={active.targetPoint.y}
                  stroke="#BCC5BC"
                  strokeDasharray="6 6"
                  strokeWidth="2"
                />
                {/* Velocity-colored segments */}
                {active.samples.slice(1).map((pt, idx) => {
                  const prev = active.samples[idx];
                  const dt = Math.max(1, pt.t - prev.t);
                  const speedPxMs = Math.hypot(pt.x - prev.x, pt.y - prev.y) / dt;
                  const strokeCol =
                    speedPxMs > 1.2 ? '#A98133' : speedPxMs > 0.5 ? '#325D54' : '#5B85A8';
                  return (
                    <line
                      key={idx}
                      x1={prev.x}
                      y1={prev.y}
                      x2={pt.x}
                      y2={pt.y}
                      stroke={strokeCol}
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  );
                })}
                <circle cx={active.startPoint.x} cy={active.startPoint.y} r="7" fill="#5B85A8" />
                <circle cx={active.targetPoint.x} cy={active.targetPoint.y} r="9" fill="#325D54" />
              </svg>

              <table className="cl-table">
                <tbody>
                  <tr>
                    <th>Forma / Duración</th>
                    <td className="cl-mono">
                      {active.guideShape} · {active.metrics.durationMs} ms
                    </td>
                  </tr>
                  <tr>
                    <th>Rectitud / Error Final</th>
                    <td className="cl-mono">
                      D={active.metrics.directness} · Err={active.metrics.endpointErrorNorm}
                    </td>
                  </tr>
                  <tr>
                    <th>Vel. Media / Pico / t_pico</th>
                    <td className="cl-mono">
                      {active.metrics.velMeanNorm} / {active.metrics.velPeakNorm} (t={active.metrics.timeToPeakVelRatio})
                    </td>
                  </tr>
                  <tr>
                    <th>Normalized Jerk / Submov.</th>
                    <td className="cl-mono">
                      {active.metrics.normalizedJerk} · {active.metrics.submovementCount} picos
                    </td>
                  </tr>
                  <tr>
                    <th>Cambios &gt;15° / Pausas</th>
                    <td className="cl-mono">
                      {active.metrics.angularDirectionChanges} giros · {active.metrics.pauseCount} pausas ({active.metrics.pauseDurationMs} ms)
                    </td>
                  </tr>
                  <tr>
                    <th>Torres Gamma (k / NSR)</th>
                    <td className="cl-mono">
                      k={active.metrics.gammaShapeK} · NSR={active.metrics.gammaScaleNsr}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
