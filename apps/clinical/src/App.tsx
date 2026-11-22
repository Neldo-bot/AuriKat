import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  IndexedDbStorageAdapter,
  type RawSessionPayload,
} from '@aurikat/core-engine';
import {
  generateClinicianKeyPair,
  inspectEnvelopeMetadata,
  openEnvelopeWithClinicianPrivateKey,
  openEnvelopeWithPassphrase,
  type ClinicianKeyPairBundle,
} from '@aurikat/clinical-envelope';
import {
  DEONTOLOGICAL_NOTICE,
  EMPTY_EXTERNAL_SCORES,
  evaluateClinicalSession,
  getDemoClinicalCases,
  type ExternalBetaScores,
} from '@aurikat/clinical-scoring';
import { BetaValidationPanel } from './components/BetaValidationPanel.js';
import { ClinicalInterpretationGuide } from './components/ClinicalInterpretationGuide.js';
import { DomainRadarChart } from './components/DomainRadarChart.js';
import { KinematicsInspector } from './components/KinematicsInspector.js';
import { LongitudinalMoodChart } from './components/LongitudinalMoodChart.js';
import { PrintableClinicalReport } from './components/PrintableClinicalReport.js';

type ClinicalTab = 'overview' | 'kinematics' | 'ema' | 'beta' | 'report' | 'keys';

const vaultStorage = new IndexedDbStorageAdapter('aurikat_clinical_vault_db_v2');
const KEYPAIR_STORAGE_KEY = 'clinician_ecdh_keypair_v2';

export const App: React.FC = () => {
  const demoCases = useMemo(() => getDemoClinicalCases(), []);
  const [activeTab, setActiveTab] = useState<ClinicalTab>('overview');
  const [activeSession, setActiveSession] = useState<RawSessionPayload>(demoCases[0].session);
  const [activeSourceLabel, setActiveSourceLabel] = useState<string>(demoCases[0].title);
  const [externalScores, setExternalScores] = useState<ExternalBetaScores>(EMPTY_EXTERNAL_SCORES);

  // Clinician Mode B ECDH P-256 keypair & offline SVG QR code
  const [keyPair, setKeyPair] = useState<ClinicianKeyPairBundle | null>(null);
  const [clinicianLabel, setClinicianLabel] = useState('Consultorio Clínico AuriKat');
  const [qrSvg, setQrSvg] = useState<string>('');
  const [copyFeedback, setCopyFeedback] = useState('');

  // Importer state (.aurikat.txt Mode A or Mode B + Clipboard Paste)
  const [pendingEnvelopeText, setPendingEnvelopeText] = useState<string>('');
  const [pendingEnvelopeMode, setPendingEnvelopeMode] = useState<'passphrase_aes_gcm' | 'ecdh_p256_hybrid' | null>(null);
  const [importPassphrase, setImportPassphrase] = useState('');
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [showPartialPreview, setShowPartialPreview] = useState(true);

  // Load or generate local ECDH P-256 keypair on first launch (100% offline, zero cloud!)
  useEffect(() => {
    void (async () => {
      let existing = await vaultStorage.getItem<ClinicianKeyPairBundle>(KEYPAIR_STORAGE_KEY);
      if (!existing) {
        existing = await generateClinicianKeyPair('Consultorio Clínico AuriKat');
        await vaultStorage.setItem(KEYPAIR_STORAGE_KEY, existing, 365);
      }
      setKeyPair(existing);
      setClinicianLabel(existing.label);
    })();
  }, []);

  // Generate crisp local SVG QR code whenever clinician lock code updates (0 network requests)
  useEffect(() => {
    if (!keyPair) return;
    void QRCode.toString(keyPair.shareableLockCode, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 2,
      color: { dark: '#1F2925', light: '#FCFDFB' },
    }).then((svg) => setQrSvg(svg));
  }, [keyPair]);

  const report = useMemo(() => evaluateClinicalSession(activeSession), [activeSession]);

  const processEnvelopeRawText = async (rawText: string) => {
    setImportError('');
    setImportSuccess('');
    try {
      const keyMatch = rawText.match(/CLAVE-AURIKAT:\s*([^\r\n]+)/i);
      const extractedPass = keyMatch ? keyMatch[1].trim() : '';
      const meta = inspectEnvelopeMetadata(rawText);

      // Mode B auto-decrypts immediately if matching local clinician private key!
      if (meta.mode === 'ecdh_p256_hybrid' && keyPair) {
        try {
          const decoded = await openEnvelopeWithClinicianPrivateKey(
            rawText,
            keyPair.privateKeyJwk,
            keyPair.keyId,
          );
          setActiveSession(decoded);
          setActiveSourceLabel(`Importado (Modo B) — ${decoded.participantPseudoId}`);
          setExternalScores(EMPTY_EXTERNAL_SCORES);
          setPendingEnvelopeText('');
          setPendingEnvelopeMode(null);
          setShowPasteBox(false);
          setPastedText('');
          setShowPartialPreview(true);
          setImportSuccess(`Paquete ${decoded.participantPseudoId} descifrado automáticamente con su llave privada (Modo B).`);
          setActiveTab('overview');
          return;
        } catch {
          setImportError(
            `Este sobre fue sellado para otra llave pública (ID ${meta.clinicianKeyFingerprint ?? 'desconocido'}). Su llave activa es ${keyPair.keyId}.`,
          );
          return;
        }
      }

      // Mode A with embedded CLAVE-AURIKAT header from 1-click copy auto-decrypts in 1 step!
      if (meta.mode === 'passphrase_aes_gcm' && extractedPass) {
        try {
          const decoded = await openEnvelopeWithPassphrase(rawText, extractedPass);
          setActiveSession(decoded);
          setActiveSourceLabel(`Importado (1 clic) — ${decoded.participantPseudoId}`);
          setExternalScores(EMPTY_EXTERNAL_SCORES);
          setPendingEnvelopeText('');
          setPendingEnvelopeMode(null);
          setImportPassphrase('');
          setShowPasteBox(false);
          setPastedText('');
          setShowPartialPreview(true);
          setImportSuccess(`✅ Paquete ${decoded.participantPseudoId} descifrado automáticamente desde el portapapeles (AES-256-GCM).`);
          setActiveTab('overview');
          return;
        } catch {
          // Fall through to manual passphrase input
        }
      }

      setPendingEnvelopeText(rawText);
      setPendingEnvelopeMode(meta.mode);
      if (extractedPass) setImportPassphrase(extractedPass);
      setShowPasteBox(false);
      setPastedText('');
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Archivo o texto .aurikat.txt inválido.');
    }
  };

  const handleFileUpload = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await processEnvelopeRawText(text);
    ev.target.value = '';
  };

  const handleClipboardPasteClick = async () => {
    setImportError('');
    setImportSuccess('');
    try {
      if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
        const clip = await navigator.clipboard.readText();
        if (clip && clip.includes('-----BEGIN AURIKAT ENVELOPE V2-----')) {
          await processEnvelopeRawText(clip);
          return;
        }
      }
      setShowPasteBox((v) => !v);
    } catch {
      // Browser requested manual paste into textarea
      setShowPasteBox(true);
    }
  };

  const handleDecryptModeA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingEnvelopeText) return;
    setImportError('');
    try {
      const decoded = await openEnvelopeWithPassphrase(pendingEnvelopeText, importPassphrase);
      setActiveSession(decoded);
      setActiveSourceLabel(`Importado (Modo A) — ${decoded.participantPseudoId}`);
      setExternalScores(EMPTY_EXTERNAL_SCORES);
      setPendingEnvelopeText('');
      setPendingEnvelopeMode(null);
      setImportPassphrase('');
      setShowPartialPreview(true);
      setImportSuccess(`Paquete ${decoded.participantPseudoId} descifrado y autenticado (AES-256-GCM).`);
      setActiveTab('overview');
    } catch {
      setImportError('Clave incorrecta o archivo alterado (fallo de autenticación AES-GCM).');
    }
  };

  const handleRegenerateKeyPair = async () => {
    const next = await generateClinicianKeyPair(clinicianLabel.trim() || 'Consultorio AuriKat');
    await vaultStorage.setItem(KEYPAIR_STORAGE_KEY, next, 365);
    setKeyPair(next);
    setCopyFeedback('Nuevo par de claves ECDH P-256 generado y guardado localmente.');
  };

  const displayedDomains =
    report.validityStatus === 'INDETERMINATE' && report.canShowPartialPreview && showPartialPreview
      ? report.partialDomainsPreview
      : report.domains;

  const displayedRadarValidity =
    report.validityStatus === 'INDETERMINATE' && report.canShowPartialPreview && showPartialPreview
      ? 'VALID_WITH_CAVEATS'
      : report.validityStatus;

  return (
    <div className="cl-shell">
      {/* Top Clinical Bar */}
      <header className="cl-header cl-no-print">
        <div className="cl-brand">
          <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
            <rect width="36" height="36" rx="10" fill="#DCE9E5" />
            <path
              d="M9 18 C9 13, 15 13, 18 18 C21 23, 27 23, 27 18 C27 13, 21 13, 18 18 C15 23, 9 23, 9 18 Z"
              fill="none"
              stroke="#A98133"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
          </svg>
          <div>
            <h1>AuriKat · Portal Clínico Profesional</h1>
            <small>
              Origen independiente · Protocolo {report.protocolVersion} · Caso activo: <strong>{activeSourceLabel}</strong>
            </small>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="cl-btn cl-btn-primary"
            onClick={handleClipboardPasteClick}
            title="Pegar paquete cifrado copiado desde la app del niño"
          >
            📋 Pegar paquete cifrado
          </button>

          <label className="cl-btn" style={{ cursor: 'pointer', fontWeight: 700 }}>
            📂 Importar .aurikat.txt
            <input type="file" accept=".txt,.aurikat.txt,text/plain" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>

          {demoCases.map((dc) => (
            <button
              key={dc.id}
              type="button"
              className="cl-btn"
              onClick={() => {
                setActiveSession(dc.session);
                setActiveSourceLabel(dc.title);
                setExternalScores(EMPTY_EXTERNAL_SCORES);
                setImportError('');
                setImportSuccess('');
                setShowPasteBox(false);
              }}
            >
              {dc.session.participantPseudoId}
            </button>
          ))}
        </div>
      </header>

      {/* Manual Paste Box if browser requires Ctrl+V */}
      {showPasteBox && (
        <div className="cl-card cl-no-print" style={{ borderColor: 'var(--cl-accent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>📋 Pegar paquete cifrado desde el portapapeles</h3>
            <button type="button" className="cl-btn" onClick={() => setShowPasteBox(false)}>
              Cerrar
            </button>
          </div>
          <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--cl-ink-muted)' }}>
            Pegá aquí (Ctrl+V o mantener apretado → Pegar) el bloque copiado desde{' '}
            <strong>«🔒 Adultos / Exportar → Copiar paquete cifrado»</strong> en la app del niño:
          </p>
          <textarea
            className="cl-input cl-mono"
            rows={4}
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder="CLAVE-AURIKAT: ...\n-----BEGIN AURIKAT ENVELOPE V2-----..."
            autoFocus
          />
          <div>
            <button
              type="button"
              className="cl-btn cl-btn-primary"
              onClick={() => void processEnvelopeRawText(pastedText)}
            >
              Descifrar e interpretar sesión pegada
            </button>
          </div>
        </div>
      )}

      {/* Mode A Passphrase Prompt if imported envelope is symmetric without embedded key */}
      {pendingEnvelopeMode === 'passphrase_aes_gcm' && (
        <form onSubmit={handleDecryptModeA} className="cl-card cl-no-print" style={{ borderColor: 'var(--cl-accent)' }}>
          <h3>Descifrar paquete .aurikat.txt (Modo A — Contraseña Familiar)</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              className="cl-input"
              style={{ flex: 1, minWidth: 220 }}
              value={importPassphrase}
              onChange={(e) => setImportPassphrase(e.target.value)}
              placeholder="Ingresá la clave provista por el adulto (ej. LUNA-SOL-482)"
              autoFocus
            />
            <button type="submit" className="cl-btn cl-btn-primary">
              Abrir sobre cifrado
            </button>
          </div>
        </form>
      )}

      {importError ? <div className="cl-banner cl-no-print" data-tone="warn">{importError}</div> : null}
      {importSuccess ? <div className="cl-banner cl-no-print">{importSuccess}</div> : null}

      {/* Mandatory Regulatory / Deontological Research Ribbon */}
      <div className="cl-banner cl-no-print" data-tone="gold">
        <strong>Investigación Clínica Beta (ANMAT Disp. 64/2025 Parte 3 · APA Standard 9.02(b) / 9.09 · FePRA):</strong>{' '}
        {DEONTOLOGICAL_NOTICE.regulatoryStatus} Los indicadores 0–100 son heurísticas exploratorias pendientes de baremación empírica.
      </div>

      {/* Navigation Tabs */}
      <nav className="cl-tabs cl-no-print" aria-label="Secciones del Portal Clínico">
        {(
          [
            ['overview', 'Perfil y Evidence Trace'],
            ['kinematics', 'Cinemática Motora 2D'],
            ['ema', 'Evolución EMA y MSSD'],
            ['beta', 'Validación Beta (CSV / FHIR)'],
            ['report', 'Informe A4 Imprimible'],
            ['keys', 'Candado Público (Modo B)'],
          ] as [ClinicalTab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className="cl-tab"
            data-active={activeTab === id}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* TAB 1: OVERVIEW + VALIDITY GATE + RADAR + CLINICAL GUIDE + EVIDENCE TRACE */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Session Validity Gate Banner (Canvas Dx Lesson) */}
          <div
            className="cl-card"
            style={{
              borderColor:
                report.validityStatus === 'INDETERMINATE'
                  ? 'var(--cl-warn)'
                  : report.validityStatus === 'VALID_WITH_CAVEATS'
                    ? 'var(--cl-gold)'
                    : 'var(--cl-accent)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h2 style={{ margin: 0 }}>
                  Participante <span className="cl-mono">{report.participantPseudoId}</span> ·{' '}
                  {Math.floor(report.ageMonths / 12)}a {report.ageMonths % 12}m (Sub-banda {report.subAgeBand.replace('_', '–')}a · Forma {report.formVariant})
                </h2>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {report.validityStatus === 'INDETERMINATE' && report.canShowPartialPreview ? (
                  <button
                    type="button"
                    className="cl-btn cl-btn-primary"
                    onClick={() => setShowPartialPreview((v) => !v)}
                  >
                    {showPartialPreview
                      ? '🔍 Mostrando Vista Previa Parcial (1 juego)'
                      : 'Desbloquear Vista Previa Parcial (1 juego)'}
                  </button>
                ) : null}
                <span
                  className="cl-badge"
                  data-tone={
                    report.validityStatus === 'INDETERMINATE'
                      ? 'warn'
                      : report.validityStatus === 'VALID_WITH_CAVEATS'
                        ? 'gold'
                        : undefined
                  }
                >
                  Compuerta de Validez: {report.validityStatus}
                </span>
              </div>
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.88rem', color: 'var(--cl-ink-muted)' }}>
              {report.validityReasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
              {report.caveats.map((c, i) => (
                <li key={`cav-${i}`} style={{ color: '#7D5E1F' }}>
                  <strong>Salvedad:</strong> {c}
                </li>
              ))}
            </ul>
            {report.validityStatus === 'INDETERMINATE' && report.canShowPartialPreview && showPartialPreview ? (
              <div className="cl-banner" data-tone="gold" style={{ marginTop: 8 }}>
                <strong>Modo Prueba / Sesión Parcial Activo:</strong> Se muestran los resultados de los minijuegos
                completados hasta ahora para facilitar la revisión clínica de cada prototipo.
              </div>
            ) : null}
          </div>

          <div className="cl-grid-2">
            <div className="cl-card" style={{ alignItems: 'center' }}>
              <h3 style={{ alignSelf: 'flex-start' }}>Radar Dimensional (6 Ejes + Bandas ±IC)</h3>
              <DomainRadarChart domains={displayedDomains} validityStatus={displayedRadarValidity} />
            </div>

            <div className="cl-card">
              <h3>Desglose NIH Toolbox DCCS y Preferencia Socio-Perceptiva</h3>
              <div className="cl-grid-2">
                <div className="cl-metric-box">
                  <span>DCCS Bicomponente (0–10)</span>
                  <strong className="cl-mono">{report.dccsBreakdown.twoVectorScore} / 10</strong>
                  <span>
                    Acc: {report.dccsBreakdown.accuracyVector}/5 · log-RT: {report.dccsBreakdown.rtVector}/5
                  </span>
                </div>
                <div className="cl-metric-box">
                  <span>Errores DCCS (Persev. / Regres.)</span>
                  <strong className="cl-mono">
                    {report.dccsBreakdown.perseverativeErrors} / {report.dccsBreakdown.regressiveErrors}
                  </strong>
                  <span>
                    Switch Cost: {report.dccsBreakdown.switchCostMs !== null ? `${report.dccsBreakdown.switchCostMs} ms` : 'N/A'}
                  </span>
                </div>
              </div>

              <div className="cl-banner" data-tone={report.geoprefExploratoryFlag.highSpecificityAlert ? 'gold' : undefined}>
                <strong>GeoPref Táctil Exploratorio (Subtipo ASDGeo):</strong>{' '}
                {report.geoprefExploratoryFlag.geometricRatio !== null
                  ? `${Math.round(report.geoprefExploratoryFlag.geometricRatio * 100)}% geométrico (${report.geoprefExploratoryFlag.totalInteractions} toques).`
                  : 'Sin datos de burbujas clásicas.'}{' '}
                {report.geoprefExploratoryFlag.interpretationRule}
              </div>

              <div style={{ fontSize: '0.84rem', color: 'var(--cl-ink-muted)' }}>
                <strong>Casos Demo Rápidos:</strong>
                {demoCases.map((dc) => (
                  <div key={dc.id} style={{ marginTop: 4 }}>
                    • <strong>{dc.badge}:</strong> {dc.description}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* NEW: Game 4A/4B Breakdowns + Actionable Clinical Interpretation Guide */}
          <ClinicalInterpretationGuide report={report} />

          {/* Evidence Trace Panel (FDA CDS Jan 2026 Criterion 4 Transparency) */}
          <div className="cl-card">
            <h3>Trazabilidad Ensayo-por-Ensayo (Evidence Trace · Enfoque Neuroafirmativo)</h3>
            <table className="cl-table">
              <thead>
                <tr>
                  <th>Dominio</th>
                  <th>Índice</th>
                  <th>Observables Auditados</th>
                  <th>Salvedades y Referencia</th>
                </tr>
              </thead>
              <tbody>
                {displayedDomains.map((d) => (
                  <tr key={d.domainId}>
                    <td><strong>{d.title}</strong></td>
                    <td className="cl-mono">
                      {d.observationIndex !== null ? `${d.observationIndex} ±${d.uncertaintyHalfWidth}` : '—'}
                    </td>
                    <td>
                      {d.evidenceTrace.map((t) => (
                        <div key={t.metricKey} style={{ marginBottom: 6 }}>
                          <strong>{t.label}:</strong> <span className="cl-mono">{t.observedValue}</span>
                          <div style={{ fontSize: '0.78rem', color: 'var(--cl-ink-muted)' }}>{t.weightNote}</div>
                        </div>
                      ))}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--cl-ink-muted)' }}>
                      {d.caveatFlag ?? 'Sin salvedades locales'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: KINEMATICS 2D */}
      {activeTab === 'kinematics' && (
        <KinematicsInspector
          strokes={activeSession.strokes}
          aggregate={report.motorAggregate}
          deviceMeta={activeSession.deviceMeta}
        />
      )}

      {/* TAB 3: EMA & MSSD */}
      {activeTab === 'ema' && (
        <LongitudinalMoodChart
          entries={activeSession.emaEntries}
          summary={report.emaSummary}
          sensoryAdjustments={activeSession.sensoryAdjustments}
        />
      )}

      {/* TAB 4: BETA VALIDATION */}
      {activeTab === 'beta' && (
        <BetaValidationPanel
          session={activeSession}
          report={report}
          externalScores={externalScores}
          onChangeExternalScores={setExternalScores}
        />
      )}

      {/* TAB 5: PRINTABLE A4 REPORT */}
      {activeTab === 'report' && (
        <PrintableClinicalReport
          session={activeSession}
          report={report}
          externalScores={externalScores}
        />
      )}

      {/* TAB 6: CLINICIAN PUBLIC KEY LOCK (MODE B) */}
      {activeTab === 'keys' && (
        <div className="cl-card">
          <h2>Candado Público del Profesional (Modo B · Cifrado Asimétrico ECDH P-256)</h2>
          <p style={{ margin: 0, color: 'var(--cl-ink-muted)' }}>
            Entregue este código o QR a las familias para que exporten sus archivos <code>.aurikat.txt</code> sellados
            exclusivamente para este consultorio, sin compartir contraseñas por WhatsApp ni usar servidores en la nube.
            Su llave privada jamás sale de este navegador.
          </p>

          {keyPair && (
            <div className="cl-grid-2" style={{ alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 230,
                    height: 230,
                    padding: 12,
                    borderRadius: 16,
                    background: '#FCFDFB',
                    border: '1px solid var(--cl-border)',
                  }}
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
                <span className="cl-badge">Huella de Llave: {keyPair.keyId}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>Etiqueta visible para familias</label>
                  <input
                    className="cl-input"
                    value={clinicianLabel}
                    onChange={(e) => setClinicianLabel(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>Código de Candado Público (copiar a Puerta Parental Modo B)</label>
                  <textarea
                    className="cl-input cl-mono"
                    rows={4}
                    readOnly
                    value={keyPair.shareableLockCode}
                  />
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="cl-btn cl-btn-primary"
                    onClick={async () => {
                      await navigator.clipboard.writeText(keyPair.shareableLockCode);
                      setCopyFeedback('Código de candado público copiado al portapapeles.');
                    }}
                  >
                    Copiar código de candado
                  </button>
                  <button type="button" className="cl-btn" onClick={handleRegenerateKeyPair}>
                    Rotar / Generar nueva llave
                  </button>
                </div>
                {copyFeedback ? <div className="cl-banner">{copyFeedback}</div> : null}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default App;
