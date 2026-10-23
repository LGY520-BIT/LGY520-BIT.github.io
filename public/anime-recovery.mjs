// A pending save is evidence to reconcile, never an instruction to repeat a write.
export function parseAnimePending(raw) {
  if(typeof raw!=='string'||raw.length>16000)return null;
  let p;try{p=JSON.parse(raw);}catch{return null;}
  if(!p||!['save','delete'].includes(p.operation)||typeof p.revision!=='string'||!/^[a-f0-9]{64}$/.test(p.revision))return null;
  if(!p.selected||typeof p.selected!=='object'||Array.isArray(p.selected))return null;
  if(p.selected.id!==undefined&&(typeof p.selected.id!=='string'||!/^[a-z0-9-]{1,80}$/.test(p.selected.id)))return null;
  if(p.selected.subjectId!==undefined&&(!Number.isSafeInteger(p.selected.subjectId)||p.selected.subjectId<1))return null;
  if(!p.selected.id&&!p.selected.subjectId)return null;
  if(p.operation==='delete')return p.selected.id?p:null;
  const x=p.item;if(!x||typeof x!=='object')return null;
  for(const [key,max]of [['title',120],['titleJa',120],['review',240]])if(typeof x[key]!=='string'||x[key].length>max)return null;
  if(!['watching','favorite','completed','planned'].includes(x.status)||!(x.rating===null||Number.isFinite(x.rating)&&x.rating>=0&&x.rating<=5&&Number.isInteger(x.rating*2)))return null;
  if(!Array.isArray(x.tags)||x.tags.length>4||x.tags.some(t=>typeof t!=='string'||t.length>20))return null;
  if(!x.progress||!Number.isInteger(x.progress.current)||!Number.isInteger(x.progress.total)||x.progress.current<0||x.progress.total<1||x.progress.total>9999||x.progress.current>x.progress.total)return null;
  return p;
}
export function animePendingMatches(p,collection){
  const id=p.selected.id||`bgm-${p.selected.subjectId}`, current=collection?.items?.find(x=>x.id===id);
  if(p.operation==='delete')return !current;
  if(!current)return false;
  return ['title','titleJa','status','rating','review','tags','progress'].every(k=>JSON.stringify(p.item[k])===JSON.stringify(current[k]));
}
