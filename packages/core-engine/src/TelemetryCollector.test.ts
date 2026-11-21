import { describe, expect, it } from 'vitest';
import {
  appendEmaEntry,
  appendSensoryAdjustment,
  createInitialSessionPayload,
  encodeSensoryBitmask,
  estimateSamplingHz,
  IndexedDbStorageAdapter,
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
});
