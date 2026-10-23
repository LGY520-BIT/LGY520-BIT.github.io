// Pure recovery helpers; session records never perform writes to the API by themselves.
export const SPACE_PENDING_LIMIT = 1150000;
export function parseSpacePending(raw, kind) {
  if (typeof raw !== 'string' || raw.length > SPACE_PENDING_LIMIT) return null;
  let value; try { value=JSON.parse(raw); } catch { return null; }
  if (!value || value.kind !== kind || !['profile','links'].includes(kind) || !['save','delete'].includes(value.operation) || !Number.isSafeInteger(value.revision) || value.revision<1 || !value.draft || typeof value.draft !== 'object' || Array.isArray(value.draft)) return null;
  if (kind==='profile') {
    if (value.operation!=='save') return null;
    for(const [name,max] of [['siteName',32],['displayName',40],['signature',160],['bio',1200],['location',80],['avatar',550000],['cover',550000]]) if(typeof value.draft[name]!=='string' || value.draft[name].length>max)return null;
    if(!Array.isArray(value.draft.interests)||value.draft.interests.length>12||value.draft.interests.some(item=>typeof item!=='string'||item.length>20))return null;
  } else {
    for(const [name,max] of [['id',80],['title',80],['url',2048],['description',280],['category',30]])if(typeof value.draft[name]!=='string'||value.draft[name].length>max)return null;
    if(!/^[a-zA-Z0-9_-]{1,80}$/u.test(value.draft.id)||typeof value.draft.pinned!=='boolean')return null;
    if(value.draft.image!==undefined&&(typeof value.draft.image!=='string'||value.draft.image.length>550000))return null;
  }
  return value;
}
function profileValues(value) {
  const result={};for(const key of ['siteName','displayName','signature','bio','location','avatar','cover'])result[key]=typeof value?.[key]==='string'?value[key].trim():'';
  result.interests=[...new Set((value?.interests||[]).map(item=>String(item).trim()))];return result;
}
function linkValues(value) {
  if(!value)return null;
  const result={};for(const key of ['id','title','url','description','category','image'])result[key]=typeof value[key]==='string'?value[key].trim():'';
  try{result.url=new URL(result.url).href;}catch{}
  result.pinned=value.pinned===true;return result;
}
export function pendingMatchesSpace(pending,state) {
  if(!pending||!state)return false;
  if(pending.kind==='profile')return JSON.stringify(profileValues(pending.draft))===JSON.stringify(profileValues(state.profile));
  const current=state.links?.items?.find(item=>item.id===pending.draft.id);
  if(pending.operation==='delete')return !current;
  return JSON.stringify(linkValues(pending.draft))===JSON.stringify(linkValues(current));
}
