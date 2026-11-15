// 파일로 바로 열기(file://)에 담는 vendor 파일 목록과 묶음 내용.
// build-file-mode.mjs는 이 내용으로 묶음을 쓰고, check.mjs는 디스크의 묶음이 이 내용과 똑같은지 비교한다.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

export const GROUPS = {
  'assets-face-api.js': [
    'vendor/face-api/models/tiny_face_detector_model-weights_manifest.json',
    'vendor/face-api/models/tiny_face_detector_model.bin',
    'vendor/face-api/models/face_landmark_68_model-weights_manifest.json',
    'vendor/face-api/models/face_landmark_68_model.bin',
    'vendor/face-api/models/face_recognition_model-weights_manifest.json',
    'vendor/face-api/models/face_recognition_model.bin',
  ],
  'assets-mediapipe.js': [
    'vendor/mediapipe-tasks/vision_bundle.mjs',
    'vendor/mediapipe-tasks/wasm/vision_wasm_internal.wasm',
    'vendor/mediapipe-tasks/face_landmarker.task',
  ],
  'assets-face-mesh.js': [
    'vendor/webgazer/mediapipe/face_mesh/face_mesh.binarypb',
    'vendor/webgazer/mediapipe/face_mesh/face_mesh_solution_packed_assets.data',
    'vendor/webgazer/mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.wasm',
    'vendor/webgazer/mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.data',
  ],
};

export const TYPES = {
  '.json': 'application/json',
  '.mjs': 'text/javascript',
  '.wasm': 'application/wasm',
};

// 이 묶음 끝에서 import map으로 잇는 ES 모듈 (facepass.js가 import()로 읽는다)
export const IMPORT_MAP = {
  'assets-mediapipe.js': 'vendor/mediapipe-tasks/vision_bundle.mjs',
};

// 묶음 하나의 내용. dist는 dist 폴더 경로.
export async function bundleText(dist, name) {
  let js = '/* 자동으로 만든 파일입니다. 직접 고치지 말고 npm run build:file-mode로 다시 만드세요. */\n';
  for (const rel of GROUPS[name]) {
    const buf = await readFile(path.join(dist, rel));
    const sha = createHash('sha256').update(buf).digest('hex');
    const type = TYPES[path.extname(rel)] ?? 'application/octet-stream';
    js += `LT_FILE_MODE.add(${JSON.stringify(rel)}, ${JSON.stringify(type)}, ${JSON.stringify(sha)}, "${buf.toString('base64')}");\n`;
  }
  if (IMPORT_MAP[name]) js += `LT_FILE_MODE.importMap(${JSON.stringify(IMPORT_MAP[name])});\n`;
  return js;
}
