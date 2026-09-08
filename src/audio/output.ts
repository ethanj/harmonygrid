/** Stereo-linked limiter with one render block of lookahead. */
export class OutputLevel {
  private gain=1;
  private readonly release:number;
  private left=new Float32Array(0);
  private right=new Float32Array(0);
  private previousLimit=1;
  constructor(sampleRate:number){this.release=Math.exp(-1/(sampleRate*.1));}
  process(left:Float32Array,right:Float32Array):void {
    if(this.left.length!==left.length){
      this.left=new Float32Array(left.length);this.right=new Float32Array(left.length);
      this.previousLimit=1;this.gain=1;
    }
    let peak=0;
    for(let i=0;i<left.length;i++)peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));
    const nextLimit=peak>.85?.85/peak:1;
    // Both ramp endpoints are safe for the delayed block. Anticipate the next
    // block's peak, so its first sample never requires an abrupt gain reduction.
    const target=Math.min(this.previousLimit,nextLimit),start=this.gain;
    for(let i=0;i<left.length;i++){
      this.gain=target<start?start+(target-start)*(i+1)/left.length:target+(this.gain-target)*this.release;
      const l=left[i],r=right[i];
      left[i]=this.left[i]*this.gain;right[i]=this.right[i]*this.gain;
      this.left[i]=l;this.right[i]=r;
    }
    this.previousLimit=nextLimit;
  }
}
