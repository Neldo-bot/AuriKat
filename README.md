# AuriKat — Monorepo Hexagonal Beta v1.0

Compañero digital interactivo no verbal para crecimiento diario y apoyo a la observación clínica temprana en TEA y neurodesarrollo (**4–8 años**), construido con segregación estricta **App del Niño vs. Portal Clínico** en dos aplicaciones y builds físicamente independientes.

> **Aviso Deontológico y Regulatorio (ANMAT Disp. 64/2025 Parte 3 · FePRA · APA Standard 9 · Ley 26.657):**
> AuriKat Beta v1.0 es un prototipo de **investigación clínica no comercial**, 100% libre de cámara, micrófono y servidores en la nube. **Nunca emite un diagnóstico autónomo** ni expone información clínica al jugador.

## Estructura del Monorepo

* `packages/core-engine`: Tipos de dominio neutros, contrato `ICreatureRigAdapter` v2 (paridad con Rive View Models), `MotorKinematicsAnalyzer` (remuestreo 60 Hz + filtro Savitzky-Golay + 16 variables *Simeoli/Butera/Torres*), `TelemetryCollector`, `GentleSoundEngine` (Web Audio anti-hiperacusia `1.6–2.0 kHz` resiliente a iOS) e `IndexedDbStorageAdapter` (anti-ITP + TTL COPPA 2025).
* `packages/clinical-envelope`: Cifrado Web Crypto API (`AES-256-GCM`) en formato `.aurikat.txt` compatible con Web Share API — **Modo A** (`PBKDF2-HMAC-SHA256` 600k iteraciones) y **Modo B** (híbrido asimétrico `ECDH P-256` con candado público del profesional).
* `packages/clinical-scoring` *(importado EXCLUSIVAMENTE por `apps/clinical`)*: Motor ECD transparente con compuerta `VALID` / `VALID_WITH_CAVEATS` / `INDETERMINATE`, DCCS bicomponente, *Evidence Trace*, MSSD, CSV *trial-level* (auditoría 18 identificadores HIPAA Safe Harbor) y Bundle HL7 FHIR R4 SDC.
* `apps/player`: Aplicación del niño (`0 bytes` clínicos, 3 especies, 3 arquetipos culturales, 5 paletas calmadas, Asentimiento Infantil Visual, EMA diario, 4 minijuegos *Magrid+* y Puerta Parental resistente 4–11a).
* `apps/clinical`: Portal independiente para psicólogos y psiquiatras (llave pública QR offline, importador `.aurikat.txt`, 3 casos demo, Radar ±IC, *Evidence Trace*, inspector vectorial de cinemática 2D, evolución EMA/MSSD, Validación Beta CAST/SDQ + escalas 4–8a e Informe A4 imprimible).

## Comandos

```bash
npm install
npm run test               # Suite unitaria Vitest (cinemática, cripto, ECD, CSV/FHIR)
npm run build              # Compila paquetes + 2 apps independientes + auditoría de segregación
npm run dev:player         # App del Niño en http://localhost:5173
npm run dev:clinical       # Portal Clínico en http://localhost:5174
```
