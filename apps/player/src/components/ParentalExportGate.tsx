import React, { useMemo, useState } from 'react';
import {
  generateFriendlyPassphrase,
  parseClinicianLockCode,
  sealEnvelopeForClinicianLock,
  sealEnvelopeWithPassphrase,
  shareOrDownloadEnvelopeText,
} from '@aurikat/clinical-envelope';
import type { FormVariant, RawSessionPayload, SessionPacingMode, SubAgeBand } from '@aurikat/core-engine';

interface ParentalExportGateProps {
  session: RawSessionPayload;
  pilotAssentEnabled: boolean;
  savedClinicianLockCode: string;
  onUpdateSessionMeta: (updates: {
    participantPseudoId: string;
    ageMonths: number;
    sexAssigned: RawSessionPayload['sexAssigned'];
    subAgeBand: SubAgeBand;
    formVariant: FormVariant;
    pacingMode: SessionPacingMode;
  }) => void;
  onTogglePilotAssent: (enabled: boolean) => void;
  onSaveClinicianLock: (lockCode: string) => void;
  onWipeAllData: () => Promise<void>;
  onClose: () => void;
}

interface AdultChallenge {
  prompt: string;
  expectedAnswer: string;
}

/**
 * Age-Resilient Adult Parental Gate challenges (SEC-02: rejects trivial 3x7 solved by 7-8y children).
 */
const ADULT_CHALLENGES: AdultChallenge[] = [
  {
    prompt: 'Escribí en dígitos el año inmediatamente posterior a mil novecientos noventa y ocho:',
    expectedAnswer: '1999',
  },
  {
    prompt: 'Escribí en dígitos cuántos minutos hay en dos horas y quince minutos:',
    expectedAnswer: '135',
  },
  {
    prompt: 'Escribí la primera palabra en orden alfabético entre: brújula, otoño, lámpara:',
    expectedAnswer: 'brújula',
  },
  {
    prompt: 'Escribí en dígitos el año anterior a dos mil veinticinco:',
    expectedAnswer: '2024',
  },
];

function normalizeAnswer(val: string): string {
  return val
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * ParentalExportGate — Strictly inside apps/player.
 * NEVER renders any clinical score, profile, radar or diagnostic label.
 * Only allows pseudonymized configuration, Mode A / Mode B encrypted .aurikat.txt export,
 * PWA Home Screen guidance (anti-ITP), and 1-click irreversible wipe (COPPA 2025).
 */
export const ParentalExportGate: React.FC<ParentalExportGateProps> = ({
  session,
  pilotAssentEnabled,
  savedClinicianLockCode,
  onUpdateSessionMeta,
  onTogglePilotAssent,
  onSaveClinicianLock,
  onWipeAllData,
  onClose,
}) => {
  const challenge = useMemo(
    () => ADULT_CHALLENGES[Math.floor(Math.random() * ADULT_CHALLENGES.length)],
    [],
  );
  const [unlocked, setUnlocked] = useState(false);
  const [answer, setAnswer] = useState('');
  const [gateError, setGateError] = useState('');

  // Editable pseudonymized fields
  const [pseudoId, setPseudoId] = useState(session.participantPseudoId);
  const [ageMonths, setAgeMonths] = useState(String(session.ageMonths));
  const [sexAssigned, setSexAssigned] = useState<RawSessionPayload['sexAssigned']>(session.sexAssigned);
  const [formVariant, setFormVariant] = useState<FormVariant>(session.formVariant);
  const [pacingMode, setPacingMode] = useState<SessionPacingMode>(session.pacingMode ?? 'clinical_full');

  // Mode A vs Mode B export state
  const [exportMode, setExportMode] = useState<'A' | 'B'>(savedClinicianLockCode ? 'B' : 'A');
  const [passphrase, setPassphrase] = useState(() => generateFriendlyPassphrase());
  const [lockCode, setLockCode] = useState(savedClinicianLockCode);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [confirmWipe, setConfirmWipe] = useState(false);

  const handleCheckChallenge = (e: React.FormEvent) => {
    e.preventDefault();
    if (normalizeAnswer(answer) === normalizeAnswer(challenge.expectedAnswer)) {
      setUnlocked(true);
      setGateError('');
    } else {
      setGateError('Respuesta incorrecta. Esta sección es exclusiva para adultos responsables.');
    }
  };

  const applyMetaChanges = () => {
    const parsedAge = Math.max(24, Math.min(180, Number(ageMonths) || 72));
    const band: SubAgeBand = parsedAge < 72 ? '4_5' : '6_8';
    const cleanId = pseudoId.trim().replace(/[^A-Za-z0-9_-]/g, '') || session.participantPseudoId;
    onUpdateSessionMeta({
      participantPseudoId: cleanId,
      ageMonths: parsedAge,
      sexAssigned,
      subAgeBand: band,
      formVariant,
      pacingMode,
    });
    return { cleanId, parsedAge, band };
  };

  const buildSealedEnvelope = async () => {
    const { cleanId, parsedAge, band } = applyMetaChanges();
    const exportPayload: RawSessionPayload = {
      ...session,
      participantPseudoId: cleanId,
      ageMonths: parsedAge,
      sexAssigned,
      subAgeBand: band,
      formVariant,
      pacingMode,
      exportedAtIso: new Date().toISOString(),
    };

    let armored = '';
    if (exportMode === 'A') {
      armored = await sealEnvelopeWithPassphrase(exportPayload, passphrase);
    } else {
      const parsedLock = parseClinicianLockCode(lockCode);
      onSaveClinicianLock(lockCode.trim());
      armored = await sealEnvelopeForClinicianLock(exportPayload, lockCode.trim());
      setStatusMsg(`Sobre sellado exclusivamente para el candado de "${parsedLock.label}" (ID ${parsedLock.keyId}).`);
    }
    return { armored, cleanId };
  };

  const handleExport = async () => {
    setBusy(true);
    setStatusMsg('');
    try {
      const { armored, cleanId } = await buildSealedEnvelope();
      const method = await shareOrDownloadEnvelopeText(armored, cleanId);
      setStatusMsg((prev) =>
        `${prev ? prev + ' ' : ''}${
          method === 'shared'
            ? 'Paquete .aurikat.txt cifrado compartido correctamente.'
            : 'Archivo .aurikat.txt descargado. Subilo en el botón «Importar .aurikat.txt» del portal del profesional.'
        }`,
      );
    } catch (err) {
      setStatusMsg(err instanceof Error ? `Error: ${err.message}` : 'No se pudo generar el archivo cifrado.');
    } finally {
      setBusy(false);
    }
  };

  const handleCopyEncrypted = async () => {
    setBusy(true);
    setStatusMsg('');
    try {
      const { armored } = await buildSealedEnvelope();
      const clipboardPayload =
        exportMode === 'A'
          ? `CLAVE-AURIKAT: ${passphrase.trim()}\n${armored}`
          : armored;
      await navigator.clipboard.writeText(clipboardPayload);
      setStatusMsg(
        '✅ ¡Paquete cifrado copiado al portapapeles! Ahora abrí la página del profesional y tocá «📋 Pegar paquete cifrado».',
      );
    } catch (err) {
      setStatusMsg(
        err instanceof Error ? `Error al copiar: ${err.message}` : 'No se pudo copiar al portapapeles.',
      );
    } finally {
      setBusy(false);
    }
  };

  const countScored = (gid: RawSessionPayload['trials'][number]['gameId']) =>
    session.trials.filter((t) => !t.isPractice && t.gameId === gid).length;

  const g1Count = countScored('G1_JA');
  const g2Count = countScored('G2_DCCS');
  const g3Count = countScored('G3_TOM');
  const g4aNewCount = countScored('G4_SENSORY_SOCIAL');
  const g4bNewCount = countScored('G4_DETAIL_NAVON');
  const g4ClassicCount = countScored('G4A_PREF') + session.strokes.length;

  return (
    <div className="ak-modal-backdrop" role="dialog" aria-modal="true" aria-label="Área para padres y cuidadores">
      <div className="ak-modal">
        <div className="ak-row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>🔒 Adultos y Exportación de Sesión</h2>
          <button type="button" className="ak-icon-btn" style={{ minWidth: 44, minHeight: 44 }} onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        {!unlocked ? (
          <form onSubmit={handleCheckChallenge} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="ak-subtle-box">
              Puerta Parental: para proteger el entorno del niño, resolvé esta verificación adulta antes de continuar.
            </div>
            <label style={{ fontWeight: 700 }}>{challenge.prompt}</label>
            <input
              className="ak-input"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Escribí tu respuesta aquí"
              autoFocus
            />
            {gateError ? <div style={{ color: '#9B4444', fontWeight: 600 }}>{gateError}</div> : null}
            <button type="submit" className="ak-btn-accent">
              <span>Desbloquear Área de Adultos</span>
            </button>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Neutral Session Progress Summary */}
            <div className="ak-subtle-box" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <strong>Actividades registradas en esta sesión (listas para exportar):</strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: '0.8rem' }}>
                <span className="ak-phase-pill">
                  1. ¿Dónde miró?: <strong>{g1Count > 0 ? `✓ (${g1Count})` : 'Pendiente'}</strong>
                </span>
                <span className="ak-phase-pill">
                  2. Cajas: <strong>{g2Count > 0 ? `✓ (${g2Count})` : 'Pendiente'}</strong>
                </span>
                <span className="ak-phase-pill">
                  3. Historias: <strong>{g3Count > 0 ? `✓ (${g3Count})` : 'Pendiente'}</strong>
                </span>
                <span className="ak-phase-pill">
                  4A. Día de AuriKat: <strong>{g4aNewCount > 0 ? `✓ (${g4aNewCount})` : 'Pendiente'}</strong>
                </span>
                <span className="ak-phase-pill">
                  4B. Detective: <strong>{g4bNewCount > 0 ? `✓ (${g4bNewCount})` : 'Pendiente'}</strong>
                </span>
                {g4ClassicCount > 0 ? (
                  <span className="ak-phase-pill">
                    4. Clásico: <strong>✓ ({g4ClassicCount})</strong>
                  </span>
                ) : null}
                <span className="ak-phase-pill">
                  ☀ Mi Día: <strong>{session.emaEntries.length} día(s)</strong>
                </span>
              </div>
            </div>

            {/* Pseudonymized Metadata */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: '0.84rem', fontWeight: 700 }}>ID Pseudonimizado (sin nombre real)</label>
                <input
                  className="ak-input"
                  value={pseudoId}
                  onChange={(e) => setPseudoId(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.84rem', fontWeight: 700 }}>Edad en meses (48–107 = 4–8 años)</label>
                <input
                  type="number"
                  min={24}
                  max={180}
                  className="ak-input"
                  value={ageMonths}
                  onChange={(e) => setAgeMonths(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.84rem', fontWeight: 700 }}>Sexo (opcional, equidad Beta)</label>
                <select
                  className="ak-input"
                  value={sexAssigned}
                  onChange={(e) => setSexAssigned(e.target.value as RawSessionPayload['sexAssigned'])}
                >
                  <option value="NA">No informar</option>
                  <option value="F">Femenino</option>
                  <option value="M">Masculino</option>
                  <option value="X">Otro / X</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.84rem', fontWeight: 700 }}>Forma Paralela (re-test)</label>
                <select
                  className="ak-input"
                  value={formVariant}
                  onChange={(e) => setFormVariant(e.target.value as FormVariant)}
                >
                  <option value="A">Forma A</option>
                  <option value="B">Forma B</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '0.84rem', fontWeight: 700 }}>
                  Duración / Ritmo de los Minijuegos
                </label>
                <select
                  className="ak-input"
                  value={pacingMode}
                  onChange={(e) => setPacingMode(e.target.value as SessionPacingMode)}
                >
                  <option value="clinical_full">Modo Completo (Recomendado para sesiones completas)</option>
                  <option value="quick_demo">Modo Prueba Rápida (Mitad de turnos para demostración ágil)</option>
                </select>
              </div>
            </div>

            {/* Beta Pilot Visual Assent Toggle */}
            <label className="ak-row" style={{ cursor: 'pointer', fontSize: '0.88rem' }}>
              <input
                type="checkbox"
                checked={pilotAssentEnabled}
                onChange={(e) => onTogglePilotAssent(e.target.checked)}
              />
              <span>Mostrar pantalla de Asentimiento Infantil Visual al iniciar (modo Piloto Beta)</span>
            </label>

            {/* Encrypted Envelope Export Selector (Mode A vs Mode B) */}
            <div style={{ borderTop: '1px solid var(--ak-surface-raised)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <strong style={{ fontSize: '1rem' }}>Exportar sobre cifrado (.aurikat.txt) para el Profesional</strong>
              <div className="ak-row">
                <button
                  type="button"
                  className="ak-primary-target"
                  style={{ flex: 1, minHeight: 50 }}
                  data-selected={exportMode === 'A'}
                  onClick={() => setExportMode('A')}
                >
                  <span>Modo A: Contraseña simple</span>
                </button>
                <button
                  type="button"
                  className="ak-primary-target"
                  style={{ flex: 1, minHeight: 50 }}
                  data-selected={exportMode === 'B'}
                  onClick={() => setExportMode('B')}
                >
                  <span>Modo B: Candado del profesional</span>
                </button>
              </div>

              {exportMode === 'A' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                    Clave de protección (incluida al copiar en 1 clic, o anotar si descargás archivo)
                  </label>
                  <div className="ak-row">
                    <input
                      className="ak-input"
                      style={{ flex: 1 }}
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                    />
                    <button
                      type="button"
                      className="ak-primary-target"
                      style={{ minHeight: 46, padding: '8px 14px' }}
                      onClick={() => setPassphrase(generateFriendlyPassphrase())}
                    >
                      <span>Nueva</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                    Pegá el código de candado público del profesional (<code>AURIKAT-LOCK-V2:...</code>)
                  </label>
                  <textarea
                    className="ak-input"
                    rows={3}
                    value={lockCode}
                    onChange={(e) => setLockCode(e.target.value)}
                    placeholder="AURIKAT-LOCK-V2:..."
                  />
                </div>
              )}

              <div className="ak-row" style={{ gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="ak-btn-accent"
                  style={{ flex: 1, minWidth: 210 }}
                  disabled={busy}
                  onClick={handleCopyEncrypted}
                >
                  <span>{busy ? 'Cifrando...' : '📋 Copiar paquete cifrado (1 clic)'}</span>
                </button>

                <button
                  type="button"
                  className="ak-primary-target"
                  style={{ flex: 1, minWidth: 210, minHeight: 54, fontWeight: 800 }}
                  disabled={busy}
                  onClick={handleExport}
                >
                  <span>💾 Descargar archivo .aurikat.txt</span>
                </button>
              </div>

              {statusMsg ? (
                <div className="ak-subtle-box" style={{ color: 'var(--ak-ink)', fontWeight: 700 }}>
                  {statusMsg}
                </div>
              ) : null}

              <div className="ak-subtle-box" style={{ fontSize: '0.8rem' }}>
                <strong>¿Cómo verlo en el portal del profesional?</strong> 1) Tocá{' '}
                <em>«📋 Copiar paquete cifrado»</em> arriba (o descargá el archivo <code>.aurikat.txt</code>). 2) Abrí la
                página del profesional y tocá <em>«📋 Pegar paquete cifrado»</em> (o <em>«Importar .aurikat.txt»</em>).
              </div>
            </div>

            {/* iOS Home Screen PWA anti-ITP tip & 1-click COPPA wipe */}
            <div className="ak-subtle-box" style={{ fontSize: '0.83rem' }}>
              <strong>Consejo iPad/iPhone:</strong> Para evitar que Safari borre los días guardados tras 7 días sin uso,
              tocá «Compartir → Agregar a pantalla de inicio» y usá AuriKat desde el ícono instalado.
            </div>

            <div className="ak-row" style={{ justifyContent: 'space-between', paddingTop: 6 }}>
              {!confirmWipe ? (
                <button
                  type="button"
                  className="ak-primary-target"
                  style={{ minHeight: 46, padding: '8px 14px', color: '#8E3E3E' }}
                  onClick={() => setConfirmWipe(true)}
                >
                  <span>Borrar todos los datos locales</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="ak-btn-accent"
                  style={{ background: '#8E3E3E', minHeight: 46 }}
                  onClick={async () => {
                    await onWipeAllData();
                    setConfirmWipe(false);
                    onClose();
                  }}
                >
                  <span>Confirmar borrado irreversible</span>
                </button>
              )}

              <button
                type="button"
                className="ak-primary-target"
                style={{ minHeight: 46, padding: '8px 16px' }}
                onClick={() => {
                  applyMetaChanges();
                  onClose();
                }}
              >
                <span>Guardar y volver</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
