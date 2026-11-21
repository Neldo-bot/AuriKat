import {
  clampLookCoordinate,
  DEFAULT_CREATURE_INPUTS,
  type CreatureViewModelInputs,
  type ICreatureRigAdapter,
  type RigRuntimeCapabilities,
} from './CreatureRigContract.js';

export interface RiveSelfHostedConfig {
  /** Must point to a local same-origin asset (NEVER unpkg.com CDN — COPPA 2025 / Apple Kids 1.3). */
  localWasmUrl: string;
  /** Local .riv artboard bundle compiled under Rive Cadet ($9/mo) with no splash screen. */
  localRivUrl: string;
  /** Must remain true during gameplay so Rive does not swallow raw PointerEvents. */
  shouldDisableRiveListeners: true;
}

/**
 * Phase 2 Rive ViewModel adapter blueprint (IC-4 / RIG-02).
 * Demonstrates zero-touch swap: only this adapter replaces ProceduralCreatureRig in Phase 2.
 */
export class RiveViewModelAdapterStub implements ICreatureRigAdapter {
  private inputs: CreatureViewModelInputs = { ...DEFAULT_CREATURE_INPUTS };
  public readonly config: RiveSelfHostedConfig;

  public readonly capabilities: RigRuntimeCapabilities = {
    runtimeKind: 'rive_canvas',
    supportsContinuousJoysticks: true,
    externalCdnRequestsBlocked: true,
    disablesInternalPointerListeners: true,
  };

  constructor(config: RiveSelfHostedConfig) {
    if (/^https?:\/\/(unpkg\.com|cdn\.|cdnjs\.)/i.test(config.localWasmUrl)) {
      throw new Error('Privacy policy violation: rive.wasm must be self-hosted locally, never loaded from a third-party CDN.');
    }
    this.config = config;
  }

  bindViewModel(inputs: CreatureViewModelInputs): void {
    this.inputs = {
      ...inputs,
      lookX: clampLookCoordinate(inputs.lookX),
      lookY: clampLookCoordinate(inputs.lookY),
    };
  }

  updateInputs(partial: Partial<CreatureViewModelInputs>): void {
    this.inputs = {
      ...this.inputs,
      ...partial,
      lookX: partial.lookX !== undefined ? clampLookCoordinate(partial.lookX) : this.inputs.lookX,
      lookY: partial.lookY !== undefined ? clampLookCoordinate(partial.lookY) : this.inputs.lookY,
    };
  }

  getInputs(): CreatureViewModelInputs {
    return { ...this.inputs };
  }

  dispose(): void {
    // Releases Rive instance / offscreen renderer in Phase 2 implementation.
  }
}
