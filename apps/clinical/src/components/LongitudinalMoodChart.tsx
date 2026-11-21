import React from 'react';
import type { EmaEntry, SensoryAdjustmentEvent } from '@aurikat/core-engine';
import type { EmaLongitudinalSummary } from '@aurikat/clinical-scoring';

interface LongitudinalMoodChartProps {
  entries: EmaEntry[];
  summary: EmaLongitudinalSummary;
  sensoryAdjustments: SensoryAdjustmentEvent[];
}

const MOOD_LABELS: Record<EmaEntry['moodId'], string> = {
  sun_happy: 'Alegre (+2)',
  breeze_calm: 'Calmo (+1)',
  cloud_tired_sad: 'Triste / Cansado (-1)',
  mist_worried: 'Preocupado (-1)',
  storm_overwhelmed: 'Abrumado (-2)',
};

export const LongitudinalMoodChart: React.FC<LongitudinalMoodChartProps> = ({
  entries,
  summary,
  sensoryAdjustments,
}) => {
  const sorted = [...entries].sort((a, b) => a.relativeDayIndex - b.relativeDayIndex);

  const w = 640;
  const h = 210;
  const padX = 46;
  const padY = 26;
  const yFor = (val: number) => padY + ((2 - val) / 4) * (h - padY * 2);
  const xFor = (i: number) =>
    sorted.length <= 1 ? w / 2 : padX + (i / (sorted.length - 1)) * (w - padX * 2);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {summary.ageSoloCaveat && (
        <div className="cl-banner" data-tone="gold">
          <strong>Cautela EMA Pediátrico (&lt;7 años):</strong> El predominio de registros sin asistencia de cuidador
          (<code>child_solo</code>) en menores de 7 años reduce la fiabilidad del autorreporte retrospectivo (Charitos et al., JMIR 2026).
        </div>
      )}

      <div className="cl-grid-3">
        <div className="cl-metric-box">
          <span>Registros Longitudinales (EMA)</span>
          <strong>{summary.entryCount} días</strong>
          <span>Asistidos por adulto: {summary.pctCaregiverAssisted}%</span>
        </div>
        <div className="cl-metric-box">
          <span>Inestabilidad Afectiva (MSSD)</span>
          <strong className="cl-mono">{summary.mssd !== null ? summary.mssd.toFixed(2) : 'N/A'}</strong>
          <span>Media de valencia: {summary.meanValence !== null ? summary.meanValence : 'N/A'} (-2 a +2)</span>
        </div>
        <div className="cl-metric-box">
          <span>Regulación y Calma</span>
          <strong>{summary.calmBreathUses} respiraciones</strong>
          <span>
            Hábitos medios: {Math.round(summary.habitCompletionRate * 100)}% · Ajustes sensoriales:{' '}
            {sensoryAdjustments.length}
          </span>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="cl-banner">No hay registros diarios de «Mi Día con AuriKat» en este paquete.</div>
      ) : (
        <div className="cl-card" style={{ boxShadow: 'none' }}>
          <h3>Serie Temporal de Valencia Emocional</h3>
          <svg
            viewBox={`0 0 ${w} ${h}`}
            style={{ width: '100%', height: 'auto', background: '#F3F4F0', borderRadius: 12 }}
          >
            {[-2, -1, 0, 1, 2].map((lvl) => (
              <g key={lvl}>
                <line
                  x1={padX}
                  y1={yFor(lvl)}
                  x2={w - padX}
                  y2={yFor(lvl)}
                  stroke={lvl === 0 ? '#9AA8A0' : '#D7DDD6'}
                  strokeDasharray={lvl === 0 ? '4 4' : undefined}
                />
                <text x="16" y={yFor(lvl) + 4} fontSize="11" fill="#52615A">
                  {lvl > 0 ? `+${lvl}` : lvl}
                </text>
              </g>
            ))}

            {sorted.length > 1 && (
              <polyline
                fill="none"
                stroke="#325D54"
                strokeWidth="3"
                points={sorted.map((e, i) => `${xFor(i).toFixed(1)},${yFor(e.valenceScore).toFixed(1)}`).join(' ')}
              />
            )}

            {sorted.map((e, i) => (
              <g key={e.entryId}>
                <circle
                  cx={xFor(i)}
                  cy={yFor(e.valenceScore)}
                  r="7"
                  fill={e.valenceScore >= 0 ? '#325D54' : '#A98133'}
                  stroke="#FCFDFB"
                  strokeWidth="2"
                />
                <text x={xFor(i)} y={h - 6} textAnchor="middle" fontSize="10" fill="#52615A">
                  D+{e.relativeDayIndex}
                </text>
              </g>
            ))}
          </svg>

          <table className="cl-table">
            <thead>
              <tr>
                <th>Día Relativo</th>
                <th>Estado Reportado</th>
                <th>Modo</th>
                <th>Hábitos (de 6)</th>
                <th>Respiración</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((e) => (
                <tr key={e.entryId}>
                  <td className="cl-mono">Día +{e.relativeDayIndex}</td>
                  <td>{MOOD_LABELS[e.moodId]}</td>
                  <td className="cl-mono">{e.entryMode}</td>
                  <td>{e.habits.length}/6 ({e.habits.join(', ') || 'ninguno'})</td>
                  <td>{e.calmBreathUsed ? 'Sí' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
