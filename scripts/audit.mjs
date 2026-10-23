import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const ignored=new Set(['node_modules','.git','dist','.astro']);
export function files(root){return fs.readdirSync(root,{withFileTypes:true}).flatMap(entry=>{if(ignored.has(entry.name))return [];const full=path.join(root,entry.name);if(entry.isSymbolicLink())throw new Error('Symlink rejected: '+entry.name);return entry.isDirectory()?files(full):[full]})}
export function audit(root){
  root=root instanceof URL?fileURLToPath(root):root;
  const issues=[];const list=files(root);let bytes=0;
  const prohibited=/(^|\/)(?:\.local|verification|local|live2d|wallpapers|uploads|\.env[^/]*|.*\.(?:pem|key|pfx|mp4|moc3))($|\/)/i;
  const secrets=[/\bgh[pousr]_[A-Za-z0-9]{30,}\b/,/\bgithub_pat_[A-Za-z0-9_]{30,}\b/,/\bsk-[A-Za-z0-9_-]{20,}\b/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/[A-Z]:[\\/]Users[\\/]/i];
  for(const file of list){const rel=path.relative(root,file).replaceAll('\\','/');const b=fs.readFileSync(file);bytes+=b.length;if(prohibited.test(rel))issues.push({file:rel,type:'excluded-path'});if(b.length>20*1024*1024)issues.push({file:rel,type:'oversize'});if(/\.(?:astro|js|mjs|ts|css|json|md|yml|html|xml|txt|svg)$/.test(rel)){const text=b.toString('utf8');if(secrets.some(re=>re.test(text)))issues.push({file:rel,type:'credential-or-private-path'});if(/\.(?:html|xml)$/.test(rel)&&/https?:\/\/(?:127\.0\.0\.1|localhost)|mightyjoy64\.chatgpt\.site|\/api\/local\//i.test(text))issues.push({file:rel,type:'local-service-reference'});}}
  return {ok:issues.length===0,files:list.length,bytes,issues};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const result=audit(path.resolve(process.argv[2]||'.'));console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=1}
