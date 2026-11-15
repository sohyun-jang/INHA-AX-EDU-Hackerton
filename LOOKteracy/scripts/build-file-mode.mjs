// 파일로 바로 열기(file://)에 쓰는 모델 묶음을 만든다.
// dist/vendor의 모델·wasm 파일을 base64로 담아 dist/file-mode/assets-*.js로 쓴다.
// dist/file-mode/loader.js가 파일로 연 화면에서 이 묶음을 읽는다.
// vendor 파일을 바꾸면 다시 실행하세요: npm run build:file-mode
// npm run check는 디스크의 묶음이 지금 vendor 파일로 만든 내용과 똑같은지 확인한다.
import { writeFile, rename, rm, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { GROUPS, bundleText } from './file-mode-files.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const outDir = path.join(dist, 'file-mode');
const names = Object.keys(GROUPS);

// 세 묶음을 모두 만든 뒤에만 바꿔 넣는다. 중간에 실패하면 예전 묶음이 그대로 남는다.
const texts = {};
for (const name of names) texts[name] = await bundleText(dist, name);
await mkdir(outDir, { recursive: true });
try {
  for (const name of names) await writeFile(path.join(outDir, name + '.tmp'), texts[name]);
  for (const name of names) await rename(path.join(outDir, name + '.tmp'), path.join(outDir, name));
} catch (err) {
  for (const name of names) await rm(path.join(outDir, name + '.tmp'), { force: true });
  throw err;
}
for (const name of names) console.log(`${name}: 파일 ${GROUPS[name].length}개, ${(Buffer.byteLength(texts[name]) / 1e6).toFixed(1)} MB`);
