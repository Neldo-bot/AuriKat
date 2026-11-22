import { describe, expect, it } from 'vitest';
import {
  appendEmaEntry,
  appendSensoryAdjustment,
  applyGentleNeedsDecay,
  createDefaultPetNeeds,
  createInitialSessionPayload,
  encodeSensoryBitmask,
  estimateSamplingHz,
  IndexedDbStorageAdapter,
  SAFE_NEEDS_FLOOR,
  stepPendulum,
  stepRollingToy,
  stepSpring1D,
  updateDeviceMetaFromSamples,
  type PointerSample,
} from './index.js';

describe('TelemetryCollector & IndexedDbStorageAdapter (TECH-02 / IC-2)', () => {
  it('persists, retrieves, expires by TTL and irreversibly wipes local data (COPPA 2025)', async () => {
    const store = new IndexedDbStorageAdapter('test_aurikat_mem_db');
    await store.setItem('session', { id: 'AK-1' }, 30);
    expect(await store.getItem<{ id: string }>('session')).toEqual({ id: 'AK-1' });

    // Negative TTL simulates expired retention window -> returns null
    await store.setItem('expired_key', { id: 'OLD' }, -1);
    expect(await store.getItem('expired_key')).toBeNull();

    await store.wipeAll();
    expect(await store.getItem('session')).toBeNull();
  });

  it('estimates sampling rate, encodes sensory bitmasks and appends EMA/sensory events immutably', () => {
    const samples: PointerSample[] = Array.from({ length: 10 }, (_, i) => ({
      x: 10 + i * 8,
      y: 20,
      t: 500 + i * 16.6667, // 60 Hz
      pressure: 0.5,
      width: 20,
      height: 20,
      pointerType: 'touch',
      isCoalesced: true,
    }));

    expect(estimateSamplingHz(samples)).toBeCloseTo(60, 0);

    let session = createInitialSessionPayload({ participantPseudoId: 'AK-UNIT', ageMonths: 64 });
    expect(session.subAgeBand).toBe('4_5');

    session = {
      ...session,
      deviceMeta: updateDeviceMetaFromSamples(session.deviceMeta, samples, true),
    };
    expect(session.deviceMeta.pointerType).toBe('touch');
    expect(session.deviceMeta.pressureSupported).toBe(false);

    session = appendSensoryAdjustment(
      session,
      {
        timestampMs: 1200,
        setting: 'muted',
        previousValue: false,
        nextValue: true,
        activeGameId: 'G1_JA',
      },
      { ...session.sensorySettingsFinal, muted: true },
    );
    expect(encodeSensoryBitmask(session.sensorySettingsFinal)).toBe('mute');

    session = appendEmaEntry(session, {
      entryId: 'ema-1',
      relativeDayIndex: 0,
      isoDayBucket: '2026-11-21',
      moodId: 'breeze_calm',
      valenceScore: 1,
      habits: ['sleep', 'calm_rest'],
      entryMode: 'caregiver_assisted',
      durationMs: 11200,
      calmBreathUsed: false,
    });
    expect(session.emaEntries.length).toBe(1);
  });

  it('enforces non-punitive >= 35% floor on CozyPetNeeds even after months of absence and recharges energy while sleeping', () => {
    const t0 = 1_000_000;
    const base = createDefaultPetNeeds(t0);
    // Simulate 500 hours of absence
    const afterLongAbsence = applyGentleNeedsDecay(base, t0 + 500 * 3600 * 1000);
    expect(afterLongAbsence.belly).toBe(SAFE_NEEDS_FLOOR);
    expect(afterLongAbsence.joy).toBe(SAFE_NEEDS_FLOOR);
    expect(afterLongAbsence.energy).toBe(SAFE_NEEDS_FLOOR);

    // Sleeping recharges energy gently
    const sleepingNeeds = { ...afterLongAbsence, sleeping: true };
    const afterNap = applyGentleNeedsDecay(sleepingNeeds, afterLongAbsence.lastUpdatedMs + 2 * 3600 * 1000);
    expect(afterNap.energy).toBeGreaterThan(SAFE_NEEDS_FLOOR + 25);
  });

  it('converges 60 fps spring physics, pendulum and rolling toy cleanly without NaN or divergence', () => {
    let sp = { pos: 0, vel: 0 };
    for (let i = 0; i < 90; i++) {
      sp = stepSpring1D(sp, 1, 160, 20, 1 / 60);
    }
    expect(sp.pos).toBeCloseTo(1, 2);

    let pend = { angleDeg: 28, omegaDeg: 0 };
    for (let i = 0; i < 180; i++) {
      pend = stepPendulum(pend, 1 / 60);
    }
    expect(Math.abs(pend.angleDeg)).toBeLessThan(3);

    let roll = { x: 0.78, vx: 2.5, rotationDeg: 0 };
    for (let i = 0; i < 60; i++) {
      roll = stepRollingToy(roll, 1 / 60);
    }
    expect(roll.x).toBeLessThanOrEqual(0.85);
    expect(roll.x).toBeGreaterThanOrEqual(-0.85);
  });
});
