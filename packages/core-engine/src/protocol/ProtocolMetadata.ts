import type {
  AccessoryId,
  ArchetypeId,
  EmotionId,
  HabitId,
  PaletteId,
  SpeciesId,
  WeatherMoodId,
} from '../types/domain.js';

export interface CalmPaletteSpec {
  id: PaletteId;
  name: string;
  bg: string;
  surface: string;
  surfaceRaised: string;
  accent: string;
  accentSoft: string;
  ink: string;
  inkMuted: string;
  auGold: string; // Desaturated warm honey gold (never bright #FFFF00)
  isDark: boolean;
}

/**
 * 5 Sensory-Calm Palettes (Pillar 3 UX-01 / Grandgeorge & Masataka 2016).
 * Strictly zero pure #FFFFFF, zero pure #000000, zero bright yellow.
 */
export const CALM_PALETTES: Record<PaletteId, CalmPaletteSpec> = {
  salvia_calma: {
    id: 'salvia_calma',
    name: 'Bosque Salvia',
    bg: '#EEF3EE',
    surface: '#F7F9F5',
    surfaceRaised: '#E3ECE4',
    accent: '#527E72',
    accentSoft: '#D5E5DF',
    ink: '#2B3330',
    inkMuted: '#56655F',
    auGold: '#C59E49',
    isDark: false,
  },
  arena_tibia: {
    id: 'arena_tibia',
    name: 'Arena y Tierra',
    bg: '#F6F1E7',
    surface: '#FCF9F2',
    surfaceRaised: '#ECE4D5',
    accent: '#94724E',
    accentSoft: '#E8DCCB',
    ink: '#332C25',
    inkMuted: '#695C4F',
    auGold: '#BA9243',
    isDark: false,
  },
  lavanda_suave: {
    id: 'lavanda_suave',
    name: 'Bruma Lavanda',
    bg: '#F2EFF6',
    surface: '#FAF8FC',
    surfaceRaised: '#E7E1F0',
    accent: '#716292',
    accentSoft: '#DFD8EB',
    ink: '#2E2A38',
    inkMuted: '#5E576E',
    auGold: '#C29C4E',
    isDark: false,
  },
  oceano_sereno: {
    id: 'oceano_sereno',
    name: 'Bahía Serena',
    bg: '#ECF2F6',
    surface: '#F6FAFC',
    surfaceRaised: '#DFEAF1',
    accent: '#487693',
    accentSoft: '#D1E2EC',
    ink: '#24313B',
    inkMuted: '#4E6272',
    auGold: '#C49E4C',
    isDark: false,
  },
  atardecer_noche: {
    id: 'atardecer_noche',
    name: 'Luz de Luna',
    bg: '#1F242D',
    surface: '#2A313D',
    surfaceRaised: '#343D4C',
    accent: '#7BA7A1',
    accentSoft: '#35484A',
    ink: '#E6E2D8',
    inkMuted: '#A9B0BC',
    auGold: '#C8A559',
    isDark: true,
  },
};

export interface SpeciesSpec {
  id: SpeciesId;
  label: string;
  bodyFill: string;
  bellyFill: string;
  earAccent: string;
  strokeColor: string;
}

export const SPECIES_CATALOG: Record<SpeciesId, SpeciesSpec> = {
  aurikat: {
    id: 'aurikat',
    label: 'AuriKat',
    bodyFill: '#D9B68C',
    bellyFill: '#F4E9D8',
    earAccent: '#C98F7C',
    strokeColor: '#4A3C31',
  },
  nube_ajolote: {
    id: 'nube_ajolote',
    label: 'Nube-Ajolote',
    bodyFill: '#DFBFC4',
    bellyFill: '#F6ECEE',
    earAccent: '#C38796',
    strokeColor: '#4F3940',
  },
  zorro_buho: {
    id: 'zorro_buho',
    label: 'Zorro-Búho',
    bodyFill: '#C79674',
    bellyFill: '#F2E5D5',
    earAccent: '#86624B',
    strokeColor: '#3E2F26',
  },
};

export interface ArchetypeSpec {
  id: ArchetypeId;
  label: string;
  ageHint: string;
  availableInBeta: boolean;
}

export const ARCHETYPE_CATALOG: ArchetypeSpec[] = [
  { id: 'cuento_pastel', label: 'Cuento Pastel', ageHint: '2–6', availableInBeta: true },
  { id: 'criatura_companera', label: 'Criatura Compañera', ageHint: '4–9', availableInBeta: true },
  { id: 'cozy_pixel', label: 'Cozy Pixel', ageHint: '8–12+', availableInBeta: true },
  { id: 'anime_stylized', label: 'Anime Cozy (Fase 2)', ageHint: '10–14+', availableInBeta: false },
];

export const ACCESSORY_CATALOG: { id: AccessoryId; label: string }[] = [
  { id: 'au_charm', label: 'Amuleto Au' },
  { id: 'leaf_hat', label: 'Gorrito Hoja' },
  { id: 'star_scarf', label: 'Bufanda Estrella' },
  { id: 'round_glasses', label: 'Lentes Suaves' },
  { id: 'cloud_backpack', label: 'Mochila Nube' },
  { id: 'flower_crown', label: 'Corona Floral' },
];

export interface WeatherMoodSpec {
  id: WeatherMoodId;
  emotion: EmotionId;
  valence: -2 | -1 | 0 | 1 | 2;
  skyTint: string;
  iconSymbol: 'sun' | 'breeze' | 'rain' | 'mist' | 'storm';
  needsComfortOption: boolean;
}

/**
 * Weather + AuriKat face/posture fusion (IC-1 / UX-04 anti-literalism).
 */
export const WEATHER_MOOD_SPECS: WeatherMoodSpec[] = [
  { id: 'sun_happy', emotion: 'happy', valence: 2, skyTint: '#E9DFC4', iconSymbol: 'sun', needsComfortOption: false },
  { id: 'breeze_calm', emotion: 'calm', valence: 1, skyTint: '#D8E8DF', iconSymbol: 'breeze', needsComfortOption: false },
  { id: 'cloud_tired_sad', emotion: 'sad', valence: -1, skyTint: '#D5E0EA', iconSymbol: 'rain', needsComfortOption: true },
  { id: 'mist_worried', emotion: 'scared', valence: -1, skyTint: '#E1DCEB', iconSymbol: 'mist', needsComfortOption: true },
  { id: 'storm_overwhelmed', emotion: 'angry', valence: -2, skyTint: '#E6D6D3', iconSymbol: 'storm', needsComfortOption: true },
];

export const HABIT_SPECS: { id: HabitId; symbol: string; label: string }[] = [
  { id: 'sleep', symbol: 'moon', label: 'Descanso' },
  { id: 'food', symbol: 'bowl', label: 'Comida' },
  { id: 'play_move', symbol: 'ball', label: 'Juego' },
  { id: 'calm_rest', symbol: 'leaf', label: 'Calma' },
  { id: 'shared_time', symbol: 'hearts', label: 'Compartir' },
  { id: 'smooth_change', symbol: 'path', label: 'Cambios' },
];

export const STICKER_CATALOG: { id: string; color: string; motif: 'star' | 'leaf' | 'paw' | 'cloud' | 'moon' | 'acorn' | 'shell' | 'butterfly' }[] = [
  { id: 'st_star', color: '#C59E49', motif: 'star' },
  { id: 'st_leaf', color: '#5E8B7E', motif: 'leaf' },
  { id: 'st_paw', color: '#B4846C', motif: 'paw' },
  { id: 'st_cloud', color: '#7D9BB0', motif: 'cloud' },
  { id: 'st_moon', color: '#8A7CA8', motif: 'moon' },
  { id: 'st_acorn', color: '#9C7A54', motif: 'acorn' },
  { id: 'st_shell', color: '#C48F98', motif: 'shell' },
  { id: 'st_butterfly', color: '#6E9A8B', motif: 'butterfly' },
];
