// @ts-nocheck
export function createNoiseBuffer(ctx: AudioContext) {
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export class NativeSynth {
  ctx: AudioContext;
  destination: AudioNode;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.destination = destination;
  }

  playDrum(type: string, time: number, velocity: number) {
    const gain = this.ctx.createGain();
    gain.connect(this.destination);
    
    if (type === 'kick') {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.connect(gain);
      // Pitch drop
      osc.frequency.setValueAtTime(150, time);
      osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
      // Amp decay
      gain.gain.setValueAtTime(velocity, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
      
      osc.start(time);
      osc.stop(time + 0.5);
    } else if (type === 'snare') {
      const noiseBuffer = createNoiseBuffer(this.ctx);
      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.value = 1000;
      noise.connect(noiseFilter);
      noiseFilter.connect(gain);

      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.connect(gain);

      osc.frequency.setValueAtTime(250, time);
      gain.gain.setValueAtTime(velocity, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

      osc.start(time);
      noise.start(time);
      osc.stop(time + 0.2);
      noise.stop(time + 0.2);
    } else if (type === 'hihat' || type === 'hihat_o') {
      const noiseBuffer = createNoiseBuffer(this.ctx);
      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      
      const bandpass = this.ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 10000;
      
      const highpass = this.ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 7000;

      noise.connect(bandpass);
      bandpass.connect(highpass);
      highpass.connect(gain);

      const duration = type === 'hihat_o' ? 0.3 : 0.05;
      gain.gain.setValueAtTime(velocity * 0.8, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

      noise.start(time);
      noise.stop(time + duration);
    } else {
        // generic tom/perc
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.connect(gain);
        osc.frequency.setValueAtTime(400, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.3);
        gain.gain.setValueAtTime(velocity, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);
        osc.start(time);
        osc.stop(time + 0.3);
    }
  }

  playTone(noteFreq: number, time: number, duration: number, velocity: number) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle'; // standard poly
    osc.frequency.value = noteFreq;
    
    osc.connect(gain);
    gain.connect(this.destination);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(velocity * 0.5, time + 0.01);
    gain.gain.setValueAtTime(velocity * 0.5, time + duration - 0.05);
    gain.gain.linearRampToValueAtTime(0, time + duration);

    osc.start(time);
    osc.stop(time + duration);
  }
}