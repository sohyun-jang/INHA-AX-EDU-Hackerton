import {readdir,readFile,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {GROUPS,bundleText} from './file-mode-files.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const dist=path.join(root,'dist');
const fail=msg=>{console.error('FAIL: '+msg);process.exit(1);};
const syntax=file=>{
 const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status??1);
};
for(const name of await readdir(dist)){
 if(name.endsWith('.js'))syntax(path.join(dist,name));
}
syntax(path.join(dist,'file-mode','loader.js'));
const html=await readFile(path.join(dist,'index.html'),'utf8');
for(const [,asset] of html.matchAll(/(?:src|href)="([^"]+)"/g)){
 if(asset.startsWith('#')||/^(https?:|data:)/.test(asset))continue;
 await access(path.join(dist,asset));
}
console.log('PASS: JavaScript syntax and index.html local assets.');
// 파일로 바로 열기: 시작 파일, loader.js의 묶음 목록, 묶음 내용(지금 vendor 파일로 만든 것과 바이트 단위로 같은지)
await access(path.join(root,'LOOKteracy.html')).catch(()=>fail('LOOKteracy.html이 없습니다.'));
const loader=await readFile(path.join(dist,'file-mode','loader.js'),'utf8');
const listed=[...(loader.match(/const ASSET_SCRIPTS = \[([^\]]*)\]/)?.[1]??'').matchAll(/'([^']+)'/g)].map(m=>m[1]);
if(listed.join()!==Object.keys(GROUPS).join())fail('dist/file-mode/loader.js의 ASSET_SCRIPTS가 scripts/file-mode-files.mjs의 GROUPS와 다릅니다.');
for(const name of Object.keys(GROUPS)){
 const want=await bundleText(dist,name);
 const have=await readFile(path.join(dist,'file-mode',name),'utf8').catch(()=>null);
 if(have===want)continue;
 if(have===null)fail(`dist/file-mode/${name}이 없습니다. npm run build:file-mode를 실행하세요.`);
 const a=have.split('\n'),b=want.split('\n');
 const i=b.findIndex((line,k)=>line!==a[k]);
 const file=(b[i]??'').match(/^LT_FILE_MODE\.add\("([^"]+)"/)?.[1];
 fail(`dist/file-mode/${name}${file?`의 ${file}`:''}이 dist/vendor와 맞지 않습니다. npm run build:file-mode를 실행하세요.`);
}
console.log('PASS: file mode bundles match dist/vendor.');
