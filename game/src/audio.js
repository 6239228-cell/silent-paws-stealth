// Every sound in Silent Paws is synthesised here with WebAudio: no audio files, no
// network. The context is only created on the first click or keypress (browsers demand
// a gesture). Butler footsteps are scheduled from the real guard positions, so a
// butler walking closer really does get louder and pan across the speakers.

import { GUARD } from './config.js';

export function createAudio() {
  let context = null;
  let master = null;
  let noiseBuffer = null;
  let muted = false;
  const stepPhases = new WeakMap();

  function unlock() {
    if (!context) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      context = new AudioCtor();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.55;
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 18;
      compressor.ratio.value = 4;
      master.connect(compressor);
      compressor.connect(context.destination);

      const length = Math.floor(context.sampleRate * 0.4);
      noiseBuffer = context.createBuffer(1, length, context.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    }
    if (context.state === 'suspended') context.resume().catch(() => {});
  }

  function ready() {
    return context !== null && !muted && context.state === 'running';
  }

  function envelope(gain, peak, attack, decay, start) {
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
  }

  function tone({ freq, endFreq = freq, type = 'sine', dur = 0.2, gain = 0.1, delay = 0, pan = 0, attack = 0.008 }) {
    if (!ready()) return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, start);
    if (endFreq !== freq) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), start + dur);
    const amp = context.createGain();
    envelope(amp, gain, attack, dur, start);
    let node = oscillator;
    if (context.createStereoPanner) {
      const panner = context.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      oscConnect(oscillator, panner);
      node = panner;
    }
    oscConnect(node, amp);
    amp.connect(master);
    oscillator.start(start);
    oscillator.stop(start + dur + attack + 0.02);
  }

  function oscConnect(from, to) {
    from.connect(to);
  }

  function noiseBurst({ dur = 0.09, gain = 0.1, freq = 400, q = 1.1, delay = 0, pan = 0, type = 'bandpass', attack = 0.004 }) {
    if (!ready() || !noiseBuffer) return;
    const start = context.currentTime + delay;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const amp = context.createGain();
    envelope(amp, gain, attack, dur, start);
    source.connect(filter);
    if (context.createStereoPanner) {
      const panner = context.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      filter.connect(panner);
      panner.connect(amp);
    } else {
      filter.connect(amp);
    }
    amp.connect(master);
    source.start(start);
    source.stop(start + dur + 0.05);
  }

  function footstep(volume, pan) {
    noiseBurst({ dur: 0.075, gain: volume, freq: 350, q: 0.9, pan });
    tone({ freq: 92, endFreq: 55, type: 'sine', dur: 0.09, gain: volume * 0.55, pan, attack: 0.004 });
  }

  return {
    unlock,

    isMuted() {
      return muted;
    },

    setMuted(next) {
      muted = next;
      if (master && context) {
        master.gain.setTargetAtTime(muted ? 0 : 0.55, context.currentTime, 0.02);
      }
      if (!muted) tone({ freq: 660, endFreq: 880, type: 'sine', dur: 0.1, gain: 0.05 });
    },

    toggleMute() {
      this.setMuted(!muted);
      return muted;
    },

    /** Move the audible footsteps along with the simulation. */
    update(dt, world) {
      if (!ready()) return;
      const cat = world.cat;
      for (const guard of world.guards) {
        if (!guard.moving) continue;
        const phase = (stepPhases.get(guard) ?? 0) + GUARD.speed * dt;
        if (phase >= GUARD.stride) {
          stepPhases.set(guard, phase - GUARD.stride);
          const distance = Math.hypot(guard.x - cat.x, guard.y - cat.y);
          const falloff = Math.max(0, 1 - distance / 580);
          const volume = 0.02 + 0.22 * falloff * falloff;
          const pan = Math.max(-0.9, Math.min(0.9, (guard.x - cat.x) / 700));
          footstep(volume, pan);
        } else {
          stepPhases.set(guard, phase);
        }
      }
      if (cat.moving) {
        const catPhase = (stepPhases.get(cat) ?? 0) + 190 * dt;
        if (catPhase >= 44) {
          stepPhases.set(cat, catPhase - 44);
          noiseBurst({
            dur: 0.035,
            gain: cat.hidden ? 0.012 : 0.028,
            freq: 620,
            q: 0.7,
            pan: Math.max(-0.7, Math.min(0.7, (cat.x - 640) / 720)),
          });
        } else {
          stepPhases.set(cat, catPhase);
        }
      }
    },

    throwCoin() {
      noiseBurst({ dur: 0.18, gain: 0.05, freq: 1400, q: 0.6, type: 'highpass' });
    },

    coin() {
      tone({ freq: 1850, endFreq: 920, type: 'sine', dur: 0.18, gain: 0.12 });
      tone({ freq: 2700, endFreq: 2100, type: 'triangle', dur: 0.08, gain: 0.05, delay: 0.015 });
    },

    spotted() {
      tone({ freq: 196, endFreq: 311, type: 'sawtooth', dur: 0.38, gain: 0.09 });
      tone({ freq: 207, endFreq: 329, type: 'sawtooth', dur: 0.38, gain: 0.07, delay: 0.02 });
      noiseBurst({ dur: 0.22, gain: 0.035, freq: 2200, q: 0.8, type: 'highpass' });
    },

    fish() {
      tone({ freq: 880, type: 'triangle', dur: 0.1, gain: 0.08 });
      tone({ freq: 1320, type: 'triangle', dur: 0.16, gain: 0.07, delay: 0.08 });
    },

    caught() {
      tone({ freq: 220, endFreq: 55, type: 'sawtooth', dur: 0.7, gain: 0.11 });
      tone({ freq: 233, endFreq: 58, type: 'square', dur: 0.6, gain: 0.05, delay: 0.03 });
      noiseBurst({ dur: 0.5, gain: 0.03, freq: 180, q: 0.5, type: 'lowpass' });
    },

    levelClear() {
      const notes = [523, 659, 784, 1046];
      notes.forEach((freq, index) => {
        tone({ freq, type: 'triangle', dur: 0.28, gain: 0.08, delay: index * 0.09 });
      });
    },

    win() {
      const notes = [523, 659, 784, 1046, 1318, 1568];
      notes.forEach((freq, index) => {
        tone({ freq, type: 'triangle', dur: 0.4, gain: 0.075, delay: index * 0.11 });
      });
      [523, 659, 784].forEach((freq) => {
        tone({ freq, type: 'sine', dur: 1.1, gain: 0.04, delay: 0.7 });
      });
    },
  };
}
