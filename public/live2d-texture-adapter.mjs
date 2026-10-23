// Prefer deterministic local web atlases; the original model files never change.
// Legacy/import adaptation remains available but is not the default Yachiyo path.
export function textureLimit(maxTextureSize){
 if(!Number.isFinite(maxTextureSize)||maxTextureSize<2048)throw new Error('显卡纹理上限不足 2048，已保留八千代头像');
 return maxTextureSize>=4096?4096:2048;
}
export async function prepareModelTextures(settings,{maxTextureSize,prebuilt,signal,fetcher=fetch,bitmap=globalThis.createImageBitmap,makeCanvas=()=>document.createElement('canvas'),makeURL=blob=>URL.createObjectURL(blob),revokeURL=url=>URL.revokeObjectURL(url),isCurrent=()=>true}={}){
 const limit=textureLimit(maxTextureSize),urls=[],dimensions=[];
 if(prebuilt){
  if(!isCurrent())throw new Error('模型加载已取消');
  const response=await fetcher(prebuilt.manifestURL,{credentials:'same-origin',signal});
  if(!response.ok)throw new Error('网页角色纹理清单不可读；已保留头像');
  const manifest=await response.json();
  if(!isCurrent())throw new Error('模型加载已取消');
  if(manifest.version!==1||manifest.resolution!==2048||manifest.resolution>limit||!Array.isArray(manifest.textures)||manifest.textures.length!==settings.FileReferences.Textures.length)throw new Error('网页角色纹理清单不匹配');
  const textures=manifest.textures.map((record,index)=>{
   // A local metadata file is data, not executable input or arbitrary URL authority.
   if(record.source!==`textures/texture_${String(index).padStart(2,'0')}.png`||record.output!==`web/texture_${String(index).padStart(2,'0')}.2048.png`||record.width!==2048||record.height!==2048||record.mode!=='RGBA'||!Number.isSafeInteger(record.bytes)||record.bytes<=0||!/^[a-f0-9]{64}$/.test(record.sha256))throw new Error('网页角色纹理路径不合法');
   if(new URL(record.source,prebuilt.baseURL).href!==settings.FileReferences.Textures[index])throw new Error('网页角色纹理与模型不匹配');
   dimensions.push([2048,2048]);return new URL(record.output,prebuilt.baseURL).href;
  });
  return{settings:{...settings,FileReferences:{...settings.FileReferences,Textures:textures}},urls:[],limit:2048,dimensions,prebuilt:true};
 }
 try{
  for(const source of settings.FileReferences.Textures){
   if(!isCurrent())throw new Error('模型加载已取消');
   if(typeof bitmap!=='function')throw new Error('浏览器不支持角色纹理解码');
   const response=await fetcher(source,{credentials:'same-origin'});if(!response.ok)throw new Error('本地角色纹理不可读');
   const input=await response.blob();let image,canvas;
   try{
    image=await bitmap(input,{resizeWidth:limit,resizeHeight:limit,resizeQuality:'high'});
    if(!isCurrent())throw new Error('模型加载已取消');
    const ratio=Math.min(1,limit/image.width,limit/image.height);
    const width=Math.max(1,Math.round(image.width*ratio)),height=Math.max(1,Math.round(image.height*ratio));
    canvas=makeCanvas();canvas.width=width;canvas.height=height;
    const context=canvas.getContext('2d',{alpha:true});if(!context)throw new Error('无法准备角色纹理');
    context.drawImage(image,0,0,width,height);
    const result=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('角色纹理适配失败')),'image/png'));
    canvas.width=canvas.height=1;
    if(!isCurrent())throw new Error('模型加载已取消');
    urls.push(makeURL(result));dimensions.push([width,height]);
   }finally{image?.close?.();if(canvas)canvas.width=canvas.height=1;}
  }
  return{settings:{...settings,FileReferences:{...settings.FileReferences,Textures:urls}},urls,limit,dimensions};
 }catch(error){for(const url of urls)revokeURL(url);throw error;}
}
