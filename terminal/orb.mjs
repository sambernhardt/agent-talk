// CPU version of the browser cloud field; character cells are roughly twice
// as tall as they are wide, so two columns represent one vertical unit.
const palette = [[38,133,245],[89,183,247],[146,218,246],[214,245,250],[240,249,240]];
const clamp = (x, lo=0, hi=1) => Math.max(lo,Math.min(hi,x));
const smooth = (a,b,x) => { const t=clamp((x-a)/(b-a)); return t*t*(3-2*t); };
const mix = (a,b,t) => a.map((v,i)=>v+(b[i]-v)*t);
const hash = (x,y,z) => { const n=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453;return n-Math.floor(n); };
function noise(x,y,z) {
  const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);
  const fx=smooth(0,1,x-ix),fy=smooth(0,1,y-iy),fz=smooth(0,1,z-iz);
  let value=0;
  for(let k=0;k<2;k++)for(let j=0;j<2;j++)for(let i=0;i<2;i++)
    value+=hash(ix+i,iy+j,iz+k)*(i?fx:1-fx)*(j?fy:1-fy)*(k?fz:1-fz);
  return value;
}
function fbm(x,y,z) {
  let v=0,a=.53;
  for(let i=0;i<4;i++){v+=a*noise(x,y,z);x=x*2.03+4.1;y=y*2.03+1.7;z=z*2.03+2.4;a*=.49;}
  return v;
}
export function orbState(session, output=0) {
  if(session.state!=='listening')return session.state==='starting'?'thinking':'idle';
  if(output>.025)return 'talking';
  return ['queued','working'].includes(session.handoff?.state)?'thinking':'idle';
}
export const characterPresets = {
  original: '.:;-=+*#%@',
  dense: '=+*#%@',
  blocks: '░▒▓█',
  dots: '·•●',
  solid: '█',
};
export function asciiOrb({columns=80,rows=8,time=0,state='idle',amplitude=0,color=false,characterPreset='solid',customCharacters='.:;-=+*#%@'}={}) {
  rows=Math.max(0,Math.floor(rows));columns=Math.max(0,Math.floor(columns));
  if(rows<4||columns<12)return [];
  const width=Math.min(columns-4,rows*2),height=Math.min(rows,Math.floor(width/2));
  const indent=' '.repeat(Math.max(2,Math.floor((columns-width)/2)));
  const level=state==='talking'?clamp(amplitude):0;
  const radius=.81+.025*Math.sin(time*.8)+level*.13;
  const chars=Array.from(characterPreset==='custom'?(customCharacters||characterPresets.original):(characterPresets[characterPreset]||characterPresets.original)),lines=[];
  for(let row=0;row<height;row++){
    let line=indent;
    for(let col=0;col<width;col++){
      const x=((col+.5)/width*2-1)/radius,y=(1-(row+.5)/height*2)/radius;
      if(x*x+y*y>1){line+=' ';continue;}
      const broad=fbm(x*2.1,y*2.1,time*.10);
      const field=y+.24*x+.30*Math.sin(x*2.1+time*.23)+.82*(broad-.5)+.09*Math.sin(x*5+y*2+time*.27);
      let rgb=mix(palette[0],palette[1],smooth(-.78,-.13,field));
      rgb=mix(rgb,palette[2],smooth(-.52,-.04,field));
      rgb=mix(rgb,palette[3],smooth(-.12,.43,field));
      rgb=mix(rgb,palette[4],Math.exp(-(((field-.16)/.19)**2))*.94);
      const lum=(rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722)/255;
      const glyph=chars[Math.min(chars.length-1,Math.floor((1-lum)*chars.length*1.65)+1)];
      line+=color?`\x1b[38;2;${rgb.map(v=>Math.round(v*.65+80)).join(';')}m${glyph}`:glyph;
    }
    lines.push(line+(color?'\x1b[0m':''));
  }
  return lines;
}
