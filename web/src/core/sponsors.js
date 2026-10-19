// SPONSORLUK — kurgusal markalarla sözleşmeler. Marka imajın = Sponsor ilişkin (player.rel.sponsor).
//   Teklif: ünün ve imajın yetince markalar gelir (menajerin sponsor çarpanı ücreti artırır).
//   Sözleşme: haftalık ücret, gol primi, süre, zorunlu reklam çekimi sayısı, marka avantajı (maça etkisi olanlar dahil).
//   Çekimi yapmazsan ceza ve imaj kaybı; imajın marka eşiğinin çok altına düşerse sözleşme feshedilir.
//   Reklam çekimi bir mini oyundur (games/shoot.js): başarı ücret primi, imaj ve ün getirir.
// Tüm markalar kurgusaldır.
import { clamp, roundTo, seeded } from './rng.js';
import { changeEnergy, changeFame, changeRel } from './player.js';
import { agentSponsorMult, currentAgent } from './agent.js';

/** @typedef {{id:string,name:string,cat:string,catName:string,minFame:number,minRel:number,base:number,perGoal:number,color:string,ink:string,logo:string,perk:string,perkText:string,desc:string,product:string}} Brand */
/** @type {Brand[]} */
export const BRANDS = [
  { id: 'durum', name: 'Dürüm Usta', cat: 'food', catName: 'Yiyecek', minFame: 15, minRel: 20, base: 160, perGoal: 60, color: '#dc2626', ink: '#fde68a', logo: 'DÜRÜM USTA', product: 'wrap', perk: 'fans', perkText: 'Taraftar ilişkisi her hafta +0,4', desc: 'Mahalle mahalle büyüyen dürüm zinciri. Herkesin sevdiği bir yüz arıyor.' },
  { id: 'volta', name: 'Volta Sport', cat: 'gear', catName: 'Spor giyim', minFame: 20, minRel: 30, base: 260, perGoal: 150, color: '#f97316', ink: '#111827', logo: 'VOLTA', product: 'boot', perk: 'boots', perkText: 'Volta krampon: şut ve çalım anlarında +%2', desc: 'Genç ve hızlı büyüyen spor markası. Kramponunu senin ayağında görmek istiyor.' },
  { id: 'simsek', name: 'Şimşek Enerji', cat: 'drink', catName: 'İçecek', minFame: 22, minRel: 30, base: 220, perGoal: 90, color: '#facc15', ink: '#111827', logo: 'ŞİMŞEK', product: 'can', perk: 'energy', perkText: 'Spor içeceği ve beslenme desteği: her hafta +3 enerji', desc: 'Enerji ve spor içecekleri. Sahada yorulmayan bir yüz arıyor.' },
  { id: 'nova', name: 'Nova Kozmetik', cat: 'beauty', catName: 'Kozmetik', minFame: 30, minRel: 42, base: 380, perGoal: 0, color: '#ec4899', ink: '#fff', logo: 'NOVA', product: 'bottle', perk: 'fame', perkText: 'Reklam filmleri: her hafta ün +0,2', desc: 'Şampuan ve bakım ürünleri. Kamera önünde rahat birini istiyor.' },
  { id: 'piksel', name: 'Piksel Telekom', cat: 'tech', catName: 'Teknoloji', minFame: 35, minRel: 40, base: 450, perGoal: 120, color: '#7c3aed', ink: '#fff', logo: 'PİKSEL', product: 'phone', perk: 'followers', perkText: 'Chirp takipçi artışı ×1,3', desc: 'Telefon ve internet. Stadyum reklam panolarında yüzün olacak.' },
  { id: 'kronos', name: 'Kronos Saat', cat: 'luxury', catName: 'Lüks', minFame: 50, minRel: 55, base: 900, perGoal: 0, color: '#0f172a', ink: '#fbbf24', logo: 'KRONOS', product: 'watch', perk: 'fame', perkText: 'Prestij: her hafta ün +0,3', desc: 'İsviçre ruhlu saat markası. Sadece yıldızlarla çalışır.' },
  { id: 'ruzgar', name: 'Rüzgar Otomotiv', cat: 'auto', catName: 'Otomobil', minFame: 60, minRel: 55, base: 1400, perGoal: 0, color: '#0369a1', ink: '#fff', logo: 'RÜZGAR', product: 'key', perk: 'morale', perkText: 'Makam aracı: her hafta moral +2', desc: 'Elektrikli otomobil üreticisi. Reklam yüzü olarak bir şampiyon arıyor.' },
];
export const BRAND_BY_ID = Object.fromEntries(BRANDS.map((b) => [b.id, b]));
export const SPONSOR_RULES = { maxActive: 3, offerWeeks: 3, shootsPerContract: 2 };

export function ensureSponsors(state) {
  const sp = state.sponsors || (state.sponsors = {});
  sp.active ||= [];
  sp.offers ||= [];
  sp.history ||= [];
  sp.log ||= [];
  sp.earned ||= 0;
  sp.shoots ||= 0;
  return sp;
}

const relOf = (state) => state.player?.rel?.sponsor ?? 30;
const hashStr = (str) => {
  let h = 2166136261;
  for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
/** Sponsor zarları kendi tohumuyla (oyunun rastgele akışını bozmaz) */
const rngFor = (state, tag) => seeded(hashStr(`${state.player?.name}|${state.calendar?.season}|${state.calendar?.week}|${tag}`));
const weekNo = (state) => (state.calendar?.season || 1) * 100 + (state.calendar?.week || 1);

/** Haftalık ücret: marka tabanı × ün × imaj × menajer çarpanı */
export function feeFor(state, brand) {
  const fame = state.player?.fame || 0;
  const rel = relOf(state);
  return roundTo(brand.base * (1 + fame / 60) * (0.7 + rel / 120) * agentSponsorMult(state), 50);
}

export function eligibleBrands(state) {
  const sp = ensureSponsors(state);
  const fame = state.player?.fame || 0;
  const rel = relOf(state);
  const taken = new Set([...sp.active.map((c) => BRAND_BY_ID[c.brandId]?.cat), ...sp.offers.map((o) => BRAND_BY_ID[o.brandId]?.cat)]);
  return BRANDS.filter((b) => fame >= b.minFame && rel >= b.minRel - 8 && !taken.has(b.cat));
}

function makeOffer(state, brand) {
  const R = rngFor(state, `offer-${brand.id}`);
  const weeks = 16 + Math.floor(R() * 15);
  return {
    brandId: brand.id, weekly: feeFor(state, brand), weeks, perGoal: roundTo(brand.perGoal * (1 + (state.player?.fame || 0) / 100), 10),
    shootsReq: SPONSOR_RULES.shootsPerContract, signBonus: roundTo(feeFor(state, brand) * 2, 50), expires: weekNo(state) + SPONSOR_RULES.offerWeeks,
  };
}

/** Menajerin teklif yorumu */
export function offerAdvice(state, offer) {
  const ag = currentAgent(state);
  const b = BRAND_BY_ID[offer.brandId];
  const rel = relOf(state);
  const tight = rel < b.minRel;
  const who = ag.id === 'self' ? 'İç sesin' : ag.name.split(' ')[0];
  if (tight) return `${who}: "İmajın bu markanın beklentisinin biraz altında. İmzalarsan çekimleri aksatma, yoksa fesih riski var."`;
  if (b.cat === 'food') return `${who}: "Küçük ama sıcak bir anlaşma. Taraftar seni daha çok sever."`;
  if (b.perk === 'boots' || b.perk === 'energy') return `${who}: "Hem para hem sahaya katkı. Bence kaçırma."`;
  return `${who}: "Haftada ${offer.weekly.toLocaleString('tr-TR')} € iyi para. ${offer.shootsReq} çekim zorunlu, takvimine yaz."`;
}

export function acceptOffer(state, brandId) {
  const sp = ensureSponsors(state);
  const i = sp.offers.findIndex((o) => o.brandId === brandId);
  if (i < 0) return { ok: false, text: 'Teklif bulunamadı.' };
  if (sp.active.length >= SPONSOR_RULES.maxActive) return { ok: false, text: `Aynı anda en fazla ${SPONSOR_RULES.maxActive} sponsorun olabilir.` };
  const o = sp.offers.splice(i, 1)[0];
  const c = { ...o, weeksLeft: o.weeks, shootsDone: 0, since: weekNo(state), goalsPaid: 0, paid: 0 };
  delete c.expires;
  sp.active.push(c);
  state.career.money += o.signBonus;
  sp.earned += o.signBonus;
  changeRel(state.player, 'sponsor', 3);
  log(state, `${BRAND_BY_ID[brandId].name} ile ${o.weeks} haftalık sözleşme imzaladın (imza primi ${o.signBonus.toLocaleString('tr-TR')} €).`);
  return { ok: true, contract: c };
}

export function declineOffer(state, brandId) {
  const sp = ensureSponsors(state);
  sp.offers = sp.offers.filter((o) => o.brandId !== brandId);
  return { ok: true };
}

function log(state, text) {
  const sp = ensureSponsors(state);
  sp.log.unshift({ s: state.calendar?.season, w: state.calendar?.week, text });
  if (sp.log.length > 14) sp.log.length = 14;
}

/** Bu hafta çekim yapılabilir mi: sözleşmeli (bekleyen çekim) ya da yerel tek seferlik iş */
export function canShoot(state) {
  const p = state.player;
  if (state.calendar.phase !== 'week') return { ok: false, reason: 'Sezon arası.' };
  if (state.calendar.slots <= 0) return { ok: false, reason: 'Bu haftaki tüm zamanını kullandın.' };
  if ((p.fame || 0) < 20 && !ensureSponsors(state).active.length) return { ok: false, reason: 'Reklam çekimi için ünün 20 olmalı.' };
  if (p.energy < 12) return { ok: false, reason: 'Çok yorgunsun.' };
  return { ok: true };
}

/** Çekim seçenekleri: sözleşmeli markalar (önce bekleyen çekimi olanlar) + yerel iş */
export function shootOptions(state) {
  const sp = ensureSponsors(state);
  const list = sp.active.map((c) => ({ kind: 'brand', brandId: c.brandId, pending: c.shootsDone < c.shootsReq, fee: shootFee(state, BRAND_BY_ID[c.brandId], 1) }));
  list.sort((a, b) => Number(b.pending) - Number(a.pending));
  if ((state.player.fame || 0) >= 20) list.push({ kind: 'local', brandId: null, pending: false, fee: localFee(state, 1) });
  return list;
}

// sözleşmeli marka çekimi her zaman yerel işten daha iyi öder
const shootFee = (state, brand, q) => roundTo(brand.base * 4 * (1 + (state.player.fame || 0) / 80) * (0.5 + q) * agentSponsorMult(state), 50);
const localFee = (state, q) => roundTo((100 + (state.player.fame || 0) * 30) * (0.6 + relOf(state) / 100) * agentSponsorMult(state) * (0.6 + q * 0.6), 50);

/**
 * Çekimi bitirir. q: mini oyun başarısı (0–1). brandId: null → yerel tek seferlik reklam
 * @returns {{ok:boolean, text?:string, money:number, rel:number, fame:number, brand?:Brand}}
 */
export function finishShoot(state, brandId, q) {
  const chk = canShoot(state);
  if (!chk.ok) return { ok: false, text: chk.reason };
  const sp = ensureSponsors(state);
  q = clamp(q, 0, 1);
  const p = state.player;
  let money = 0;
  let brand = null;
  if (brandId) {
    brand = BRAND_BY_ID[brandId];
    const c = sp.active.find((x) => x.brandId === brandId);
    if (!brand || !c) return { ok: false, text: 'Bu markayla sözleşmen yok.' };
    money = shootFee(state, brand, q);
    c.shootsDone += 1;
  } else money = localFee(state, q);
  const rel = q >= 0.75 ? 4 : q >= 0.45 ? 2 : q >= 0.25 ? 0 : -2;
  const fame = q >= 0.6 ? 0.8 : 0.3;
  state.career.money += money;
  sp.earned += money;
  sp.shoots += 1;
  changeRel(p, 'sponsor', rel);
  changeFame(p, fame);
  changeEnergy(p, -12);
  state.calendar.slots -= 1;
  log(state, `${brand ? brand.name : 'Yerel reklam'} çekimi: başarı %${Math.round(q * 100)}, ${money.toLocaleString('tr-TR')} €.`);
  return { ok: true, money, rel, fame, brand };
}

/** Maç: gol primleri; maçın oyuncusu imajı parlatır; kırmızı kart imajı zedeler */
export function sponsorsOnMatch(state, summary) {
  const sp = ensureSponsors(state);
  let bonus = 0;
  if (summary?.goals) for (const c of sp.active) { const b = (c.perGoal || 0) * summary.goals; bonus += b; c.goalsPaid += b; }
  if (bonus) { state.career.money += bonus; sp.earned += bonus; }
  if (summary?.motm) changeRel(state.player, 'sponsor', 1);
  if (summary?.red) changeRel(state.player, 'sponsor', -4);
  return bonus;
}

/** Maçta etkin yetenek çarpanı: sponsor kramponu */
export function sponsorSkillMult(state, type) {
  const has = (state?.sponsors?.active || []).some((c) => BRAND_BY_ID[c.brandId]?.perk === 'boots');
  return has && (type === 'shot' || type === 'dribble' || type === 'attack') ? 1.02 : 1;
}

/** Chirp takipçi çarpanı */
export const sponsorFollowerMult = (state) => ((state?.sponsors?.active || []).some((c) => BRAND_BY_ID[c.brandId]?.perk === 'followers') ? 1.3 : 1);

/**
 * Hafta sonu: ücretler, avantajlar, süre, çekim yükümlülüğü, fesih, yeni teklifler.
 * @returns {{income:number, news:{text:string,kind:string}[], energy:number}}
 */
export function sponsorsOnWeek(state) {
  const sp = ensureSponsors(state);
  const p = state.player;
  const news = [];
  let income = 0;
  let energy = 0;
  const now = weekNo(state);
  for (const c of sp.active) {
    const b = BRAND_BY_ID[c.brandId];
    income += c.weekly;
    c.paid += c.weekly;
    c.weeksLeft -= 1;
    if (b.perk === 'energy') energy += 3;
    if (b.perk === 'fans') changeRel(p, 'fans', 0.4);
    if (b.perk === 'fame') changeFame(p, b.id === 'kronos' ? 0.3 : 0.2);
    if (b.perk === 'morale') p.morale = Math.min(100, p.morale + 2);
  }
  state.career.money += income;
  sp.earned += income;
  // fesih: imaj marka eşiğinin çok altında
  for (const c of sp.active.slice()) {
    const b = BRAND_BY_ID[c.brandId];
    if (relOf(state) < b.minRel - 15) {
      sp.active = sp.active.filter((x) => x !== c);
      sp.history.unshift({ brandId: c.brandId, end: 'fesih', s: state.calendar.season });
      changeRel(p, 'sponsor', -3);
      news.push({ text: `${b.name} sözleşmeni feshetti: "Marka değerlerimizle uyuşmuyor." İmajını toparlaman lazım.`, kind: 'bad' });
      log(state, `${b.name} sözleşmeyi feshetti.`);
    }
  }
  // süre doldu
  for (const c of sp.active.slice()) {
    if (c.weeksLeft > 0) continue;
    const b = BRAND_BY_ID[c.brandId];
    sp.active = sp.active.filter((x) => x !== c);
    const missed = Math.max(0, c.shootsReq - c.shootsDone);
    if (missed) {
      const pen = roundTo(c.weekly * 2 * missed, 50);
      state.career.money -= pen;
      changeRel(p, 'sponsor', -6 * missed);
      news.push({ text: `${b.name} sözleşmesi bitti: ${missed} çekimi yapmadığın için ${pen.toLocaleString('tr-TR')} € ceza ödedin, imajın zedelendi.`, kind: 'bad' });
      sp.history.unshift({ brandId: c.brandId, end: 'ceza', s: state.calendar.season });
    } else {
      sp.history.unshift({ brandId: c.brandId, end: 'tamam', s: state.calendar.season });
      // yenileme teklifi (daha iyi şartlarla)
      if (relOf(state) >= b.minRel - 5 && sp.offers.length < 3) {
        const o = makeOffer(state, b);
        o.weekly = roundTo(Math.max(o.weekly, c.weekly * 1.12), 50);
        o.renewal = true;
        sp.offers.push(o);
        news.push({ text: `${b.name} sözleşmen bitti ve yenilemek istiyorlar: haftalık ${o.weekly.toLocaleString('tr-TR')} €.`, kind: 'good' });
      } else news.push({ text: `${b.name} sözleşmen sona erdi.`, kind: 'info' });
    }
  }
  // bekleyen çekim hatırlatması (son 4 hafta)
  for (const c of sp.active) if (c.weeksLeft === 4 && c.shootsDone < c.shootsReq) news.push({ text: `${BRAND_BY_ID[c.brandId].name}: sözleşmenin bitmesine 4 hafta var, ${c.shootsReq - c.shootsDone} çekim bekliyor.`, kind: 'info' });
  if (sp.history.length > 20) sp.history.length = 20;
  // teklifler: süresi geçenler düşer, yenisi gelebilir
  sp.offers = sp.offers.filter((o) => o.expires >= now);
  const fame = p.fame || 0;
  const R = rngFor(state, 'week');
  if (sp.active.length + sp.offers.length < SPONSOR_RULES.maxActive + 1 && R() < 0.12 + fame / 260 + (relOf(state) - 30) / 400) {
    const pool = eligibleBrands(state);
    if (pool.length) {
      // ünlüysen büyük markalar öne çıkar
      const top = pool.sort((a, b) => b.base - a.base).slice(0, Math.min(3, pool.length));
      const brand = top[Math.floor(R() * top.length)];
      sp.offers.push(makeOffer(state, brand));
      news.push({ text: `${brand.name} sana sponsorluk teklif etti! (Sponsorlar ekranı)`, kind: 'good' });
    }
  }
  return { income, news, energy };
}
