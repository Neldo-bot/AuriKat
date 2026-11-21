import type { RawSessionPayload } from '@aurikat/core-engine';

/**
 * Portable Encrypted Envelope Codec (SEC-03 / IC-5)
 * - Mode A (Passphrase): AES-256-GCM (fresh 12B IV) + PBKDF2-HMAC-SHA256 (600,000 iterations, 16B salt)
 * - Mode B (Clinician Public Key): Hybrid ECDH P-256 (ephemeral keypair per export) + HKDF-SHA256 -> AES-256-GCM
 * - Format: ASCII-armored .aurikat.txt (text/plain) compatible with Chromium & Safari Web Share API
 */

export const ENVELOPE_BEGIN = '-----BEGIN AURIKAT ENVELOPE V2-----';
export const ENVELOPE_END = '-----END AURIKAT ENVELOPE V2-----';
export const PUBLIC_KEY_PREFIX = 'AURIKAT-LOCK-V2:';
export const PBKDF2_ITERATIONS = 600_000;

export type EnvelopeMode = 'passphrase_aes_gcm' | 'ecdh_p256_hybrid';

interface EnvelopeJsonHeader {
  v: 2;
  mode: EnvelopeMode;
  protocolVersion: string;
  ivB64: string;
  saltB64: string;
  iterations?: number;
  ephemeralPubJwk?: JsonWebKey;
  clinicianKeyFingerprint?: string;
  ciphertextB64: string;
}

export interface ClinicianKeyPairBundle {
  keyId: string;
  label: string;
  createdAtIso: string;
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
  shareableLockCode: string; // Compact string starting with AURIKAT-LOCK-V2:
}

function getSubtle(): SubtleCrypto {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    throw new Error('La exportación cifrada requiere contexto seguro HTTPS o localhost.');
  }
  const c = globalThis.crypto;
  if (!c || !c.subtle) {
    throw new Error('Web Crypto API no disponible en este entorno.');
  }
  return c.subtle;
}

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(b64url: string): string {
  const padded = b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64url.length % 4)) % 4);
  return new TextDecoder().decode(fromBase64(padded));
}

function wrapLines(str: string, width = 68): string {
  const lines: string[] = [];
  for (let i = 0; i < str.length; i += width) {
    lines.push(str.slice(i, i + width));
  }
  return lines.join('\n');
}

function buildAad(mode: EnvelopeMode, protocolVersion: string): Uint8Array {
  return new TextEncoder().encode(`AURIKAT-ENV-V2|${mode}|${protocolVersion}`);
}

export async function computePublicKeyFingerprint(publicKeyJwk: JsonWebKey): Promise<string> {
  const subtle = getSubtle();
  const canonical = JSON.stringify({ crv: publicKeyJwk.crv, kty: publicKeyJwk.kty, x: publicKeyJwk.x, y: publicKeyJwk.y });
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return toBase64(new Uint8Array(digest)).slice(0, 12).toUpperCase();
}

/**
 * Generates an ECDH P-256 keypair for Mode B (clinician public-key lock).
 */
export async function generateClinicianKeyPair(label = 'Consultorio AuriKat'): Promise<ClinicianKeyPairBundle> {
  const subtle = getSubtle();
  const pair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits'],
  );
  const publicKeyJwk = await subtle.exportKey('jwk', pair.publicKey);
  const privateKeyJwk = await subtle.exportKey('jwk', pair.privateKey);
  const keyId = await computePublicKeyFingerprint(publicKeyJwk);
  const lockPayload = JSON.stringify({
    v: 2,
    id: keyId,
    label,
    jwk: { kty: publicKeyJwk.kty, crv: publicKeyJwk.crv, x: publicKeyJwk.x, y: publicKeyJwk.y },
  });
  return {
    keyId,
    label,
    createdAtIso: new Date().toISOString(),
    publicKeyJwk,
    privateKeyJwk,
    shareableLockCode: `${PUBLIC_KEY_PREFIX}${toBase64Url(lockPayload)}`,
  };
}

export function parseClinicianLockCode(lockCode: string): {
  keyId: string;
  label: string;
  publicKeyJwk: JsonWebKey;
} {
  const trimmed = lockCode.trim();
  if (!trimmed.startsWith(PUBLIC_KEY_PREFIX)) {
    throw new Error('Código de candado inválido. Debe comenzar con AURIKAT-LOCK-V2:');
  }
  const body = trimmed.slice(PUBLIC_KEY_PREFIX.length);
  const parsed = JSON.parse(fromBase64Url(body)) as {
    v: number;
    id: string;
    label: string;
    jwk: JsonWebKey;
  };
  if (parsed.v !== 2 || !parsed.jwk || parsed.jwk.crv !== 'P-256' || !parsed.jwk.x || !parsed.jwk.y) {
    throw new Error('Estructura de llave pública incompatible.');
  }
  return {
    keyId: parsed.id,
    label: parsed.label || 'Profesional',
    publicKeyJwk: parsed.jwk,
  };
}

/**
 * Mode A: Encrypts RawSessionPayload into ASCII-armored .aurikat.txt using PBKDF2-HMAC-SHA256 + AES-256-GCM.
 */
export async function sealEnvelopeWithPassphrase(
  payload: RawSessionPayload,
  passphrase: string,
  iterations = PBKDF2_ITERATIONS,
): Promise<string> {
  if (!passphrase || passphrase.trim().length < 4) {
    throw new Error('La clave de protección debe tener al menos 4 caracteres.');
  }
  const subtle = getSubtle();
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12)); // Unique 12B IV per export

  const baseKey = await subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase.trim()),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const aesKey = await subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );

  const aad = buildAad('passphrase_aes_gcm', payload.protocolVersion);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const cipherBuf = await subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad as unknown as BufferSource, tagLength: 128 },
    aesKey,
    plaintext,
  );

  const header: EnvelopeJsonHeader = {
    v: 2,
    mode: 'passphrase_aes_gcm',
    protocolVersion: payload.protocolVersion,
    ivB64: toBase64(iv),
    saltB64: toBase64(salt),
    iterations,
    ciphertextB64: toBase64(new Uint8Array(cipherBuf)),
  };

  return formatArmoredText(header);
}

/**
 * Mode B: Hybrid ECDH P-256 + HKDF-SHA256 + AES-256-GCM encryption to a clinician's public key lock code.
 * Even the player app cannot decrypt the envelope once sealed.
 */
export async function sealEnvelopeForClinicianLock(
  payload: RawSessionPayload,
  clinicianLockCode: string,
): Promise<string> {
  const subtle = getSubtle();
  const { keyId, publicKeyJwk } = parseClinicianLockCode(clinicianLockCode);

  const recipientPub = await subtle.importKey(
    'jwk',
    publicKeyJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );

  const ephemeralPair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  );
  const ephemeralPubJwk = await subtle.exportKey('jwk', ephemeralPair.publicKey);
  const sharedBits = await subtle.deriveBits(
    { name: 'ECDH', public: recipientPub },
    ephemeralPair.privateKey,
    256,
  );

  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));

  const hkdfKey = await subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);
  const aesKey = await subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info: new TextEncoder().encode(`AURIKAT-ECDH-V2|${keyId}`),
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );

  const aad = buildAad('ecdh_p256_hybrid', payload.protocolVersion);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const cipherBuf = await subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad as unknown as BufferSource, tagLength: 128 },
    aesKey,
    plaintext,
  );

  const header: EnvelopeJsonHeader = {
    v: 2,
    mode: 'ecdh_p256_hybrid',
    protocolVersion: payload.protocolVersion,
    ivB64: toBase64(iv),
    saltB64: toBase64(salt),
    ephemeralPubJwk: {
      kty: ephemeralPubJwk.kty,
      crv: ephemeralPubJwk.crv,
      x: ephemeralPubJwk.x,
      y: ephemeralPubJwk.y,
    },
    clinicianKeyFingerprint: keyId,
    ciphertextB64: toBase64(new Uint8Array(cipherBuf)),
  };

  return formatArmoredText(header);
}

function formatArmoredText(header: EnvelopeJsonHeader): string {
  const b64Body = toBase64(new TextEncoder().encode(JSON.stringify(header)));
  return `${ENVELOPE_BEGIN}\n${wrapLines(b64Body, 68)}\n${ENVELOPE_END}\n`;
}

function parseArmoredHeader(armoredText: string): EnvelopeJsonHeader {
  const start = armoredText.indexOf(ENVELOPE_BEGIN);
  const end = armoredText.indexOf(ENVELOPE_END);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Formato de archivo .aurikat.txt no reconocido.');
  }
  const b64 = armoredText
    .slice(start + ENVELOPE_BEGIN.length, end)
    .replace(/\s+/g, '');
  const jsonStr = new TextDecoder().decode(fromBase64(b64));
  const parsed = JSON.parse(jsonStr) as EnvelopeJsonHeader;
  if (parsed.v !== 2 || !parsed.ivB64 || !parsed.ciphertextB64) {
    throw new Error('Cabecera de sobre inválida o corrupta.');
  }
  return parsed;
}

export function inspectEnvelopeMetadata(armoredText: string): {
  mode: EnvelopeMode;
  protocolVersion: string;
  clinicianKeyFingerprint?: string;
} {
  const header = parseArmoredHeader(armoredText);
  return {
    mode: header.mode,
    protocolVersion: header.protocolVersion,
    clinicianKeyFingerprint: header.clinicianKeyFingerprint,
  };
}

export async function openEnvelopeWithPassphrase(
  armoredText: string,
  passphrase: string,
): Promise<RawSessionPayload> {
  const subtle = getSubtle();
  const header = parseArmoredHeader(armoredText);
  if (header.mode !== 'passphrase_aes_gcm') {
    throw new Error('Este paquete fue cerrado con un candado público de profesional (Modo B).');
  }
  const salt = fromBase64(header.saltB64);
  const iv = fromBase64(header.ivB64);
  const ciphertext = fromBase64(header.ciphertextB64);
  const iterations = header.iterations ?? PBKDF2_ITERATIONS;

  const baseKey = await subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase.trim()),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const aesKey = await subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );

  const aad = buildAad('passphrase_aes_gcm', header.protocolVersion);
  const plainBuf = await subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
      additionalData: aad as unknown as BufferSource,
      tagLength: 128,
    },
    aesKey,
    ciphertext as unknown as BufferSource,
  );
  return JSON.parse(new TextDecoder().decode(plainBuf)) as RawSessionPayload;
}

export async function openEnvelopeWithClinicianPrivateKey(
  armoredText: string,
  privateKeyJwk: JsonWebKey,
  expectedKeyFingerprint: string,
): Promise<RawSessionPayload> {
  const subtle = getSubtle();
  const header = parseArmoredHeader(armoredText);
  if (header.mode !== 'ecdh_p256_hybrid' || !header.ephemeralPubJwk) {
    throw new Error('Este paquete fue cerrado con contraseña simple (Modo A).');
  }
  const recipientPriv = await subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits'],
  );
  const ephemeralPub = await subtle.importKey(
    'jwk',
    header.ephemeralPubJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );

  const sharedBits = await subtle.deriveBits(
    { name: 'ECDH', public: ephemeralPub },
    recipientPriv,
    256,
  );
  const salt = fromBase64(header.saltB64);
  const iv = fromBase64(header.ivB64);
  const ciphertext = fromBase64(header.ciphertextB64);

  const hkdfKey = await subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);
  const aesKey = await subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt as unknown as BufferSource,
      info: new TextEncoder().encode(`AURIKAT-ECDH-V2|${header.clinicianKeyFingerprint ?? expectedKeyFingerprint}`),
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );

  const aad = buildAad('ecdh_p256_hybrid', header.protocolVersion);
  const plainBuf = await subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
      additionalData: aad as unknown as BufferSource,
      tagLength: 128,
    },
    aesKey,
    ciphertext as unknown as BufferSource,
  );
  return JSON.parse(new TextDecoder().decode(plainBuf)) as RawSessionPayload;
}

/**
 * Generates a memorable human-friendly one-time passphrase for Mode A.
 */
export function generateFriendlyPassphrase(): string {
  const words = ['LUNA', 'NUBE', 'SOL', 'HOJA', 'GATO', 'BRISA', 'MAR', 'ROBLE'];
  const rnd = globalThis.crypto.getRandomValues(new Uint32Array(3));
  const w1 = words[rnd[0] % words.length];
  const w2 = words[rnd[1] % words.length];
  const digits = String(100 + (rnd[2] % 900));
  return `${w1}-${w2}-${digits}`;
}

/**
 * Shares or downloads the .aurikat.txt envelope safely across Android Chrome, iOS Safari and Desktop.
 * Uses text/plain (.aurikat.txt) to bypass Chromium's Web Share API .json block (SEC-03).
 */
export async function shareOrDownloadEnvelopeText(
  armoredText: string,
  participantPseudoId: string,
): Promise<'shared' | 'downloaded'> {
  const safeId = participantPseudoId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24) || 'sesion';
  const fileName = `aurikat_${safeId}.aurikat.txt`;
  const file = new File([armoredText], fileName, { type: 'text/plain;charset=utf-8' });

  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function'
  ) {
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Paquete AuriKat Cifrado',
          text: 'Archivo protegido (.aurikat.txt) para revisión profesional.',
        });
        return 'shared';
      }
    } catch {
      // User canceled or OS blocked share sheet -> fall back to download
    }
  }

  const blob = new Blob([armoredText], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
