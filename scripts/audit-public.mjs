import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'.');
const issues=[]; let files=0,bytes=0;
function walk(dir){
 for(const e of fs.readdirSync(dir,{withFileTypes:true})){
  if(['.git','node_modules','.astro','dist'].includes(e.name))continue;
  const p=path.join(dir,e.name),rel=path.relative(root,p).replaceAll('\\','/');
  if(e.isSymbolicLink()){issues.push({file:rel,rule:'symlink'});continue;}
  if(e.isDirectory()){walk(p);continue;}
  files++;const b=fs.readFileSync(p);bytes+=b.length;
  if(/(^|\/)(?:\.env(?:\..*)?|\.local|verification|local|references|backups)(\/|$)/i.test(rel))issues.push({file:rel,rule:'private-path'});
  if(/(?:^|\/)(?:studio|media|history)\/index\.html$|(?:^|\/)(?:local-admin|anime-editor|media-library|history-center)\.js$/.test(rel))issues.push({file:rel,rule:'admin-surface'});
  if(b.length>99*1024*1024)issues.push({file:rel,rule:'github-file-limit'});
  if(!/\.(?:m?js|ts|astro|html|css|json|md|txt|yml|svg|xml)$/i.test(rel))continue;
  const text=b.toString('utf8');
  if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{30,}|\bsk-[A-Za-z0-9_-]{24,}/.test(text))issues.push({file:rel,rule:'credential'});
  if(/[A-Z]:[\\/](?:Users|个人博客搭建|Steam)[\\/]/i.test(text))issues.push({file:rel,rule:'host-path'});
  if(/\.(?:js|mjs|html)$/.test(rel)&&/fetch\s*\(\s*['"`]\/(?:__local|api)\//.test(text))issues.push({file:rel,rule:'local-service-call'});
  if(rel.startsWith('src/content/')&&/^draft:\s*true\s*$/im.test(text))issues.push({file:rel,rule:'draft-source'});
 }
}
walk(root);console.log(JSON.stringify({ok:issues.length===0,files,bytes,issues},null,2));if(issues.length)process.exitCode=1;
