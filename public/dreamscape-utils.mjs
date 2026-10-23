export const DEFAULT_DREAM=Object.freeze({enabled:true,dynamic:true,gray:72,veil:88,time:'auto',hour:12,motion:true,petals:true,quality:'low',dissolve:'none',amount:40,radius:.22,clock:false});
const bound=(v,min,max,fallback)=>Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback;
export function cleanDream(value={}){
 if(!value||typeof value!=='object'||Array.isArray(value))value={};
 return {enabled:value.enabled!==false,dynamic:value.dynamic!==false,gray:bound(value.gray,0,100,72),veil:bound(value.veil,40,94,88),time:['auto','dawn','day','sunset','night','custom'].includes(value.time)?value.time:'auto',hour:bound(value.hour,0,24,12),motion:value.motion!==false,petals:value.petals!==false,quality:value.quality==='high'?'high':'low',dissolve:['none','auto','hover','slider'].includes(value.dissolve)?value.dissolve:'none',amount:bound(value.amount,0,100,40),radius:bound(value.radius,.08,.35,.22),clock:value.clock===true};
}
export function dreamProperties(value,{quiet=false}={}){
 const s=cleanDream(value);
 return {time_mode:{value:({auto:'realtime',dawn:'sunrise'})[s.time]||s.time},custom_time:{value:s.hour},enable_motion:{value:s.motion&&!quiet},enable_parallax:{value:false},enable_petals:{value:s.petals&&!quiet},particle_type:{value:s.petals&&!quiet?'auto':'none'},render_quality:{value:s.quality==='high'?'1440p':'1080p'},display_mode:{value:s.clock?'clock_poem':'immersive'},audio_reactive:{value:false},particle_audio:{value:false},bgm_mode:{value:'none'},bgm_volume:{value:0},dissolve_mode:{value:quiet?'none':s.dissolve},dissolve_slider:{value:s.amount},dissolve_radius:{value:s.radius},mouse_trail:{value:'none'}};
}
export function dreamHour(hour){const n=Math.round(bound(Number(hour),0,24,0)*60);return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
