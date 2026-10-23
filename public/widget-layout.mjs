// Geometry only. No DOM, pointer recording, audio or character runtime access.
export function overlapsWidget(a,b,gap=8){
  if(!a||!b)return false;
  return a.left<b.right+gap&&a.right>b.left-gap&&a.top<b.bottom+gap&&a.bottom>b.top-gap;
}
export function chooseWidgetPosition(rect,{width,height},obstacles=[],preferred=rect){
  const w=Number(rect?.width),h=Number(rect?.height),vw=Number(width),vh=Number(height),margin=8;
  if(![w,h,vw,vh].every(Number.isFinite)||w<=0||h<=0||vw<16||vh<16)return null;
  const clamp=(x,max)=>Math.max(margin,Math.min(Math.max(margin,max),Number.isFinite(x)?x:margin));
  const point=(x,y)=>({x:clamp(x,vw-w-margin),y:clamp(y,vh-h-margin)});
  const current=point(preferred?.left,preferred?.top);
  const candidates=[current,point(margin,vh-h-margin),point(vw-w-margin,vh-h-margin),point(margin,margin),point(vw-w-margin,margin)];
  const visible=obstacles.filter(item=>item&&[item.left,item.top,item.right,item.bottom].every(Number.isFinite)&&item.right>item.left&&item.bottom>item.top&&item.right>0&&item.bottom>0&&item.left<vw&&item.top<vh);
  const box=item=>({left:item.x,top:item.y,right:item.x+w,bottom:item.y+h});
  const clear=candidates.filter(item=>!visible.some(obstacle=>overlapsWidget(box(item),obstacle)));
  if(!clear.length)return {...current,occluded:true};
  clear.sort((a,b)=>Math.hypot(a.x-current.x,a.y-current.y)-Math.hypot(b.x-current.x,b.y-current.y));
  return {...clear[0],occluded:false};
}
export function editingWidgetFocus(element){
  if(!element||element.disabled||element.readOnly)return false;
  const tag=String(element.tagName||'').toLowerCase();
  if(tag==='textarea'||element.isContentEditable)return true;
  return tag==='input'&&!['button','submit','reset','checkbox','radio','range','color','file','hidden'].includes(String(element.type||'text').toLowerCase());
}
