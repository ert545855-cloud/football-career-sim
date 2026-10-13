// BULUT KAYIT ARAYÜZÜ — ayarlar bölümü, PIN/kod pencereleri, "bulutta daha yeni kayıt var" uyarısı.
import { CLUB_BY_ID } from '../core/data.js';
import { migrate } from '../core/storage.js';
import {
  cloudAvailable, cloudConnect, cloudCreate, cloudDelete, cloudDownload, cloudLink, cloudMeta, cloudSummaryText, cloudUnlink, cloudUpload,
} from '../cloud.js';
import { sfx } from '../audio.js';
import { icon } from './art.js';
import { esc, sheet, toast } from './dom.js';

const clubName = (id) => CLUB_BY_ID[id]?.name || id;
const ago = (t) => {
  if (!t) return 'henüz eşitlenmedi';
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'az önce' : m < 60 ? `${m} dk önce` : m < 1440 ? `${Math.round(m / 60)} sa önce` : `${Math.round(m / 1440)} gün önce`;
};

/** Ayarlar ekranındaki yer tutucu; mountCloudSection doldurur */
export const cloudSectionPlaceholder = '<div data-cloud></div>';

export async function mountCloudSection(app, node) {
  const host = node.querySelector('[data-cloud]');
  if (!host) return;
  const ok = await cloudAvailable();
  if (!ok || !host.isConnected) return;
  const l = cloudLink();
  host.innerHTML = l
    ? `<div class="h-sec">Bulut kayıt <span class="chip good">Bağlı</span></div>
      <div class="card" style="display:grid;gap:10px">
        <div class="row between"><div><div class="muted small">Bulut kodun</div><b class="cloud-code">${esc(l.code)}</b></div><button class="btn sm ghost" data-cloud-act="copy">${icon('share')} Kopyala</button></div>
        <div class="muted small">Son eşitleme: ${ago(l.syncedAt)} · sürüm ${l.rev}. Kayıtların otomatik olarak buluta gider. Başka cihazda bu kod ve PIN'inle devam edebilirsin.</div>
        ${l.conflict ? `<div class="cloud-conflict"><b>${icon('cloud', 'ico sm')} Bulutta daha yeni bir kayıt var</b><div class="small">${esc(cloudSummaryText(l.conflict.summary, clubName(l.conflict.summary?.clubId)))}</div><div class="offer-btns"><button class="btn block" data-cloud-act="download">Buluttakini indir</button><button class="btn primary block" data-cloud-act="force">Bu cihazdakini yükle</button></div></div>` : ''}
        <div class="offer-btns"><button class="btn block" data-cloud-act="sync" ${app.state ? '' : 'disabled'}>${icon('upload')} Şimdi yükle</button><button class="btn block" data-cloud-act="download">${icon('download')} Buluttan indir</button></div>
        <div class="offer-btns"><button class="btn ghost block" data-cloud-act="unlink">Bağlantıyı kaldır</button><button class="btn ghost block" data-cloud-act="delete" style="color:var(--bad)">Hesabı sil</button></div>
      </div>`
    : `<div class="h-sec">Bulut kayıt</div>
      <div class="card" style="display:grid;gap:10px">
        <p class="small" style="margin:0">Kariyerini buluta yedekle; telefonun değişse de kaldığın yerden devam et. E-posta gerekmez: bir PIN belirlersin, sana bir kod verilir.</p>
        <button class="btn primary block" data-cloud-act="create">${icon('cloud')} Bulut hesabı oluştur</button>
        <button class="btn block" data-cloud-act="connect">${icon('download')} Başka cihazdaki kayda bağlan</button>
      </div>`;
  host.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-cloud-act]');
    if (!b || b.disabled) return;
    app.click();
    try {
      await cloudAction(app, b.dataset.cloudAct);
    } catch (err) {
      toast(err.message || 'Bir hata oluştu.', 'bad');
      sfx('error');
    }
    if (app.current === 'settings') app.go('settings');
  });
}

function pinSheet(title, lead, { withCode = false } = {}) {
  return sheet({
    center: true,
    html: `<h3>${esc(title)}</h3><p class="lead">${esc(lead)}</p>
      ${withCode ? '<input class="field" data-code placeholder="Kod (ör. ABCD-EFGH)" autocomplete="off" autocapitalize="characters" maxlength="9" style="text-transform:uppercase;letter-spacing:.12em">' : ''}
      <input class="field" data-pin type="password" inputmode="numeric" pattern="[0-9]*" placeholder="PIN (4–6 rakam)" maxlength="6" autocomplete="off" style="margin-top:8px;letter-spacing:.3em">
      <p class="small" data-err style="color:var(--bad);min-height:1.2em;margin:6px 0 0"></p>
      <div class="stack" style="margin-top:8px"><button class="btn primary block" data-ok>Devam</button><button class="btn ghost block" data-close="cancel">Vazgeç</button></div>`,
    onMount: (n, close) => {
      const pin = n.querySelector('[data-pin]');
      const code = n.querySelector('[data-code]');
      (code || pin).focus();
      n.querySelector('[data-ok]').addEventListener('click', () => {
        if (!/^\d{4,6}$/.test(pin.value)) {
          n.querySelector('[data-err]').textContent = 'PIN 4–6 rakam olmalı.';
          return;
        }
        if (code && code.value.replace(/[^a-z0-9]/gi, '').length !== 8) {
          n.querySelector('[data-err]').textContent = 'Kod 8 karakter olmalı.';
          return;
        }
        close({ pin: pin.value, code: code?.value || null });
      });
    },
  }).then((v) => (v && typeof v === 'object' ? v : null));
}

async function applyDownloaded(app, r) {
  const st = migrate(r.state);
  if (!st) throw new Error('Buluttaki kayıt okunamadı.');
  app.state = st;
  app.save();
  toast('Buluttaki kariyer yüklendi!', 'good');
  sfx('levelup');
  app.resume();
}

async function cloudAction(app, act) {
  const l = cloudLink();
  if (act === 'create') {
    const v = await pinSheet('Bulut hesabı', 'Bir PIN belirle. Başka cihazdan bağlanırken kodun ve bu PIN gerekir. PIN\'i unutma; e-posta ile sıfırlanamaz.');
    if (!v) return;
    const link = await cloudCreate(v.pin, app.state);
    sfx('coin');
    await sheet({
      center: true,
      html: `<div class="center"><span class="chip good">${icon('check', 'ico xs')} Bulut hesabın hazır</span></div><p class="lead center" style="margin-top:10px">Bu kodu bir yere not et:</p><div class="cloud-code big center">${esc(link.code)}</div><p class="muted small center">Başka cihazda: Ayarlar → Bulut kayıt → Başka cihazdaki kayda bağlan → kod + PIN.</p><button class="btn primary block" style="margin-top:12px" data-close>Tamam</button>`,
    });
  } else if (act === 'connect') {
    const v = await pinSheet('Kayda bağlan', 'Diğer cihazda gördüğün bulut kodunu ve PIN\'ini yaz.', { withCode: true });
    if (!v) return;
    const r = await cloudConnect(v.code, v.pin);
    if (!r.rev) return toast('Bağlandın. Bulutta henüz kayıt yok; bu cihazdaki kariyer yüklenecek.', 'good');
    const ok = await app.confirm('Buluttaki kariyer', `${cloudSummaryText(r.summary, clubName(r.summary?.clubId))}. Bu cihaza indirilsin mi?${app.state ? ' Bu cihazdaki kariyerin yerini alır.' : ''}`, 'İndir');
    if (ok) await applyDownloaded(app, await cloudDownload());
  } else if (act === 'download') {
    const meta = await cloudMeta();
    if (!meta?.rev) return toast('Bulutta henüz kayıt yok.', 'bad');
    const ok = await app.confirm('Buluttan indir', `${cloudSummaryText(meta.summary, clubName(meta.summary?.clubId))}. Bu cihazdaki kariyerin yerini alır.`, 'İndir');
    if (ok) await applyDownloaded(app, await cloudDownload());
  } else if (act === 'sync' || act === 'force') {
    await cloudUpload(app.state, { force: act === 'force' });
    toast('Kariyer buluta yüklendi.', 'good');
    sfx('coin');
  } else if (act === 'copy') {
    try {
      await navigator.clipboard.writeText(l.code);
      toast('Kod kopyalandı.', 'good');
    } catch {
      await app.showText('Bulut kodun', l.code);
    }
  } else if (act === 'unlink') {
    if (await app.confirm('Bağlantıyı kaldır', 'Bu cihaz artık otomatik yüklemez. Buluttaki kayıt silinmez.', 'Kaldır')) await cloudUnlink();
  } else if (act === 'delete') {
    if (await app.confirm('Bulut hesabını sil', 'Buluttaki kayıt ve kod kalıcı olarak silinir. Bu cihazdaki kariyer kalır.', 'Sil')) await cloudDelete();
  }
}

/** Açılışta: bulutta bu cihazdan daha yeni bir kayıt varsa sor */
export async function checkCloudOnStart(app) {
  const l = cloudLink();
  if (!l || !(await cloudAvailable())) return;
  let meta;
  try {
    meta = await cloudMeta();
  } catch {
    return;
  }
  if (!meta || meta.rev <= l.rev) return;
  const ok = await app.confirm('Bulutta daha yeni kayıt', `Başka bir cihazda oynamışsın: ${cloudSummaryText(meta.summary, clubName(meta.summary?.clubId))}. İndirilsin mi?`, 'İndir');
  if (ok) await applyDownloaded(app, await cloudDownload());
}
