export interface GridOptions {horizontal:number;vertical:number;gridLow:number;clavierLow:number;maximum:number;}
export const defaultGridOptions=():GridOptions=>({horizontal:4,vertical:3,gridLow:24,clavierLow:48,maximum:127});
export function validateGridOptions(value:GridOptions):GridOptions {
  for(const key of ['horizontal','vertical'] as const)if(!Number.isInteger(value[key])||value[key]<1||value[key]>12)throw Error('Each grid interval must be a whole number from 1 to 12.');
  for(const [key,max]of [['gridLow',108],['clavierLow',72]] as const)if(!Number.isInteger(value[key])||value[key]<0||value[key]>max||value[key]%12!==0)throw Error('Choose a valid lowest C for each surface.');
  if(!Number.isInteger(value.maximum)||value.maximum<0||value.maximum>127)throw Error('Highest pitch must be a MIDI number from 0 to 127.');
  if(value.maximum<value.gridLow||value.maximum<value.clavierLow)throw Error('Highest pitch must include the lowest note of both surfaces.');
  return {...value};
}
