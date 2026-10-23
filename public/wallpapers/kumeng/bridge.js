/* Audited fixed-source adapter. No desktop capture, filesystem or wallpaper audio. */
(() => {
 'use strict';
 const parentOrigin=location.origin;
 const defaults={time_mode:'realtime',custom_time:12,cycle_speed:1,enable_motion:true,enable_parallax:true,parallax_strength:1,parallax_tilt:false,enable_petals:true,particle_type:'auto',particle_density:40,particle_repel:true,particle_audio:false,mouse_trail:'none',mouse_trail_density:30,render_quality:'1080p',render_view:'0',display_mode:'immersive',clock_position:'right_bottom',clock_scale:.9,clock_offset_x:0,clock_offset_y:0,clock_hour_format:'24h',clock_color:'0.97 0.94 0.91',show_seconds:false,show_greeting:false,custom_poem:'我在梦里，|也在梦的尽头。',enable_countdown:false,countdown_title:'',countdown_date:'',character_expression:'natural',smile_intensity:1,audio_reactive:false,dissolve_mode:'none',dissolve_slider:0,dissolve_radius:.18,dissolve_engine:'classic',show_credits_badge:false,bloom:.04,exposure:0,softness:.68,strength:.42,hair_sheen:.65};
 const properties=Object.fromEntries(Object.entries(defaults).map(([key,value])=>[key,{value}]));
 window._weProperties=properties;window._weGeneralProperties={fps:30};window._weIsPaused=false;
 const enums={time_mode:['realtime','sunrise','day','sunset','night','custom','cycle'],render_quality:['1080p','1440p'],particle_type:['none','auto'],display_mode:['immersive','clock_only','clock_poem'],dissolve_mode:['none','auto','hover','slider']};
 const booleans=['enable_motion','enable_parallax','enable_petals'];
 const bounds={custom_time:[0,24],cycle_speed:[.2,3],dissolve_slider:[0,100],dissolve_radius:[.08,.35],parallax_strength:[.1,1.5]};
 const safe=input=>{
  const out={};if(!input||typeof input!=='object'||Array.isArray(input))return out;
  for(const [key,allowed]of Object.entries(enums)){const value=input[key]?.value;if(allowed.includes(value))out[key]={value};}
  for(const key of booleans)if(typeof input[key]?.value==='boolean')out[key]={value:input[key].value};
  for(const [key,[min,max]]of Object.entries(bounds)){const value=input[key]?.value;if(Number.isFinite(value))out[key]={value:Math.max(min,Math.min(max,value))};}
  return out;
 };
 const apply=input=>{
  const next={...safe(input),audio_reactive:{value:false},particle_audio:{value:false},mouse_trail:{value:'none'}};
  Object.assign(properties,next);window._weApplyCallback?.(next);
  if(next.render_quality)window.dispatchEvent(new Event('we-runtime-quality'));
 };
 const paused=value=>{window._weIsPaused=Boolean(value);window._wePausedCallback?.(Boolean(value));window.dispatchEvent(new Event('we-runtime-state'));};
 window.wallpaperPropertyListener={applyUserProperties:apply,applyGeneralProperties:()=>{},setPaused:paused};
 const send=(type,extra={})=>{if(parent!==window)parent.postMessage({type,...extra},parentOrigin);};
 const pointer=data=>{
  if(typeof data.active!=='boolean')return;
  if(!data.active){document.documentElement.dispatchEvent(new Event('pointerleave'));return;}
  if(!Number.isFinite(data.x)||!Number.isFinite(data.y)||data.x<0||data.x>1||data.y<0||data.y>1)return;
  const EventClass=typeof PointerEvent==='function'?PointerEvent:MouseEvent;
  window.dispatchEvent(new EventClass('pointermove',{clientX:data.x*window.innerWidth,clientY:data.y*window.innerHeight}));
 };
 window.addEventListener('message',event=>{
  if(event.source!==parent||event.origin!==parentOrigin||!event.data||typeof event.data!=='object'||Array.isArray(event.data))return;
  if(event.data.type==='dreamscape:config')apply(event.data.properties);
  if(event.data.type==='dreamscape:pause'&&typeof event.data.paused==='boolean')paused(event.data.paused);
  if(event.data.type==='dreamscape:pointer')pointer(event.data);
 });
 let reported=false;
 const check=()=>{
  if(document.querySelector('.scene-canvas.ready')){if(!reported){reported=true;send('dreamscape:ready');}}
  const failure=document.querySelector('.scene-initialization.failed');if(failure)send('dreamscape:error',{message:String(failure.textContent||'动态画面暂不可用').slice(0,180)});
 };
 const observe=()=>{new MutationObserver(check).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});check();send('dreamscape:bridge');};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();
})();
