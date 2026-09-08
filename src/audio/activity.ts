/*! Copyright (c) 2026 Ethan Joffe */
/** Wall-clock watchdog only; never schedules musical events. */
export class AudioActivity {
  private clock = 0;
  private clockAt = 0;
  private processorAt = 0;
  reset(now:number,clock:number):void {this.clock=clock;this.clockAt=now;this.processorAt=now;}
  received(now:number):void {this.processorAt=now;}
  check(now:number,clock:number,state:string):string|null {
    if(clock!==this.clock){this.clock=clock;this.clockAt=now;}
    if(state!=='running')return null;
    if(now-this.clockAt>2500)return 'Audio clock stopped';
    if(now-this.processorAt>2500)return 'Audio processor stopped responding';
    return null;
  }
}
