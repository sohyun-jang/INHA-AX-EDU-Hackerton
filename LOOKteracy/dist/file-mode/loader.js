/* 파일로 바로 열기(file://) 지원
   LOOKteracy.html이나 dist/index.html을 Chrome·Edge에서 파일로 열었을 때만 동작한다.
   서버(http://127.0.0.1)로 열면 아무것도 하지 않는다.

   Chrome·Edge는 파일로 연 화면에서 옆 파일을 fetch·XMLHttpRequest로 읽지 못하고,
   crossorigin 스크립트와 ES 모듈 import도 막는다. 그래서 이 파일은 앱 스크립트보다 먼저 실행되어
   1. 얼굴 인식·눈 깜빡임·시선 추적 모델 파일을 base64로 담은 file-mode/assets-*.js를 읽는다
      (scripts/build-file-mode.mjs가 dist/vendor에서 만든다. vendor 파일을 바꾸면 다시 실행한다).
   2. fetch·XMLHttpRequest가 그 파일을 요청하면 Blob 주소로 바꿔 준다.
   3. MediaPipe 모듈(vision_bundle.mjs)은 import map으로 Blob 주소에 연결한다.
   4. 로컬 파일 스크립트에 붙는 crossorigin 속성은 떼어 낸다.
   5. Claude 채점 API(api/grade, api/grader)는 503 unavailable로 답해 앱이 루브릭 채점을 쓰게 한다.
   점검용으로 내준 파일은 LT_FILE_MODE.served, 찾지 못한 로컬 파일 요청은 LT_FILE_MODE.misses,
   읽지 못한 묶음은 LT_FILE_MODE.failed에 남는다. 이런 일이 있으면 카메라 준비 실패 안내를
   '새로고침' 대신 '압축을 다시 풀거나 로컬 서버로 열기'로 바꾼다. */
(() => {
  if (location.protocol !== 'file:') return;

  const BASE = new URL('.', location.href).href;
  const NO_AI = '파일로 연 화면이라 루브릭 채점만 써요';
  const MISSING = '얼굴 인식을 준비하지 못했어요. 모델 파일이 빠져 있어요. 압축을 다시 풀거나 로컬 서버로 열어 주세요.';
  const ASSET_SCRIPTS = ['assets-face-api.js', 'assets-mediapipe.js', 'assets-face-mesh.js'];
  const assets = Object.create(null);
  const blobUrls = Object.create(null);
  const misses = [];
  const served = [];
  const failed = [];

  // dist 폴더 기준 상대 경로. dist 밖이거나 파일 주소가 아니면 null.
  const relPath = url => {
    try {
      const u = new URL(String(url), location.href);
      if (u.protocol !== 'file:') return null;
      u.hash = '';
      u.search = '';
      return u.href.startsWith(BASE) ? decodeURIComponent(u.href.slice(BASE.length)) : null;
    } catch {
      return null;
    }
  };

  const blobUrl = path => {
    if (!blobUrls[path]) {
      const a = assets[path];
      const bin = atob(a.b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      a.b64 = '';
      blobUrls[path] = URL.createObjectURL(new Blob([bytes], { type: a.type }));
      served.push(path);
    }
    return blobUrls[path];
  };

  // 담아 둔 파일이면 Blob 주소, 아니면 null. 담지 않은 로컬 파일 요청은 misses에 남긴다.
  const assetUrl = url => {
    const p = relPath(url);
    if (p === null) return null;
    if (assets[p]) return blobUrl(p);
    misses.push(p);
    return null;
  };

  window.LT_FILE_MODE = {
    misses,
    served,
    failed,
    add(path, type, sha256, b64) {
      assets[path] = { type, sha256, b64 };
    },
    importMap(path) {
      const s = document.createElement('script');
      s.type = 'importmap';
      s.textContent = JSON.stringify({ imports: { [new URL(path, BASE).href]: blobUrl(path) } });
      document.head.append(s);
    },
  };

  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input && input.url;
    const p = url == null ? null : relPath(url);
    if (p === 'api/grade' || p === 'api/grader') {
      return Promise.resolve(new Response(JSON.stringify({ error: 'unavailable', configured: false, message: NO_AI }), {
        status: 503,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }));
    }
    const b = url == null ? null : assetUrl(url);
    return b ? origFetch(b) : origFetch(input, init);
  };

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    return origOpen.call(this, method, assetUrl(url) ?? url, ...rest);
  };

  // file://의 스크립트를 crossorigin으로 읽으면 CORS로 막힌다. 로컬 스크립트에서는 이 속성을 떼어 낸다.
  const isLocalScript = el => {
    const s = el.getAttribute('src');
    if (!s) return false;
    try {
      return new URL(s, location.href).protocol === 'file:';
    } catch {
      return false;
    }
  };
  const crossOrigin = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'crossOrigin');
  Object.defineProperty(HTMLScriptElement.prototype, 'crossOrigin', {
    ...crossOrigin,
    set(v) {
      if (!isLocalScript(this)) crossOrigin.set.call(this, v);
    },
  });
  const src = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
  Object.defineProperty(HTMLScriptElement.prototype, 'src', {
    ...src,
    set(v) {
      src.set.call(this, v);
      if (isLocalScript(this)) this.removeAttribute('crossorigin');
    },
  });
  const origSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) {
    if (!(this instanceof HTMLScriptElement)) return origSetAttribute.call(this, name, value);
    const n = String(name).toLowerCase();
    if (n === 'crossorigin' && isLocalScript(this)) return;
    origSetAttribute.call(this, name, value);
    if (n === 'src' && isLocalScript(this)) this.removeAttribute('crossorigin');
  };

  // 모델 파일 묶음은 앱 스크립트보다 먼저, 차례대로 읽는다. 읽지 못하면 failed에 남긴다.
  for (const f of ASSET_SCRIPTS) {
    document.write('<script src="file-mode/' + f + '" onerror="LT_FILE_MODE.failed.push(\'' + f + '\')"><\/script>');
  }

  // 모델 파일이 빠졌으면 카메라 준비 실패 안내(facepass.js fpCameraError의 마지막 문장)를 바꾼다.
  // 카메라 권한·장치 오류 안내는 그대로 둔다. gaze.js는 이 문장의 '얼굴 인식을'을 '시선 추적을'로 바꿔 쓴다.
  window.addEventListener('DOMContentLoaded', () => {
    const orig = window.fpCameraError;
    if (typeof orig !== 'function') return;
    window.fpCameraError = err => {
      const msg = orig(err);
      return (failed.length || misses.length) && msg.includes('새로고침') ? MISSING : msg;
    };
  });
})();
