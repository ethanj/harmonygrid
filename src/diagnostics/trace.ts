/** Rolling bounded evidence keeps the most recent performance instead of freezing after startup. */
export class Trace {
  private rows:unknown[]=[];
  private cursor=0;
  dropped=0;
  constructor(readonly capacity=20000){if(!Number.isInteger(capacity)||capacity<1)throw Error('Invalid trace capacity');}
  record(row:unknown):void {
    if(this.rows.length<this.capacity)this.rows.push(row);
    else{this.rows[this.cursor]=row;this.cursor=(this.cursor+1)%this.capacity;this.dropped++;}
  }
  export(environment:unknown):string {
    const events=this.dropped?[...this.rows.slice(this.cursor),...this.rows.slice(0,this.cursor)]:this.rows;
    return JSON.stringify({environment,dropped:this.dropped,retention:'most recent events',capacity:this.capacity,events},null,2);
  }
}
