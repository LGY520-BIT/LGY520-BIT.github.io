// First-party editable 2D rig maths. This is NOT a Cubism / moc3 implementation.
export const parameterLimits = Object.freeze({headX:[-25,25],headY:[-15,15],breath:[0,1],eyeOpen:[0,1],eyeX:[-1,1],eyeY:[-1,1],mouthOpen:[0,1],hair:[-1,1],wave:[0,1]});
export function rigParameters(input={}) {
  return Object.fromEntries(Object.entries(parameterLimits).map(([key,[min,max]])=>{
    const raw=Number(input[key]);
    const fallback=key==='eyeOpen'?1:0;
    return [key,Number.isFinite(raw)?Math.max(min,Math.min(max,raw)):fallback];
  }));
}
export function deformRigMesh(base,width,height,input,kind='hair') {
  if (!(base instanceof Float32Array) || !Number.isFinite(width) || !Number.isFinite(height) || width<=0 || height<=0) throw new Error('Invalid mesh');
  const p=rigParameters(input), result=new Float32Array(base.length);
  for(let i=0;i<base.length;i+=2) {
    const x=base[i],y=base[i+1],u=x/width,v=y/height;
    const weight=Math.max(0,v-.18);
    const swing=kind==='hair'?p.hair*14*weight*weight:kind==='sleeve'?p.wave*8*weight:0;
    result[i]=x+swing+Math.sin(v*Math.PI)*p.headX*.065;
    result[i+1]=y-(kind==='body'?Math.sin(v*Math.PI)*p.breath*2.6:0)+Math.sin(u*Math.PI)*p.headY*.025;
  }
  return result;
}
export function animatedParameters(time,{state='idle',lookX=0,lookY=0,expression=0,wavingUntil=0}={}) {
  const seconds=time/1000,cycle=seconds%4.8;
  const blink=cycle<.13?Math.abs(cycle-.065)/.065:1;
  return rigParameters({headX:lookX*14+Math.sin(seconds*.7)*2,headY:lookY*8,breath:(Math.sin(seconds*2)+1)/2,
    eyeOpen:expression===1?.08:blink,eyeX:lookX,eyeY:lookY,mouthOpen:state==='talking'?(Math.sin(seconds*15)+1)*.38:expression===2?.55:.02,
    hair:Math.sin(seconds*1.45)*.65+lookX*.2,wave:time<wavingUntil?(Math.sin(seconds*8)+1)/2:0});
}
export function validateRig(manifest) {
  if(manifest?.format!=='fieldnotes-layered-2d-v1'||manifest.character!=='kaguya'||manifest.cubism!==false||!Array.isArray(manifest.layers)||manifest.layers.length<5||manifest.layers.length>16)throw new Error('Not a supported layered 2D rig');
  for(const layer of manifest.layers) {
    if(!/^[a-z][a-z0-9-]{0,30}$/.test(layer.id)||!/^\/models\/kaguya\/[a-z0-9-]+\.(svg|png)$/.test(layer.src))throw new Error('Rig assets must be fixed local images');
    if(layer.region&&(!Array.isArray(layer.region)||layer.region.length!==4||layer.region.some(x=>!Number.isFinite(x)||x<0)||layer.region[2]===0||layer.region[3]===0))throw new Error('Invalid atlas region');
    if(layer.dest&&(!Array.isArray(layer.dest)||layer.dest.length!==4||layer.dest.some(x=>!Number.isFinite(x))||layer.dest[2]<=0||layer.dest[3]<=0))throw new Error('Invalid layer placement');
  }
  return manifest;
}
