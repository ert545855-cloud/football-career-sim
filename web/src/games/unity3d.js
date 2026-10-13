// UNITY 3B KÖPRÜSÜ (web tarafı) — maçtaki pas/şut anlarını Unity WebGL derlemesinde oynatır.
//
// Derleme public/unity/Build/ altına konur (bkz. public/unity/README.md):
//   krampon.loader.js, krampon.data, krampon.framework.js, krampon.wasm
// Unity sahnesindeki FootballCareer.Bridge.WebBridge:
//   web → Unity: SendMessage('WebBridge', 'StartMoment', json)
//   Unity → web: window.KramponBridge.onReady() / onResult(json)  (Plugins/WebGL/KramponBridge.jslib)
// Unity bir kez yüklenir ve sonraki anlarda yeniden kullanılır (gizli tutulur).

const BASE = './unity/Build/';
const NAME = 'krampon';

let available = null;
let boot = null;

/** Derleme sunucuda var mı? (oturum boyunca önbelleklenir) */
export function unityBuildAvailable() {
  if (available) return available;
  available = fetch(`${BASE}${NAME}.loader.js`, { method: 'HEAD', cache: 'no-store' })
    .then((r) => r.ok && !(r.headers.get('content-type') || '').includes('text/html'))
    .catch(() => false);
  return available;
}

function loadScript(src) {
  return new Promise((res, rej) => {
    if (window.createUnityInstance) return res();
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => res();
    s.onerror = () => rej(new Error('Unity yükleyicisi alınamadı.'));
    document.head.appendChild(s);
  });
}

const bridge = () => (window.KramponBridge = window.KramponBridge || {});

/** Unity örneğini (bir kez) başlatır. onProgress(0–1) */
function ensureUnity(onProgress) {
  if (boot) return boot;
  boot = (async () => {
    await loadScript(`${BASE}${NAME}.loader.js`);
    const canvas = document.createElement('canvas');
    canvas.className = 'unity-canvas';
    canvas.tabIndex = -1;
    const parking = document.createElement('div');
    parking.className = 'unity-parking';
    parking.appendChild(canvas);
    document.body.appendChild(parking);
    const ready = new Promise((res) => {
      bridge().onReady = res;
    });
    const instance = await window.createUnityInstance(canvas, {
      dataUrl: `${BASE}${NAME}.data`,
      frameworkUrl: `${BASE}${NAME}.framework.js`,
      codeUrl: `${BASE}${NAME}.wasm`,
      streamingAssetsUrl: './unity/StreamingAssets',
      companyName: 'Krampon',
      productName: 'Krampon 3D',
      productVersion: '1.0',
      matchWebGLToCanvasSize: true,
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    }, (p) => onProgress?.(p));
    await ready;
    return { instance, canvas, parking };
  })().catch((e) => {
    boot = null;
    throw e;
  });
  return boot;
}

/**
 * Bir maç anını Unity'de oynatır.
 * @param {HTMLElement} host mini oyun sahnesi (canvas buraya taşınır)
 * @param {{type:'pass'|'shot', context:string, passing:number, shooting:number, speed:number, nerves?:number, keeper?:number, myColor?:string, oppColor?:string}} req
 * @param {(p:number)=>void} [onProgress]
 * @returns {Promise<{success:boolean, accuracy:number, outcome:string, curve:number}>}
 */
export async function playUnityMoment(host, req, onProgress) {
  const u = await ensureUnity(onProgress);
  host.appendChild(u.canvas);
  try {
    const result = await new Promise((res) => {
      bridge().onResult = (json) => {
        try {
          res(JSON.parse(json));
        } catch {
          res({ success: false, accuracy: 0, outcome: 'missed', curve: 0 });
        }
      };
      u.instance.SendMessage('WebBridge', 'StartMoment', JSON.stringify({ seed: Math.floor(Math.random() * 1e9), ...req }));
    });
    return result;
  } finally {
    bridge().onResult = null;
    u.parking.appendChild(u.canvas); // bir sonraki an için gizli bekler
  }
}
