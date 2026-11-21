import React from 'react';
import {
  ACCESSORY_CATALOG,
  ARCHETYPE_CATALOG,
  CALM_PALETTES,
  gentleSoundEngine,
  SPECIES_CATALOG,
  STICKER_CATALOG,
  type AccessoryId,
  type CreatureViewModelInputs,
  type PaletteId,
  type PlayerCustomization,
  type SpeciesId,
} from '@aurikat/core-engine';
import { ProceduralCreatureRig } from './ProceduralCreatureRig.js';

interface CreatureCustomiserProps {
  customization: PlayerCustomization;
  motionScale: number;
  onUpdate: (next: PlayerCustomization) => void;
  onClose: () => void;
}

const StickerIcon: React.FC<{ motif: (typeof STICKER_CATALOG)[number]['motif']; color: string }> = ({
  motif,
  color,
}) => (
  <svg width="38" height="38" viewBox="0 0 40 40" aria-hidden="true">
    <circle cx="20" cy="20" r="18" fill={color} opacity="0.18" />
    {motif === 'star' && <polygon points="20,6 24,15 34,16 26,23 28,33 20,28 12,33 14,23 6,16 16,15" fill={color} />}
    {motif === 'leaf' && <path d="M10 30 Q10 10 30 10 Q30 30 10 30 Z" fill={color} />}
    {motif === 'paw' && (
      <g fill={color}>
        <circle cx="20" cy="24" r="6" />
        <circle cx="12" cy="16" r="3" />
        <circle cx="18" cy="12" r="3" />
        <circle cx="24" cy="12" r="3" />
        <circle cx="29" cy="16" r="3" />
      </g>
    )}
    {motif === 'cloud' && <path d="M12 27h17a5 5 0 0 0 0-10 7 7 0 0 0-13-2 5 5 0 0 0-4 12z" fill={color} />}
    {motif === 'moon' && <path d="M26 24A10 10 0 1 1 17 10a8 8 0 0 0 9 14z" fill={color} />}
    {motif === 'acorn' && (
      <g fill={color}>
        <path d="M11 18 Q20 9 29 18 Z" />
        <path d="M13 19 h14 q0 11 -7 13 q-7 -2 -7 -13 z" opacity="0.82" />
      </g>
    )}
    {motif === 'shell' && <path d="M8 26 Q20 8 32 26 Q20 31 8 26 Z" fill={color} />}
    {motif === 'butterfly' && (
      <g fill={color}>
        <ellipse cx="14" cy="18" rx="6" ry="8" />
        <ellipse cx="26" cy="18" rx="6" ry="8" />
      </g>
    )}
  </svg>
);

export const CreatureCustomiser: React.FC<CreatureCustomiserProps> = ({
  customization,
  motionScale,
  onUpdate,
  onClose,
}) => {
  const previewInputs: CreatureViewModelInputs = {
    lookX: 0,
    lookY: 0,
    emotion: 'happy',
    action: 'idle',
    species: customization.species,
    archetype: customization.archetype,
    paletteId: customization.paletteId,
    accessory: customization.accessory,
    motionScale,
  };

  const selectSpecies = (species: SpeciesId) => {
    gentleSoundEngine.playCue('tap_soft');
    onUpdate({ ...customization, species });
  };

  const selectArchetype = (archetype: PlayerCustomization['archetype']) => {
    gentleSoundEngine.playCue('tap_soft');
    onUpdate({ ...customization, archetype });
  };

  const selectPalette = (paletteId: PaletteId) => {
    gentleSoundEngine.playCue('tap_soft');
    onUpdate({ ...customization, paletteId });
  };

  const selectAccessory = (accessory: AccessoryId) => {
    if (!customization.unlockedAccessories.includes(accessory)) return;
    gentleSoundEngine.playCue('animalese_happy');
    onUpdate({ ...customization, accessory });
  };

  return (
    <section className="ak-stage-card" aria-label="Personalizar compañero y álbum">
      <div className="ak-companion-nest" style={{ width: '100%', maxWidth: 320 }}>
        <ProceduralCreatureRig inputs={previewInputs} size={190} />
      </div>

      {/* 3 Universal Species (BRD-02) */}
      <div style={{ width: '100%' }}>
        <div className="ak-row" style={{ justifyContent: 'center' }}>
          {(Object.keys(SPECIES_CATALOG) as SpeciesId[]).map((spId) => (
            <button
              key={spId}
              type="button"
              className="ak-primary-target"
              data-selected={customization.species === spId}
              onClick={() => selectSpecies(spId)}
            >
              <ProceduralCreatureRig
                inputs={{ ...previewInputs, species: spId, motionScale: 0 }}
                size={54}
              />
              <span>{SPECIES_CATALOG[spId].label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3 Cultural Archetypes (MKT-02) */}
      <div className="ak-row" style={{ justifyContent: 'center' }}>
        {ARCHETYPE_CATALOG.filter((a) => a.availableInBeta).map((arch) => (
          <button
            key={arch.id}
            type="button"
            className="ak-primary-target"
            data-selected={customization.archetype === arch.id}
            onClick={() => selectArchetype(arch.id as PlayerCustomization['archetype'])}
          >
            <span style={{ fontSize: '0.95rem' }}>{arch.label}</span>
          </button>
        ))}
      </div>

      {/* 5 Calm Sensory Palettes (UX-01) */}
      <div className="ak-row" style={{ justifyContent: 'center' }}>
        {(Object.keys(CALM_PALETTES) as PaletteId[]).map((palId) => {
          const p = CALM_PALETTES[palId];
          return (
            <button
              key={palId}
              type="button"
              className="ak-primary-target"
              style={{ minWidth: 74, minHeight: 74, background: p.bg, color: p.ink }}
              data-selected={customization.paletteId === palId}
              onClick={() => selectPalette(palId)}
              aria-label={p.name}
              title={p.name}
            >
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: p.accent,
                  border: `3px solid ${p.auGold}`,
                  display: 'inline-block',
                }}
              />
            </button>
          );
        })}
      </div>

      {/* Deterministic Unlocked Accessories (SDT / RITEC-8 — 0 loot boxes) */}
      <div className="ak-row" style={{ justifyContent: 'center' }}>
        {ACCESSORY_CATALOG.map((acc) => {
          const unlocked = customization.unlockedAccessories.includes(acc.id);
          return (
            <button
              key={acc.id}
              type="button"
              className="ak-primary-target"
              style={{ opacity: unlocked ? 1 : 0.42, minWidth: 96 }}
              data-selected={customization.accessory === acc.id}
              disabled={!unlocked}
              onClick={() => selectAccessory(acc.id)}
            >
              <span>{unlocked ? acc.label : '🔒'}</span>
            </button>
          );
        })}
      </div>

      {/* Cumulative Sticker Album */}
      <div className="ak-subtle-box" style={{ width: '100%' }}>
        <div className="ak-row" style={{ justifyContent: 'center', gap: 14 }}>
          {STICKER_CATALOG.map((st) => {
            const earned = customization.unlockedStickers.includes(st.id);
            return (
              <div
                key={st.id}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: 'var(--ak-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: earned ? 1 : 0.25,
                }}
              >
                <StickerIcon motif={st.motif} color={st.color} />
              </div>
            );
          })}
        </div>
      </div>

      <button type="button" className="ak-btn-accent" onClick={onClose}>
        <span>Listo</span>
      </button>
    </section>
  );
};
