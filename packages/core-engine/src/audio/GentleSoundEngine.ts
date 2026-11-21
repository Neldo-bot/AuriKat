/**
 * GentleSoundEngine (IC-3 / UX-02 / TEL-03)
 * Anti-hyperacusis & anti-misophonia Web Audio synthesizer resilient to iOS Safari quirks:
 * - Singleton AudioContext (iOS ~4-6 instance limit)
 * - Synchronous 1-sample silent buffer unlock on user gesture
 * - Transparent rebuild if AudioContext transitions to 'closed' after OS interruption
 * - Warm marimba/Animalese fundamentals (260-660 Hz)
 * - Soft Low-Pass 1800 Hz (12 dB/oct) + High-Pass 120 Hz + soft limiter
 * - Attack >= 25 ms via exponentialRampToValueAtTime (zero misophonic clicks)
 */

export type SoundCueType =
  | 'tap_soft'
  | 'animalese_happy'
  | 'animalese_curious'
  | 'animalese_comfort'
  | 'neutral_soft_fail'
  | 'bubble_pop'
  | 'gear_chime'
  | 'celebrate_chime';

export interface IAudioPort {
  unlock(): void;
  setMuted(muted: boolean): void;
  setVolume(volume: number): void;
  playCue(cue: SoundCueType): void;
}

class GentleSoundEngineImpl implements IAudioPort {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private lowPass: BiquadFilterNode | null = null;
  private highPass: BiquadFilterNode | null = null;
  private muted = false;
  private volume = 0.65;
  private unlocked = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    // iOS Safari may permanently close AudioContext on phone call / lock screen
    if (this.ctx && this.ctx.state === 'closed') {
      this.ctx = null;
      this.masterGain = null;
      this.lowPass = null;
      this.highPass = null;
      this.unlocked = false;
    }

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.highPass = this.ctx.createBiquadFilter();
      this.highPass.type = 'highpass';
      this.highPass.frequency.value = 120; // Removes persistent low rumble

      this.lowPass = this.ctx.createBiquadFilter();
      this.lowPass.type = 'lowpass';
      this.lowPass.frequency.value = 1800; // IC-3: 1.6-2.0 kHz soft roll-off (12 dB/oct)
      this.lowPass.Q.value = 0.707;

      const limiter = this.ctx.createDynamicsCompressor();
      limiter.threshold.value = -12;
      limiter.knee.value = 18;
      limiter.ratio.value = 6;
      limiter.attack.value = 0.02;
      limiter.release.value = 0.15;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0.0001 : Math.max(0.0001, this.volume * 0.45);

      this.highPass.connect(this.lowPass);
      this.lowPass.connect(limiter);
      limiter.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }

    return this.ctx;
  }

  public unlock(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    if (!this.unlocked) {
      try {
        // iOS synchronous 1-sample silent buffer unlock
        const silentBuf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = silentBuf;
        src.connect(ctx.destination);
        src.start(0);
        this.unlocked = true;
      } catch {
        // Ignore unlock errors outside direct gesture
      }
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.masterGain && this.ctx.state !== 'closed') {
      const now = this.ctx.currentTime;
      const target = muted ? 0.0001 : Math.max(0.0001, this.volume * 0.45);
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(Math.max(0.0001, this.masterGain.gain.value), now);
      this.masterGain.gain.exponentialRampToValueAtTime(target, now + 0.03);
    }
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (!this.muted) {
      this.setMuted(false);
    }
  }

  private playTone(freqHz: number, startOffsetS: number, durationS: number, peakGain: number, wave: OscillatorType = 'sine'): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.highPass || this.muted) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime + startOffsetS;
    const attackS = 0.028; // >= 25 ms soft attack prevents misophonic clicks
    const releaseS = Math.max(0.08, durationS - attackS);

    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(Math.max(260, Math.min(660, freqHz)), now);

    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, peakGain), now + attackS);
    env.gain.exponentialRampToValueAtTime(0.0001, now + attackS + releaseS);

    osc.connect(env);
    env.connect(this.highPass);

    osc.start(now);
    osc.stop(now + attackS + releaseS + 0.02);
  }

  public playCue(cue: SoundCueType): void {
    if (this.muted) return;
    this.unlock();
    switch (cue) {
      case 'tap_soft':
        this.playTone(392, 0, 0.14, 0.35, 'sine');
        break;
      case 'animalese_happy':
        this.playTone(392, 0, 0.11, 0.32, 'triangle');
        this.playTone(494, 0.09, 0.12, 0.32, 'triangle');
        this.playTone(587, 0.18, 0.16, 0.34, 'sine');
        break;
      case 'animalese_curious':
        this.playTone(349, 0, 0.12, 0.3, 'triangle');
        this.playTone(466, 0.1, 0.16, 0.32, 'sine');
        break;
      case 'animalese_comfort':
        this.playTone(330, 0, 0.22, 0.28, 'sine');
        this.playTone(294, 0.16, 0.28, 0.26, 'sine');
        break;
      case 'neutral_soft_fail':
        // IC-1: Strictly neutral soft timbre (never buzzer or negative harsh chord)
        this.playTone(311, 0, 0.16, 0.22, 'sine');
        break;
      case 'bubble_pop':
        // IC-1 GeoPref iso-salience: identical loudness & duration as gear_chime
        this.playTone(440, 0, 0.14, 0.3, 'sine');
        break;
      case 'gear_chime':
        // IC-1 GeoPref iso-salience: identical loudness & duration as bubble_pop
        this.playTone(440, 0, 0.14, 0.3, 'sine');
        break;
      case 'celebrate_chime':
        this.playTone(330, 0, 0.14, 0.3, 'sine');
        this.playTone(392, 0.11, 0.15, 0.3, 'sine');
        this.playTone(523, 0.22, 0.24, 0.34, 'sine');
        break;
    }
  }
}

export const gentleSoundEngine: IAudioPort = new GentleSoundEngineImpl();
