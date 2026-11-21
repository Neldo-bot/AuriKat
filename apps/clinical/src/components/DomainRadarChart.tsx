import React from 'react';
import type { DomainScoreResult, SessionValidityStatus } from '@aurikat/clinical-scoring';

interface DomainRadarChartProps {
  domains: DomainScoreResult[];
  validityStatus: SessionValidityStatus;
  size?: number;
}

/**
 * 6-Axis Dimensional Clinical Observation Radar with Uncertainty Bands (CLIN-11).
 * Automatically blocks rendering of dimensional polygons when session is INDETERMINATE.
 */
export const DomainRadarChart: React.FC<DomainRadarChartProps> = ({
  domains,
  validityStatus,
  size = 340,
}) => {
  if (validityStatus === 'INDETERMINATE') {
    return (
      <div className="cl-banner" data-tone="warn" style={{ textAlign: 'center', padding: 26 }}>
        <strong>Perfil Dimensional Bloqueado (Estado: INDETERMINATE)</strong>
        <p style={{ margin: '8px 0 0' }}>
          Los datos conductuales de esta sesión son insuficientes o presentan sesgos de validez. Siguiendo estándares
          clínicos (lección Canvas Dx), no se proyectan puntajes sobre ruido.
        </p>
      </div>
    );
  }

  const cx = 180;
  const cy = 165;
  const maxR = 108;
  const count = domains.length;

  const pointAt = (i: number, value0to100: number) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
    const r = (Math.max(0, Math.min(100, value0to100)) / 100) * maxR;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  };

  const toPoly = (vals: number[]) =>
    vals
      .map((v, i) => {
        const p = pointAt(i, v);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(' ');

  const upperVals = domains.map((d) =>
    d.observationIndex !== null ? Math.min(100, d.observationIndex + (d.uncertaintyHalfWidth ?? 0)) : 0,
  );
  const centerVals = domains.map((d) => d.observationIndex ?? 0);
  const lowerVals = domains.map((d) =>
    d.observationIndex !== null ? Math.max(0, d.observationIndex - (d.uncertaintyHalfWidth ?? 0)) : 0,
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg
        width={size}
        height={size * 0.92}
        viewBox="0 0 360 330"
        role="img"
        aria-label="Radar dimensional de 6 dominios con bandas de incertidumbre"
      >
        {/* Concentric reference grids */}
        {[25, 50, 75, 100].map((level) => (
          <polygon
            key={level}
            points={toPoly(domains.map(() => level))}
            fill="none"
            stroke="#D7DDD6"
            strokeWidth={level === 50 ? '1.3' : '0.9'}
            strokeDasharray={level === 50 ? '4 4' : undefined}
          />
        ))}

        {/* Axis spokes & labels */}
        {domains.map((d, i) => {
          const end = pointAt(i, 100);
          const lbl = pointAt(i, 124);
          return (
            <g key={d.domainId}>
              <line x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="#CBD3CB" strokeWidth="1" />
              <text
                x={lbl.x}
                y={lbl.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="10.5"
                fontWeight="700"
                fill="#1F2925"
              >
                {d.shortTitle}
              </text>
              <text
                x={lbl.x}
                y={lbl.y + 13}
                textAnchor="middle"
                fontSize="9.5"
                fill="#52615A"
              >
                {d.observationIndex !== null
                  ? `${d.observationIndex} ±${d.uncertaintyHalfWidth}`
                  : 'N/A'}
              </text>
            </g>
          );
        })}

        {/* Outer uncertainty band */}
        <polygon points={toPoly(upperVals)} fill="rgba(50, 93, 84, 0.14)" stroke="rgba(50, 93, 84, 0.35)" strokeDasharray="3 3" strokeWidth="1.2" />

        {/* Central observation polygon */}
        <polygon points={toPoly(centerVals)} fill="rgba(50, 93, 84, 0.24)" stroke="#325D54" strokeWidth="2.4" />

        {/* Inner uncertainty contour */}
        <polygon points={toPoly(lowerVals)} fill="none" stroke="rgba(169, 129, 51, 0.55)" strokeDasharray="2 3" strokeWidth="1.1" />

        {/* Vertex markers */}
        {domains.map((d, i) => {
          if (d.observationIndex === null) return null;
          const p = pointAt(i, d.observationIndex);
          return <circle key={d.domainId} cx={p.x} cy={p.y} r="4.5" fill="#325D54" stroke="#FCFDFB" strokeWidth="1.5" />;
        })}
      </svg>
      <small style={{ color: 'var(--cl-ink-muted)', textAlign: 'center' }}>
        Escala exploratoria v1.0.0-beta (0–100 de observación clínica prioritaria + banda de incertidumbre ±IC; no es diagnóstico).
      </small>
    </div>
  );
};
