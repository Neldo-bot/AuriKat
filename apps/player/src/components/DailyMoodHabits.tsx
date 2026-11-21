import React, { useRef, useState } from 'react';
import {
  generateUuidV4,
  gentleSoundEngine,
  HABIT_SPECS,
  WEATHER_MOOD_SPECS,
  type CreatureViewModelInputs,
  type EmaEntry,
  type EmaEntryMode,
  type HabitId,
  type WeatherMoodId,
} from '@aurikat/core-engine';
import { ProceduralCreatureRig } from './ProceduralCreatureRig.js';

interface DailyMoodHabitsProps {
  creatureInputs: CreatureViewModelInputs;
  defaultEntryMode: EmaEntryMode;
  existingEntriesCount: number;
  onSaveEntry: (entry: EmaEntry) => void;
  onClose: () => void;
}

const HabitGlyph: React.FC<{ id: HabitId }> = ({ id }) => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--ak-accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    {id === 'sleep' && <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />}
    {id === 'food' && (
      <>
        <path d="M4 12h16a8 8 0 0 1-16 0z" />
        <line x1="8" y1="8" x2="8" y2="6" />
        <line x1="12" y1="7" x2="12" y2="5" />
        <line x1="16" y1="8" x2="16" y2="6" />
      </>
    )}
    {id === 'play_move' && (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M6 9c4 2 8 2 12 0" />
      </>
    )}
    {id === 'calm_rest' && <path d="M5 19Q5 5 19 5Q19 19 5 19Z" />}
    {id === 'shared_time' && (
      <path d="M12 20s-7-4.5-7-9.5A4.2 4.2 0 0 1 12 7.5a4.2 4.2 0 0 1 7 3C19 15.5 12 20 12 20z" />
    )}
    {id === 'smooth_change' && (
      <>
        <path d="M4 16c4 0 4-8 8-8s4 8 8 8" />
        <circle cx="20" cy="16" r="2" />
      </>
    )}
  </svg>
);

/**
 * «Mi Día con AuriKat» — Pediatric EMA (<20s, IC-1 / CLIN-09 / UX-04)
 * - Always fuses weather sky tint + unmistakable AuriKat facial/postural expression (anti-literalism)
 * - Equal warm reward & optional 10s calm-breathing orb for tough emotions (anti-social desirability)
 * - Explicit entryMode tag (caregiver_assisted for 4-6y vs child_solo for 7-8+y)
 */
export const DailyMoodHabits: React.FC<DailyMoodHabitsProps> = ({
  creatureInputs,
  defaultEntryMode,
  existingEntriesCount,
  onSaveEntry,
  onClose,
}) => {
  const [selectedMood, setSelectedMood] = useState<WeatherMoodId | null>(null);
  const [habits, setHabits] = useState<HabitId[]>([]);
  const [entryMode, setEntryMode] = useState<EmaEntryMode>(defaultEntryMode);
  const [showBreath, setShowBreath] = useState(false);
  const [breathUsed, setBreathUsed] = useState(false);
  const startedAtRef = useRef<number>(performance.now());

  const activeSpec = WEATHER_MOOD_SPECS.find((w) => w.id === selectedMood) ?? null;

  const toggleHabit = (id: HabitId) => {
    gentleSoundEngine.playCue('tap_soft');
    setHabits((prev) => (prev.includes(id) ? prev.filter((h) => h !== id) : [...prev, id]));
  };

  const handleSelectMood = (moodId: WeatherMoodId) => {
    setSelectedMood(moodId);
    const spec = WEATHER_MOOD_SPECS.find((w) => w.id === moodId);
    gentleSoundEngine.playCue(spec?.needsComfortOption ? 'animalese_comfort' : 'animalese_happy');
  };

  const handleConfirm = () => {
    if (!activeSpec) return;
    gentleSoundEngine.playCue('celebrate_chime');
    const now = new Date();
    const entry: EmaEntry = {
      entryId: generateUuidV4(),
      relativeDayIndex: existingEntriesCount,
      isoDayBucket: now.toISOString().slice(0, 10),
      moodId: activeSpec.id,
      valenceScore: activeSpec.valence,
      habits,
      entryMode,
      durationMs: Math.round(performance.now() - startedAtRef.current),
      calmBreathUsed: breathUsed,
    };
    onSaveEntry(entry);
    onClose();
  };

  return (
    <section className="ak-stage-card" aria-label="Mi Día con AuriKat">
      {/* Subtle adult co-assist toggle (A7 / CLIN-09) */}
      <div className="ak-row" style={{ width: '100%', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 800, fontSize: '1.15rem' }}>Mi Día con AuriKat</span>
        <button
          type="button"
          className="ak-nurture-pill"
          style={{ border: '1px solid var(--ak-surface-raised)', cursor: 'pointer' }}
          onClick={() =>
            setEntryMode((m) => (m === 'caregiver_assisted' ? 'child_solo' : 'caregiver_assisted'))
          }
          title="Indicador de registro con o sin ayuda de un adulto"
        >
          <span>{entryMode === 'caregiver_assisted' ? 'Con adulto' : 'Solo'}</span>
        </button>
      </div>

      {/* 5 Weather + AuriKat Face/Posture Fused Cards */}
      <div className="ak-row" style={{ justifyContent: 'center', gap: 14 }}>
        {WEATHER_MOOD_SPECS.map((spec) => (
          <button
            key={spec.id}
            type="button"
            className="ak-primary-target"
            style={{
              background: spec.skyTint,
              minWidth: 108,
              minHeight: 112,
              padding: 10,
            }}
            data-selected={selectedMood === spec.id}
            onClick={() => handleSelectMood(spec.id)}
            aria-label={`Estado ${spec.emotion}`}
          >
            <ProceduralCreatureRig
              inputs={{ ...creatureInputs, emotion: spec.emotion, action: 'idle', motionScale: 0 }}
              size={74}
            />
          </button>
        ))}
      </div>

      {/* Equal Empathetic Comfort & Optional Breathing Orb for Tough Emotions */}
      {activeSpec?.needsComfortOption && (
        <div
          className="ak-subtle-box"
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span>AuriKat te acompaña. Todas las emociones valen igual.</span>
          {showBreath ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div className="ak-breathe-orb" />
              <button
                type="button"
                className="ak-primary-target"
                style={{ minHeight: 52 }}
                onClick={() => setShowBreath(false)}
              >
                <span>Ya me siento mejor</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="ak-primary-target"
              style={{ minHeight: 56 }}
              onClick={() => {
                setShowBreath(true);
                setBreathUsed(true);
                gentleSoundEngine.playCue('animalese_comfort');
              }}
            >
              <span>Respirar despacio con AuriKat</span>
            </button>
          )}
        </div>
      )}

      {/* 6 Pictographic Daily Habits */}
      <div className="ak-row" style={{ justifyContent: 'center', gap: 12 }}>
        {HABIT_SPECS.map((h) => (
          <button
            key={h.id}
            type="button"
            className="ak-primary-target"
            style={{ minWidth: 88, minHeight: 84 }}
            data-selected={habits.includes(h.id)}
            onClick={() => toggleHabit(h.id)}
            aria-label={h.label}
          >
            <HabitGlyph id={h.id} />
            <span style={{ fontSize: '0.82rem' }}>{h.label}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="ak-btn-accent"
        disabled={!selectedMood}
        onClick={handleConfirm}
      >
        <span>Guardar mi día ★</span>
      </button>
    </section>
  );
};
