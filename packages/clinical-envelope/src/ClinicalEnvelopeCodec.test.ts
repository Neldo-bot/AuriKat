import { describe, expect, it } from 'vitest';
import { createInitialSessionPayload } from '@aurikat/core-engine';
import {
  ENVELOPE_BEGIN,
  generateClinicianKeyPair,
  inspectEnvelopeMetadata,
  openEnvelopeWithClinicianPrivateKey,
  openEnvelopeWithPassphrase,
  sealEnvelopeForClinicianLock,
  sealEnvelopeWithPassphrase,
} from './ClinicalEnvelopeCodec.js';

describe('ClinicalEnvelopeCodec (SEC-03 Mode A & Mode B)', () => {
  it('Mode A: seals and opens .aurikat.txt with AES-256-GCM + PBKDF2 and generates unique IVs', async () => {
    const payload = createInitialSessionPayload({ participantPseudoId: 'AK-TEST-A', ageMonths: 70 });
    // Use faster iteration count ONLY in unit test for speed; production default is 600,000
    const env1 = await sealEnvelopeWithPassphrase(payload, 'SOL-GATO-482', 10_000);
    const env2 = await sealEnvelopeWithPassphrase(payload, 'SOL-GATO-482', 10_000);

    expect(env1.startsWith(ENVELOPE_BEGIN)).toBe(true);
    expect(env1).not.toBe(env2); // Unique 12B IV + 16B salt every export!

    const meta = inspectEnvelopeMetadata(env1);
    expect(meta.mode).toBe('passphrase_aes_gcm');

    const decoded = await openEnvelopeWithPassphrase(env1, 'SOL-GATO-482');
    expect(decoded.participantPseudoId).toBe('AK-TEST-A');
    expect(decoded.ageMonths).toBe(70);

    // Wrong passphrase must fail GCM authentication
    await expect(openEnvelopeWithPassphrase(env1, 'WRONG-KEY')).rejects.toThrow();

    // Tampering 1 character inside ciphertext must fail GCM authentication
    const lines = env1.split('\n');
    const mid = lines[2];
    const flipped = (mid[10] === 'A' ? 'B' : 'A');
    lines[2] = mid.slice(0, 10) + flipped + mid.slice(11);
    await expect(openEnvelopeWithPassphrase(lines.join('\n'), 'SOL-GATO-482')).rejects.toThrow();
  });

  it('Mode B: seals to clinician ECDH P-256 public lock code and decrypts exclusively with private key', async () => {
    const clinician = await generateClinicianKeyPair('Dra. Test UADE');
    const otherClinician = await generateClinicianKeyPair('Otro Profesional');
    const payload = createInitialSessionPayload({ participantPseudoId: 'AK-TEST-B', ageMonths: 84 });

    const env = await sealEnvelopeForClinicianLock(payload, clinician.shareableLockCode);
    const meta = inspectEnvelopeMetadata(env);
    expect(meta.mode).toBe('ecdh_p256_hybrid');
    expect(meta.clinicianKeyFingerprint).toBe(clinician.keyId);

    const decoded = await openEnvelopeWithClinicianPrivateKey(
      env,
      clinician.privateKeyJwk,
      clinician.keyId,
    );
    expect(decoded.participantPseudoId).toBe('AK-TEST-B');

    // Different clinician's private key must be rejected
    await expect(
      openEnvelopeWithClinicianPrivateKey(env, otherClinician.privateKeyJwk, otherClinician.keyId),
    ).rejects.toThrow();
  });
});
