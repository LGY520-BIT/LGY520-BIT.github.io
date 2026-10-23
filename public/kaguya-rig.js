import {animatedParameters,deformRigMesh,validateRig} from './kaguya-rig-utils.mjs';

// Built on the existing MIT PixiJS renderer; no synthetic .moc3, network service,
// microphone, keyboard collection, screen capture or audio playback is used.
export async function createKaguyaRig(PIXI,{fetcher=fetch,onReady=()=>{}}={}) {
  const response=await fetcher('/models/kaguya/rig.json',{credentials:'same-origin'});
  if(!response.ok)throw new Error('辉夜分层模型清单无法读取');
  const manifest=validateRig(await response.json());
  const container=new PIXI.Container(),head=new PIXI.Container();
  const meshes=[],layers=new Map(),textures=[];
  let disposed=false,lookX=0,lookY=0,expression=0,wavingUntil=0;
  head.pivot.set(160,105);head.position.set(160,105);
  for(const layer of manifest.layers) {
    const base=PIXI.Texture.from(layer.src);
    if(!base.baseTexture.valid)await new Promise((resolve,reject)=>{base.baseTexture.once('loaded',resolve);base.baseTexture.once('error',()=>reject(new Error('辉夜分层纹理读取失败')));});
    const texture=layer.region?new PIXI.Texture(base.baseTexture,new PIXI.Rectangle(...layer.region)):base;
    textures.push(texture);
    const item=layer.mesh?new PIXI.SimplePlane(texture,6,9):new PIXI.Sprite(texture);
    const [x,y,width,height]=layer.dest||[0,0,320,520];
    item.width=width;item.height=height;item.position.set(x,y);
    item.eventMode='none';item.interactive=false;
    if(layer.pivot){item.pivot.set(...layer.pivot);item.position.set(x+layer.pivot[0]*width/texture.width,y+layer.pivot[1]*height/texture.height);}
    item.rigOrigin={x:item.position.x,y:item.position.y,scaleY:item.scale.y};
    if(layer.mesh){const buffer=item.geometry.getBuffer('aVertexPosition');meshes.push({item,buffer,base:new Float32Array(buffer.data),width:texture.width,height:texture.height,kind:layer.mesh});}
    layers.set(layer.id,item);
    if(layer.parent==='head')head.addChild(item);
    else{if(layer.id==='face')container.addChild(head);container.addChild(item);}
  }
  if(!head.parent)container.addChild(head);
  // Head group must stay after body and before foreground accessories.
  if(container.children.includes(head))container.setChildIndex(head,Math.min(container.children.length-1,manifest.headIndex??4));
  container.scale.set(244/320);container.position.set(6,2);
  const redraw=(time,state='idle',fixed=null)=>{
    if(disposed)return;
    const p=fixed||animatedParameters(time,{state,lookX,lookY,expression,wavingUntil});
    head.rotation=p.headX*Math.PI/180*.18;head.position.x=160+p.headX*.12;head.position.y=105+p.headY*.12;
    for(const mesh of meshes){mesh.buffer.data.set(deformRigMesh(mesh.base,mesh.width,mesh.height,p,mesh.kind));mesh.buffer.update();}
    const eyes=layers.get('eyes'),closed=layers.get('eyes-closed'),mouth=layers.get('mouth'),hand=layers.get('wave-arm');
    if(eyes){eyes.visible=p.eyeOpen>.15;eyes.position.x=eyes.rigOrigin.x+p.eyeX*1.4;eyes.position.y=eyes.rigOrigin.y+p.eyeY*.6;eyes.scale.y=eyes.rigOrigin.scaleY*Math.max(.08,p.eyeOpen);}
    if(closed)closed.visible=p.eyeOpen<=.15;
    if(mouth){mouth.scale.y=mouth.rigOrigin.scaleY*(.18+p.mouthOpen);mouth.visible=true;}
    if(hand)hand.rotation=-p.wave*.22;
    const body=layers.get('body');if(body)body.position.y=body.rigOrigin.y-p.breath*1.4;
    return p;
  };
  redraw(0);onReady(manifest);
  return {container,manifest,redraw,focus(x,y){lookX=Math.max(-1,Math.min(1,(x-128)/128));lookY=Math.max(-1,Math.min(1,(y-160)/200));},
    perform(kind,time=performance.now()){if(kind==='expression')expression=(expression+1)%3;else wavingUntil=time+2200;redraw(time);},
    destroy(){disposed=true;container.destroy({children:true,texture:false,baseTexture:false});for(const texture of textures)if(texture!==PIXI.Texture.EMPTY)texture.destroy(false);}};
}
