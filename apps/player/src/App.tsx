import React, { useEffect, useMemo, useState } from 'react';
import {
  ACCESSORY_CATALOG,
  appendEmaEntry,
  appendSensoryAdjustment,
  applyGentleNeedsDecay,
  CALM_PALETTES,
  createDefaultPetNeeds,
  createInitialSessionPayload,
  gentleSoundEngine,
  IndexedDbStorageAdapter,
  STICKER_CATALOG,
  updateDeviceMetaFromSamples,
  type CozyPetNeeds,
  type CreatureViewModelInputs,
  type EmaEntry,
  type FormVariant,
  type GameId,
  type PointerSample,
  type RawSessionPayload,
  type SensoryCalmSettings,
  type SessionPacingMode,
  type StrokeRecord,
  type SubAgeBand,
  type TrialRecord,
} from '@aurikat/core-engine';
import { ChildAssentScreen } from './components/ChildAssentScreen.js';
import { CreatureCustomiser } from './components/CreatureCustomiser.js';
import { DailyMoodHabits } from './components/DailyMoodHabits.js';
import { InteractiveHabitatStage } from './components/InteractiveHabitatStage.js';
import { ParentalExportGate } from './components/ParentalExportGate.js';
import { SensoryCalmBar } from './components/SensoryCalmBar.js';
import { CognitiveFlexibilityGame } from './games/CognitiveFlexibilityGame.js';
import { EmotionToMGame } from './games/EmotionToMGame.js';
import { JointAttentionGame } from './games/JointAttentionGame.js';
import { SocialGeoMotorGame } from './games/SocialGeoMotorGame.js';

type ActiveView = 'hub' | 'customise' | 'ema' | 'g1' | 'g2' | 'g3' | 'g4';

const storage = new IndexedDbStorageAdapter('aurikat_player_db_v2');
const SESSION_KEY = 'active_session_v2';
const SETTINGS_KEY = 'pilot_settings_v2';

interface PilotLocalSettings {
  pilotAssentEnabled: boolean;
  savedClinicianLockCode: string;
}

export const App: React.FC = () => {
  const [session, setSession] = useState<RawSessionPayload>(() => createInitialSessionPayload());
  const [pilotSettings, setPilotSettings] = useState<PilotLocalSettings>({
    pilotAssentEnabled: true,
    savedClinicianLockCode: '',
  });
  const [assentResolved, setAssentResolved] = useState(false);
  const [assentDeclined, setAssentDeclined] = useState(false);
  const [view, setView] = useState<ActiveView>('hub');
  const [pauseOpen, setPauseOpen] = useState(false);
  const [parentGateOpen, setParentGateOpen] = useState(false);
  const [celebrationToast, setCelebrationToast] = useState<string | null>(null);

  // Hydrate persisted IndexedDB state & apply non-punitive gentle needs decay (TECH-02 + GAM-01)
  useEffect(() => {
    void storage.requestPersistence();
    void (async () => {
      const saved = await storage.getItem<RawSessionPayload>(SESSION_KEY);
      if (saved && saved.schemaVersion === '2.0.0') {
        const refreshedNeeds = applyGentleNeedsDecay(saved.customization.petNeeds);
        setSession({
          ...saved,
          pacingMode: saved.pacingMode ?? 'clinical_full',
          customization: {
            ...saved.customization,
            petNeeds: refreshedNeeds,
          },
        });
      }
      const savedPrefs = await storage.getItem<PilotLocalSettings>(SETTINGS_KEY);
      if (savedPrefs) {
        setPilotSettings(savedPrefs);
        if (!savedPrefs.pilotAssentEnabled) setAssentResolved(true);
      }
    })();
  }, []);

  useEffect(() => {
    void storage.setItem(SESSION_KEY, session, 60);
  }, [session]);

  useEffect(() => {
    void storage.setItem(SETTINGS_KEY, pilotSettings, 60);
  }, [pilotSettings]);

  // Apply chosen sensory-calm palette CSS variables (UX-01)
  useEffect(() => {
    const pal = CALM_PALETTES[session.customization.paletteId];
    const root = document.documentElement;
    root.style.setProperty('--ak-bg', pal.bg);
    root.style.setProperty('--ak-surface', pal.surface);
    root.style.setProperty('--ak-surface-raised', pal.surfaceRaised);
    root.style.setProperty('--ak-accent', pal.accent);
    root.style.setProperty('--ak-accent-soft', pal.accentSoft);
    root.style.setProperty('--ak-ink', pal.ink);
    root.style.setProperty('--ak-ink-muted', pal.inkMuted);
    root.style.setProperty('--ak-au-gold', pal.auGold);
  }, [session.customization.paletteId]);

  useEffect(() => {
    gentleSoundEngine.setMuted(session.sensorySettingsFinal.muted);
    gentleSoundEngine.setVolume(session.sensorySettingsFinal.volume);
  }, [session.sensorySettingsFinal.muted, session.sensorySettingsFinal.volume]);

  const creatureInputs: CreatureViewModelInputs = useMemo(
    () => ({
      lookX: 0,
      lookY: 0,
      emotion: 'calm',
      action: 'idle',
      species: session.customization.species,
      archetype: session.customization.archetype,
      paletteId: session.customization.paletteId,
      accessory: session.customization.accessory,
      motionScale: session.sensorySettingsFinal.motionScale,
    }),
    [session.customization, session.sensorySettingsFinal.motionScale],
  );

  const activeGameContext = (): GameId | 'hub' | 'ema' => {
    if (view === 'g1') return 'G1_JA';
    if (view === 'g2') return 'G2_DCCS';
    if (view === 'g3') return 'G3_TOM';
    if (view === 'g4') return 'G4B_MOTOR';
    if (view === 'ema') return 'ema';
    return 'hub';
  };

  const updateSensory = (
    setting: keyof SensoryCalmSettings,
    nextVal: boolean | number,
  ) => {
    setSession((prev) => {
      const prevVal = prev.sensorySettingsFinal[setting];
      const nextSettings: SensoryCalmSettings = {
        ...prev.sensorySettingsFinal,
        [setting]: nextVal,
      };
      return appendSensoryAdjustment(
        prev,
        {
          timestampMs: performance.now(),
          setting,
          previousValue: prevVal,
          nextValue: nextVal,
          activeGameId: activeGameContext(),
        },
        nextSettings,
      );
    });
  };

  const grantGuaranteedReward = (prev: RawSessionPayload): RawSessionPayload => {
    const nextSticker = STICKER_CATALOG.find(
      (s) => !prev.customization.unlockedStickers.includes(s.id),
    );
    const nextAcc = ACCESSORY_CATALOG.find(
      (a) => !prev.customization.unlockedAccessories.includes(a.id),
    );
    const baseNeeds = prev.customization.petNeeds ?? createDefaultPetNeeds();
    return {
      ...prev,
      customization: {
        ...prev.customization,
        unlockedStickers: nextSticker
          ? [...prev.customization.unlockedStickers, nextSticker.id]
          : prev.customization.unlockedStickers,
        unlockedAccessories: nextAcc
          ? [...prev.customization.unlockedAccessories, nextAcc.id]
          : prev.customization.unlockedAccessories,
        petNeeds: {
          ...baseNeeds,
          joy: Math.min(100, baseNeeds.joy + 12),
          lastUpdatedMs: Date.now(),
        },
      },
    };
  };

  const showRewardBanner = (label: string) => {
    setCelebrationToast(label);
    window.setTimeout(() => setCelebrationToast(null), 3200);
  };

  const completedGames = useMemo(() => {
    const set = new Set<GameId>();
    for (const t of session.trials) {
      if (!t.isPractice) set.add(t.gameId);
    }
    return set;
  }, [session.trials]);

  const handleCompleteTrials = (gameId: GameId, newTrials: TrialRecord[]) => {
    setSession((prev) => {
      const filtered = prev.trials.filter((t) => t.gameId !== gameId);
      return grantGuaranteedReward({ ...prev, trials: [...filtered, ...newTrials] });
    });
    setView('hub');
    showRewardBanner('¡Nueva pegatina y accesorio ganados! ★');
  };

  const handleCompleteGame4 = (res: {
    trials: TrialRecord[];
    strokes: StrokeRecord[];
    rhythmicTapIntervalsMs: number[];
  }) => {
    setSession((prev) => {
      const filtered = prev.trials.filter(
        (t) => t.gameId !== 'G4A_PREF' && t.gameId !== 'G4B_MOTOR',
      );
      return grantGuaranteedReward({
        ...prev,
        trials: [...filtered, ...res.trials],
        strokes: res.strokes,
        rhythmicTapInterIntervalsMs: [
          ...prev.rhythmicTapInterIntervalsMs,
          ...res.rhythmicTapIntervalsMs,
        ],
      });
    });
    setView('hub');
    showRewardBanner('¡Jardín completado! Ganaste un premio para AuriKat ★');
  };

  const handleSaveEma = (entry: EmaEntry) => {
    setSession((prev) => {
      const withEma = appendEmaEntry(prev, entry);
      return grantGuaranteedReward({
        ...withEma,
        customization: {
          ...withEma.customization,
          sharedDaysCount: Math.max(1, withEma.emaEntries.length),
        },
      });
    });
    showRewardBanner('¡Gracias por compartir tu día con AuriKat! ☀');
  };

  const handleUpdateNeeds = (nextNeeds: CozyPetNeeds) => {
    setSession((prev) => ({
      ...prev,
      customization: {
        ...prev.customization,
        petNeeds: nextNeeds,
      },
    }));
  };

  const handleSamplesObserved = (samples: PointerSample[], coalescedSupported: boolean) => {
    setSession((prev) => ({
      ...prev,
      deviceMeta: updateDeviceMetaFromSamples(prev.deviceMeta, samples, coalescedSupported),
    }));
  };

  const handleWipeAll = async () => {
    await storage.wipeAll();
    const fresh = createInitialSessionPayload();
    setSession(fresh);
    setPilotSettings({ pilotAssentEnabled: true, savedClinicianLockCode: '' });
    setView('hub');
  };

  const pacingMode: SessionPacingMode = session.pacingMode ?? 'clinical_full';

  return (
    <div
      className="ak-shell"
      data-dim={session.sensorySettingsFinal.dimLight}
      data-motion={session.sensorySettingsFinal.motionScale === 0 ? '0' : '1'}
    >
      <SensoryCalmBar
        settings={session.sensorySettingsFinal}
        showHomeButton={view !== 'hub'}
        onGoHome={() => {
          gentleSoundEngine.playCue('tap_soft');
          setView('hub');
        }}
        onToggleMute={() => updateSensory('muted', !session.sensorySettingsFinal.muted)}
        onToggleDim={() => updateSensory('dimLight', !session.sensorySettingsFinal.dimLight)}
        onToggleMotion={() =>
          updateSensory('motionScale', session.sensorySettingsFinal.motionScale === 0 ? 1 : 0)
        }
        onOpenPause={() => {
          setPauseOpen(true);
          setSession((prev) =>
            appendSensoryAdjustment(
              prev,
              {
                timestampMs: performance.now(),
                setting: 'pause_opened',
                previousValue: false,
                nextValue: true,
                activeGameId: activeGameContext(),
              },
              prev.sensorySettingsFinal,
            ),
          );
        }}
        onUnlockParentalGate={() => setParentGateOpen(true)}
      />

      <main className="ak-main">
        {celebrationToast ? (
          <div
            className="ak-nurture-pill"
            role="status"
            style={{
              alignSelf: 'center',
              background: 'var(--ak-accent)',
              color: '#F7F9F5',
              padding: '10px 22px',
            }}
          >
            {celebrationToast}
          </div>
        ) : null}

        {pilotSettings.pilotAssentEnabled && !assentResolved ? (
          <ChildAssentScreen
            creatureInputs={creatureInputs}
            declined={assentDeclined}
            onAccept={() => {
              gentleSoundEngine.unlock();
              gentleSoundEngine.playCue('animalese_happy');
              setAssentDeclined(false);
              setAssentResolved(true);
              setSession((prev) => ({
                ...prev,
                assent: { shown: true, accepted: true, acceptedAtMs: performance.now() },
              }));
            }}
            onDecline={() => {
              gentleSoundEngine.playCue('animalese_comfort');
              setAssentDeclined(true);
              setSession((prev) => ({
                ...prev,
                assent: { shown: true, accepted: false, declinedAtMs: performance.now() },
              }));
            }}
          />
        ) : view === 'hub' ? (
          <section className="ak-stage-card" aria-label="Hogar interactivo de AuriKat">
            {/* Species-Specific Interactive Home + 6 Hearthstone Props + Cozy Care Bar */}
            <InteractiveHabitatStage
              creatureInputs={creatureInputs}
              petNeeds={session.customization.petNeeds}
              sharedDaysCount={session.customization.sharedDaysCount}
              stickersCount={session.customization.unlockedStickers.length}
              onUpdateNeeds={handleUpdateNeeds}
            />

            {/* Daily Diary & Customization Row */}
            <div className="ak-row" style={{ width: '100%' }}>
              <button
                type="button"
                className="ak-btn-accent"
                style={{ flex: 1 }}
                onClick={() => {
                  gentleSoundEngine.playCue('tap_soft');
                  setView('ema');
                }}
              >
                <span>☀ Mi Día con AuriKat</span>
              </button>
              <button
                type="button"
                className="ak-primary-target"
                style={{ flex: 1, minHeight: 64, flexDirection: 'row' }}
                onClick={() => {
                  gentleSoundEngine.playCue('tap_soft');
                  setView('customise');
                }}
              >
                <span>🎨 Especie, Hogar y Álbum</span>
              </button>
            </div>

            {/* 4 Redesigned Crystal-Clear Minigame Tiles */}
            <div className="ak-activity-grid">
              <button
                type="button"
                className="ak-game-tile"
                data-done={completedGames.has('G1_JA')}
                onClick={() => {
                  gentleSoundEngine.unlock();
                  gentleSoundEngine.playCue('animalese_curious');
                  setView('g1');
                }}
              >
                <svg width="46" height="46" viewBox="0 0 48 48" aria-hidden="true">
                  <rect x="6" y="18" width="36" height="22" rx="6" fill="#B58E65" stroke="#4A3C31" strokeWidth="2.5" />
                  <polygon points="24,5 27,13 35,14 29,19 31,27 24,22 17,27 19,19 13,14 21,13" fill="var(--ak-au-gold)" />
                </svg>
                <strong>1. ¿Dónde miró?</strong>
              </button>

              <button
                type="button"
                className="ak-game-tile"
                data-done={completedGames.has('G2_DCCS')}
                onClick={() => {
                  gentleSoundEngine.unlock();
                  gentleSoundEngine.playCue('tap_soft');
                  setView('g2');
                }}
              >
                <svg width="46" height="46" viewBox="0 0 48 48" aria-hidden="true">
                  <polygon points="15,8 19,17 28,18 21,24 23,34 15,29 7,34 9,24 2,18 11,17" fill="#5B85A8" />
                  <circle cx="34" cy="30" r="11" fill="#C77A6B" />
                </svg>
                <strong>2. Ordená las Cajas</strong>
              </button>

              <button
                type="button"
                className="ak-game-tile"
                data-done={completedGames.has('G3_TOM')}
                onClick={() => {
                  gentleSoundEngine.unlock();
                  gentleSoundEngine.playCue('animalese_curious');
                  setView('g3');
                }}
              >
                <svg width="46" height="46" viewBox="0 0 48 48" aria-hidden="true">
                  <circle cx="24" cy="24" r="18" fill="var(--ak-accent-soft)" stroke="var(--ak-accent)" strokeWidth="2.8" />
                  <circle cx="18" cy="21" r="2.8" fill="var(--ak-ink)" />
                  <circle cx="30" cy="21" r="2.8" fill="var(--ak-ink)" />
                  <path d="M17 30 Q24 35 31 30" fill="none" stroke="var(--ak-ink)" strokeWidth="2.8" strokeLinecap="round" />
                </svg>
                <strong>3. Historias</strong>
              </button>

              <button
                type="button"
                className="ak-game-tile"
                data-done={completedGames.has('G4B_MOTOR')}
                onClick={() => {
                  gentleSoundEngine.unlock();
                  gentleSoundEngine.playCue('tap_soft');
                  setView('g4');
                }}
              >
                <svg width="46" height="46" viewBox="0 0 48 48" aria-hidden="true">
                  <path d="M8 34 Q24 10 40 34" fill="none" stroke="var(--ak-au-gold)" strokeWidth="4.5" strokeLinecap="round" />
                  <circle cx="10" cy="33" r="6" fill="var(--ak-au-gold)" />
                  <circle cx="38" cy="33" r="7" fill="var(--ak-accent)" />
                </svg>
                <strong>4. Burbujas y Cometas</strong>
              </button>
            </div>
          </section>
        ) : view === 'customise' ? (
          <CreatureCustomiser
            customization={session.customization}
            motionScale={session.sensorySettingsFinal.motionScale}
            onUpdate={(next) => setSession((prev) => ({ ...prev, customization: next }))}
            onClose={() => setView('hub')}
          />
        ) : view === 'ema' ? (
          <DailyMoodHabits
            creatureInputs={creatureInputs}
            defaultEntryMode={session.ageMonths < 84 ? 'caregiver_assisted' : 'child_solo'}
            existingEntriesCount={session.emaEntries.length}
            onSaveEntry={handleSaveEma}
            onClose={() => setView('hub')}
          />
        ) : view === 'g1' ? (
          <JointAttentionGame
            creatureInputs={creatureInputs}
            subAgeBand={session.subAgeBand}
            pacingMode={pacingMode}
            sensorySettings={session.sensorySettingsFinal}
            onComplete={(t) => handleCompleteTrials('G1_JA', t)}
          />
        ) : view === 'g2' ? (
          <CognitiveFlexibilityGame
            subAgeBand={session.subAgeBand}
            pacingMode={pacingMode}
            sensorySettings={session.sensorySettingsFinal}
            onComplete={(t) => handleCompleteTrials('G2_DCCS', t)}
          />
        ) : view === 'g3' ? (
          <EmotionToMGame
            creatureInputs={creatureInputs}
            subAgeBand={session.subAgeBand}
            formVariant={session.formVariant}
            pacingMode={pacingMode}
            sensorySettings={session.sensorySettingsFinal}
            onComplete={(t) => handleCompleteTrials('G3_TOM', t)}
          />
        ) : (
          <SocialGeoMotorGame
            creatureInputs={creatureInputs}
            pacingMode={pacingMode}
            sensorySettings={session.sensorySettingsFinal}
            onSamplesObserved={handleSamplesObserved}
            onComplete={handleCompleteGame4}
          />
        )}
      </main>

      {pauseOpen ? (
        <div className="ak-modal-backdrop" role="dialog" aria-modal="true" aria-label="Pausa de calma">
          <div className="ak-modal" style={{ alignItems: 'center', textAlign: 'center' }}>
            <div className="ak-breathe-orb" />
            <h2 style={{ margin: 0 }}>Pausa tranquila</h2>
            <p style={{ margin: 0, color: 'var(--ak-ink-muted)' }}>
              Respirá despacio con AuriKat. No hay reloj ni apuro.
            </p>
            <button type="button" className="ak-btn-accent" onClick={() => setPauseOpen(false)}>
              <span>Seguir jugando</span>
            </button>
          </div>
        </div>
      ) : null}

      {parentGateOpen ? (
        <ParentalExportGate
          session={session}
          pilotAssentEnabled={pilotSettings.pilotAssentEnabled}
          savedClinicianLockCode={pilotSettings.savedClinicianLockCode}
          onUpdateSessionMeta={(u: {
            participantPseudoId: string;
            ageMonths: number;
            sexAssigned: RawSessionPayload['sexAssigned'];
            subAgeBand: SubAgeBand;
            formVariant: FormVariant;
            pacingMode: SessionPacingMode;
          }) =>
            setSession((prev) => ({
              ...prev,
              participantPseudoId: u.participantPseudoId,
              ageMonths: u.ageMonths,
              sexAssigned: u.sexAssigned,
              subAgeBand: u.subAgeBand,
              formVariant: u.formVariant,
              pacingMode: u.pacingMode,
            }))
          }
          onTogglePilotAssent={(enabled) =>
            setPilotSettings((prev) => ({ ...prev, pilotAssentEnabled: enabled }))
          }
          onSaveClinicianLock={(lockCode) =>
            setPilotSettings((prev) => ({ ...prev, savedClinicianLockCode: lockCode }))
          }
          onWipeAllData={handleWipeAll}
          onClose={() => setParentGateOpen(false)}
        />
      ) : null}
    </div>
  );
};

export default App;
