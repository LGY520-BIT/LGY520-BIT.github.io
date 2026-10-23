// Project-owned validation helpers. No uploaded data leaves the browser.
export function safeModelPath(value) {
  if (typeof value !== 'string' || !value || value.length > 300 || /[\\:%?#\u0000-\u001f]/.test(value) || value.startsWith('/')) throw new Error('模型资源必须是目录内相对路径');
  const parts = value.split('/');
  if (parts.some(x => !x || x === '.' || x === '..')) throw new Error('模型资源路径不合法');
  return parts.join('/');
}
export function modelReferences(json) {
  const refs=json?.FileReferences;
  if (json?.Version !== 3 || !refs || typeof refs.Moc !== 'string' || !refs.Moc.endsWith('.moc3') || !Array.isArray(refs.Textures) || !refs.Textures.length || refs.Textures.length > 8) throw new Error('请选择 Cubism 的 .model3.json 模型及完整目录');
  const values=[refs.Moc,...refs.Textures];
  for (const key of ['Physics','Pose','DisplayInfo','UserData']) if(refs[key]) values.push(refs[key]);
  const expressions=refs.Expressions || [];
  if (!Array.isArray(expressions) || expressions.length>100) throw new Error('表情文件数量超限');
  for (const item of expressions) values.push(item.File);
  const motions=refs.Motions || {};
  if (typeof motions!=='object' || Array.isArray(motions) || Object.keys(motions).length>30) throw new Error('动作配置不合法');
  let count=0;
  for (const entries of Object.values(motions)) {
    if (!Array.isArray(entries)) throw new Error('动作配置不合法');
    for(const item of entries) { if(++count>150) throw new Error('动作文件数量超限'); values.push(item.File); }
  }
  return [...new Set(values.map(safeModelPath))];
}
export function rewriteLocalModel(json, resolve) {
  modelReferences(json);
  const refs=json.FileReferences;
  const clean={Version:3,FileReferences:{Moc:resolve(refs.Moc),Textures:refs.Textures.map(resolve)}};
  for(const key of ['Physics','Pose','DisplayInfo','UserData']) if(refs[key])clean.FileReferences[key]=resolve(refs[key]);
  if(refs.Expressions)clean.FileReferences.Expressions=refs.Expressions.map(item=>({Name:String(item.Name||'').slice(0,80),File:resolve(item.File)}));
  if(refs.Motions)clean.FileReferences.Motions=Object.fromEntries(Object.entries(refs.Motions).map(([group,entries])=>[group,entries.map(item=>({File:resolve(item.File),...(Number.isFinite(item.FadeInTime)?{FadeInTime:item.FadeInTime}:{}),...(Number.isFinite(item.FadeOutTime)?{FadeOutTime:item.FadeOutTime}:{})}))]));
  // Voice references are intentionally omitted. We do not have redistribution rights for sample voices.
  if(Array.isArray(json.Groups))clean.Groups=json.Groups.slice(0,20).map(g=>({Target:String(g.Target||'').slice(0,40),Name:String(g.Name||'').slice(0,80),Ids:Array.isArray(g.Ids)?g.Ids.slice(0,100).map(x=>String(x).slice(0,100)):[]}));
  if(Array.isArray(json.HitAreas))clean.HitAreas=json.HitAreas.slice(0,20).map(g=>({Id:String(g.Id||'').slice(0,100),Name:String(g.Name||'').slice(0,80)}));
  if(json.Layout&&typeof json.Layout==='object')clean.Layout=Object.fromEntries(Object.entries(json.Layout).filter(([k,v])=>/^(CenterX|CenterY|X|Y|Width|Height|Top|Bottom|Left|Right)$/.test(k)&&Number.isFinite(v)));
  clean.url='local-import.model3.json';
  return clean;
}
