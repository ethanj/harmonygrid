/** Stereo-linked peak gain control; no lookahead or added scheduling latency. */
export class OutputLevel {
  private gain=1;
  private readonly release:number;
  constructor(sampleRate:number){this.release=Math.exp(-1/(sampleRate*.1));}
  scale(left:number,right:number):number {
    const peak=Math.max(Math.abs(left),Math.abs(right));
    const target=peak>.9?.9/peak:1;
    this.gain=target<this.gain?target:target+(this.gain-target)*this.release;
    return this.gain;
  }
}
