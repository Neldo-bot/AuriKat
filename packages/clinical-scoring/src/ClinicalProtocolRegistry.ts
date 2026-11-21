import { PROTOCOL_VERSION } from '@aurikat/core-engine';

/**
 * ClinicalProtocolRegistry — EXCLUSIVELY imported by apps/clinical (NEVER in apps/player!).
 * Manually curated, versioned construct mapping (Q-Matrix) and copyright-respecting scale catalog.
 */

export type ClinicalDomainId =
  | 'joint_attention'
  | 'emotion_tom'
  | 'cognitive_flexibility'
  | 'social_geo_pref'
  | 'motor_kinematics_2d'
  | 'sensory_modulation';

export interface DomainSpec {
  id: ClinicalDomainId;
  title: string;
  shortTitle: string;
  dsmReference: string;
  neuroaffirmingFocus: string;
  clinicalCaveat: string;
  convergentExternalScales: string[];
}

export const CLINICAL_DOMAINS: DomainSpec[] = [
  {
    id: 'joint_attention',
    title: 'Atención Conjunta y Contingencia Social',
    shortTitle: 'Atención Conjunta',
    dsmReference: 'DSM-5-TR Criterio A.2 / A.3 (RJA social vs. flecha + Micro-IJA)',
    neuroaffirmingFocus: 'Seguimiento de claves comunicativas visuales y respuesta a contingencia interactiva.',
    clinicalCaveat: 'Toques pre-pista pueden reflejar impulsividad asociada a TDAH; interpretar junto a SDQ Hiperactividad.',
    convergentExternalScales: ['ADOS-2 (SA-CSS)', 'SRS-2', 'SCQ', 'CAST'],
  },
  {
    id: 'emotion_tom',
    title: 'Atribución Socioemocional e Intencionalidad',
    shortTitle: 'Emoción / ToM',
    dsmReference: 'DSM-5-TR Criterio A.1 / A.3 (Emoción contextual + ToM controlada por causalidad física)',
    neuroaffirmingFocus: 'Interpretación de claves socioemocionales convencionales en escenas animadas estructuradas (enfoque Doble Empatía).',
    clinicalCaveat: 'Se controla mediante ítems de causalidad física (Wilson 2021) para aislar comprensión secuencial y CI no verbal.',
    convergentExternalScales: ['ADOS-2 (SA-CSS)', 'SRS-2 (Cognición Social)', 'CAST'],
  },
  {
    id: 'cognitive_flexibility',
    title: 'Flexibilidad Cognitiva (NIH Toolbox DCCS)',
    shortTitle: 'Flexibilidad DCCS',
    dsmReference: 'DSM-5-TR Criterio B.2 (Costo de cambio, errores perseverativos y regresivos)',
    neuroaffirmingFocus: 'Adaptación ante cambios de regla implícitos y equilibrio entre precisión y velocidad de procesamiento.',
    clinicalCaveat: 'Los errores regresivos correlacionan con rigidez ecológica (BRIEF-2 Shift), mientras errores no sistemáticos pueden reflejar inatención.',
    convergentExternalScales: ['BRIEF-2 / BRIEF-P (Shift)', 'ADOS-2 (RRB-CSS)', 'SRS-2 (RRB)'],
  },
  {
    id: 'social_geo_pref',
    title: 'Preferencia Socio-Visual Exploratoria (GeoPref)',
    shortTitle: 'Pref. Social/Geo',
    dsmReference: 'DSM-5-TR Criterio A.1 / B.3 (Indicador exploratorio subtipo ASDGeo)',
    neuroaffirmingFocus: 'Distribución espontánea de interacción entre estímulos sociales animados y patrones geométricos iso-salientes.',
    clinicalCaveat: 'ALTA ESPECIFICIDAD / BAJA SENSIBILIDAD (17–35% en eye-tracking 12–48m): una preferencia social equilibrada JAMÁS descarta TEA.',
    convergentExternalScales: ['ADOS-2 (SA-CSS)', 'SRS-2 (Motivación Social)'],
  },
  {
    id: 'motor_kinematics_2d',
    title: 'Cinemática Motora Táctil 2D Pura',
    shortTitle: 'Cinemática 2D',
    dsmReference: 'Firma sensoriomotora 2D (Simeoli 2021–24 + 3 rasgos Butera 2025 + Torres Gamma/NSR)',
    neuroaffirmingFocus: 'Planificación anticipatoria, suavidad y variabilidad espacial de trazos táctiles en pantalla.',
    clinicalCaveat: 'ADVERTENCIA DIFERENCIAL TEA vs. DCD: la cinemática táctil presenta solapamiento con Trastorno del Desarrollo de la Coordinación (71% precisión diferencial en Butera et al., 2025). Contrastar con MABC-2.',
    convergentExternalScales: ['MABC-2 (Control DCD)', 'ADOS-2'],
  },
  {
    id: 'sensory_modulation',
    title: 'Modulación Sensorial Audiovisual (Dunn SP-2)',
    shortTitle: 'Modulación Sensorial',
    dsmReference: 'DSM-5-TR Criterio B.4 (Cuadrantes Avoiding / Sensitivity en canal digital)',
    neuroaffirmingFocus: 'Uso autorregulado de la Barra de Calma Sensorial (silencio, luz tenue, movimiento reducido y pausas).',
    clinicalCaveat: 'Cobertura limitada a canales visual/auditivo y evitación activa; NO evalúa tacto corporal, olfato, gusto, propiocepción ni hiporreactividad pasiva (Low Registration). Triangular con Sensory Profile 2.',
    convergentExternalScales: ['Sensory Profile 2 (Avoiding / Sensitivity)'],
  },
];

export interface PsychometricScaleRoadmapItem {
  band: '2-5' | '4-8_BETA' | '6-11' | '12+';
  scaleName: string;
  ageRange: string;
  licenseStatus: 'Gratuita Investigación' | 'Copyright Editorial (Ingreso Manual Clínico)';
  roleInAuriKat: string;
}

export const PSYCHOMETRIC_SCALE_ROADMAP: PsychometricScaleRoadmapItem[] = [
  {
    band: '4-8_BETA',
    scaleName: 'CAST (Childhood Autism Spectrum Test)',
    ageRange: '4–11 años',
    licenseStatus: 'Gratuita Investigación',
    roleInAuriKat: 'Criterio de cribado prioritario gratuito para pilotos Beta 4–8 años en Argentina.',
  },
  {
    band: '4-8_BETA',
    scaleName: 'SDQ (Strengths and Difficulties Questionnaire)',
    ageRange: '4–17 años',
    licenseStatus: 'Gratuita Investigación',
    roleInAuriKat: 'Control gratuito en papel de comorbilidades (Hiperactividad/TDAH, Emocional, Pares).',
  },
  {
    band: '4-8_BETA',
    scaleName: 'ADOS-2 (SA-CSS & RRB-CSS)',
    ageRange: '12m–Adultez',
    licenseStatus: 'Copyright Editorial (Ingreso Manual Clínico)',
    roleInAuriKat: 'Gold Standard observacional de contraste en validación Beta 1/2.',
  },
  {
    band: '4-8_BETA',
    scaleName: 'CARS-2 (ST / HF) & SRS-2 & SCQ',
    ageRange: '2+ / 4–18 / 4+ años',
    licenseStatus: 'Copyright Editorial (Ingreso Manual Clínico)',
    roleInAuriKat: 'Criterios dimensionales y de cribado estándar en 4–8 años (reemplazan M-CHAT-R/F y STAT).',
  },
  {
    band: '4-8_BETA',
    scaleName: 'Sensory Profile 2 (SP-2) & BRIEF-2/P',
    ageRange: '3–14:11 / 2–18 años',
    licenseStatus: 'Copyright Editorial (Ingreso Manual Clínico)',
    roleInAuriKat: 'Validez convergente específica para Modulación Sensorial y Flexibilidad (Shift).',
  },
  {
    band: '4-8_BETA',
    scaleName: 'Raven CPM / K-BIT / Leiter-3 & MABC-2',
    ageRange: '4–8+ años',
    licenseStatus: 'Copyright Editorial (Ingreso Manual Clínico)',
    roleInAuriKat: 'Covariables obligatorias de control de CI no verbal y DCD (coordinación motora).',
  },
  {
    band: '2-5',
    scaleName: 'M-CHAT-R/F (16–30m) & STAT (24–36m)',
    ageRange: '16–36 meses',
    licenseStatus: 'Gratuita Investigación',
    roleInAuriKat: 'Reservadas exclusivamente para futura Banda 1 (<36m); excluidas del rango Beta 4–8 años.',
  },
  {
    band: '6-11',
    scaleName: 'BASC-3, ASSQ & CMQ',
    ageRange: '6–16 años',
    licenseStatus: 'Copyright Editorial (Ingreso Manual Clínico)',
    roleInAuriKat: 'Expansión escolar avanzada y detección temprana de esfuerzo social / enmascaramiento.',
  },
  {
    band: '12+',
    scaleName: 'CAT-Q, NEO-PI-3 / IPIP-Big Five (SJT) & SCL-90-R (Casullo)',
    ageRange: '12+ / 13+ / 16+ años',
    licenseStatus: 'Copyright Editorial (Ingreso Manual Clínico)',
    roleInAuriKat: 'Hoja de ruta adolescente/adulto curada manualmente; SCL-90-R exige protocolo de seguridad autolesiva.',
  },
];

export const DEONTOLOGICAL_NOTICE = {
  protocolVersion: PROTOCOL_VERSION,
  regulatoryStatus:
    'Prototipo en Investigación Clínica (ANMAT Disposición 64/2025 Parte 3 — Exento de registro sanitario, prohibida comercialización y uso diagnóstico autónomo).',
  ethicsNotice:
    'Cumplimiento APA Standard 9.01, 9.02(b), 9.06 y 9.09, Código de Ética FePRA y Ley Nacional de Salud Mental 26.657 (abordaje interdisciplinario). Los indicadores 0–100 de v1.0.0-beta son heurísticas exploratorias pendientes de baremación empírica. La interpretación y responsabilidad clínica corresponden exclusivamente al profesional matriculado.',
};
