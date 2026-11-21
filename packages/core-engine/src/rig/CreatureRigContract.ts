import type {
  AccessoryId,
  ArchetypeId,
  CreatureActionId,
  EmotionId,
  PaletteId,
  SpeciesId,
} from '../types/domain.js';

/**
 * ICreatureRigAdapter v2 (IC-4)
 * Designed in 1:1 parity with Rive Data Binding (View Models + State Machines)
 * so Procedural SVG/Canvas2D in Beta v1.0 swaps cleanly to Rive .riv in Phase 2
 * without modifying any minigame or telemetry code.
 */
export interface CreatureViewModelInputs {
  lookX: number; // Continuous [-1.0, +1.0] (pupil & subtle head tracking)
  lookY: number; // Continuous [-1.0, +1.0]
  emotion: EmotionId;
  action: CreatureActionId;
  species: SpeciesId;
  archetype: ArchetypeId;
  paletteId: PaletteId;
  accessory: AccessoryId;
  motionScale: number; // 0.0 (WCAG reduced motion) | 0.5 | 1.0
}

export interface RigRuntimeCapabilities {
  runtimeKind: 'procedural_svg' | 'rive_canvas' | 'rive_webgl2';
  supportsContinuousJoysticks: boolean;
  externalCdnRequestsBlocked: boolean;
  disablesInternalPointerListeners: boolean;
}

export interface ICreatureRigAdapter {
  readonly capabilities: RigRuntimeCapabilities;
  bindViewModel(inputs: CreatureViewModelInputs): void;
  updateInputs(partial: Partial<CreatureViewModelInputs>): void;
  getInputs(): CreatureViewModelInputs;
  dispose(): void;
}

export const DEFAULT_CREATURE_INPUTS: CreatureViewModelInputs = {
  lookX: 0,
  lookY: 0,
  emotion: 'calm',
  action: 'idle',
  species: 'aurikat',
  archetype: 'criatura_companera',
  paletteId: 'salvia_calma',
  accessory: 'au_charm',
  motionScale: 1,
};

export function clampLookCoordinate(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.max(-1, Math.min(1, val));
}
