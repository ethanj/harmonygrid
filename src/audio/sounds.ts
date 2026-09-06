export const sounds={organ:'Organ · instant',pluck:'Pluck · instant',piano:'Grand piano',electric:'Tine electric piano',vibes:'Vibraphone',tonewheel:'Tonewheel organ'} as const;
export type Sound=keyof typeof sounds;
export const soundPrograms:Partial<Record<Sound,number>>={piano:0,electric:4,vibes:11,tonewheel:16};
export const isSound=(value:unknown):value is Sound=>typeof value==='string'&&Object.hasOwn(sounds,value);
