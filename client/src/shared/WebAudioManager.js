import { EventBus } from './EventBus.js';

export class WebAudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this._onSpectacle = null;
    this._onMatchEnd = null;
    this._unlockHandler = null;
    this._bgmInterval = null;
  }

  init() {
    this._unlockHandler = () => {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
      }
      this.ctx.resume();
      this.enabled = true;
      this._startBgmLoop();
      window.removeEventListener('pointerdown', this._unlockHandler);
      window.removeEventListener('keydown', this._unlockHandler);
    };

    window.addEventListener('pointerdown', this._unlockHandler, { once: true });
    window.addEventListener('keydown', this._unlockHandler, { once: true });

    this._onSpectacle = (evt) => this._playSpectacle(evt);
    this._onMatchEnd = () => this._playVictory();
    EventBus.on('spectacle:hook', this._onSpectacle);
    EventBus.on('game:match-end', this._onMatchEnd);
  }

  destroy() {
    if (this._onSpectacle) EventBus.off('spectacle:hook', this._onSpectacle);
    if (this._onMatchEnd) EventBus.off('game:match-end', this._onMatchEnd);
    if (this._bgmInterval) clearInterval(this._bgmInterval);
  }

  _tone(freq, durationMs, type = 'sine', gain = 0.02) {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    amp.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(gain, this.ctx.currentTime + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + durationMs / 1000);
    osc.connect(amp);
    amp.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + durationMs / 1000 + 0.02);
  }

  _playSpectacle(evt) {
    if (!evt?.type) return;
    switch (evt.type) {
    case 'ENTRANCE':
      this._tone(620, 70, 'triangle', 0.015);
      break;
    case 'HIT':
      this._tone(210, 90, 'square', 0.02);
      break;
    case 'KILL':
      this._tone(180, 120, 'sawtooth', 0.018);
      break;
    case 'COMBO':
      this._tone(520, 60, 'triangle', 0.02);
      setTimeout(() => this._tone(760, 80, 'triangle', 0.018), 80);
      break;
    case 'NEAR_MISS':
      this._tone(440, 60, 'sine', 0.012);
      break;
    case 'BASE_HIT':
      this._tone(120, 140, 'square', 0.02);
      break;
    default:
      break;
    }
  }

  _playVictory() {
    this._tone(523, 120, 'triangle', 0.02);
    setTimeout(() => this._tone(659, 120, 'triangle', 0.02), 130);
    setTimeout(() => this._tone(784, 180, 'triangle', 0.02), 260);
  }

  _startBgmLoop() {
    if (this._bgmInterval) return;
    this._bgmInterval = setInterval(() => {
      if (!this.enabled) return;
      this._tone(220, 300, 'sine', 0.004);
      setTimeout(() => this._tone(277, 300, 'sine', 0.0035), 340);
      setTimeout(() => this._tone(330, 380, 'sine', 0.0035), 700);
    }, 8000);
  }
}
