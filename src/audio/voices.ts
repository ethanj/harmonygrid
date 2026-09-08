/*! Copyright (c) 2026 Ethan Joffe */
/** Fixed-capacity oscillator bank. One active pitch may have several release tails. */
export class Voices {
  private readonly pitch: Int16Array;
  private readonly phase: Float64Array;
  private readonly increment: Float64Array;
  private readonly level: Float64Array;
  private readonly velocity: Float64Array;
  private readonly releasing: Uint8Array;
  private readonly age: Float64Array;
  private readonly plucked:Uint8Array;
  private serial = 0;
  steals = 0;
  sound: 'organ' | 'pluck' = 'organ';

  constructor(readonly sampleRate: number, readonly capacity = 128) {
    this.plucked=new Uint8Array(capacity);
    this.pitch = new Int16Array(capacity).fill(-1);
    this.phase = new Float64Array(capacity);
    this.increment = new Float64Array(capacity);
    this.level = new Float64Array(capacity);
    this.velocity = new Float64Array(capacity);
    this.releasing = new Uint8Array(capacity);
    this.age = new Float64Array(capacity);
  }

  on(pitch: number, velocity: number, channel=0): void {
    if (!Number.isInteger(pitch) || pitch < 0 || pitch > 127) return;
    this.off(pitch,channel);
    let slot = this.pitch.indexOf(-1);
    if (slot < 0) {
      // Prefer a fading tail over cutting a held note.
      slot = 0;
      for (let i=1; i<this.capacity; i++) {
        if (this.releasing[i] > this.releasing[slot] ||
            (this.releasing[i] === this.releasing[slot] && this.age[i] < this.age[slot])) slot = i;
      }
      this.steals++;
    }
    this.pitch[slot] = pitch+channel*128;
    this.plucked[slot]=Number(this.sound==='pluck');
    this.phase[slot] = 0;
    this.increment[slot] = 2*Math.PI*440*Math.pow(2,(pitch-69)/12)/this.sampleRate;
    this.level[slot] = 0;
    this.velocity[slot] = Math.max(0,Math.min(127,velocity))/127;
    this.releasing[slot] = 0;
    this.age[slot] = ++this.serial;
  }

  off(pitch: number, channel=0): void {
    for (let i=0; i<this.capacity; i++) if (this.pitch[i] === pitch+channel*128) this.releasing[i] = 1;
  }

  silence(): void { this.pitch.fill(-1); this.level.fill(0); }

  sample(): number {
    let sum=0;
    const attack=1/(this.sampleRate*.004), release=Math.exp(-1/(this.sampleRate*.012));
    for(let i=0;i<this.capacity;i++) {
      if(this.pitch[i]<0)continue;
      if(this.releasing[i]) {
        this.level[i]*=release;
        if(this.level[i]<.00001){this.pitch[i]=-1;continue;}
      } else this.level[i]=Math.min(1,this.level[i]+attack);
      const phase=this.phase[i];
      const tone=Math.sin(phase)+.22*Math.sin(phase*2)+.08*Math.sin(phase*3);
      sum+=tone*this.level[i]*this.velocity[i]*.09;
      this.phase[i]=(phase+this.increment[i])%(2*Math.PI);
      if(this.plucked[i]&&!this.releasing[i])this.velocity[i]*=Math.exp(-1/(this.sampleRate*.9));
    }
    return sum;
  }
}
