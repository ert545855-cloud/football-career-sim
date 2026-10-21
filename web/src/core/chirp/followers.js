// @ts-check
// TAKİPÇİ MODELİ — takipçi sayısı oyuncunun yükselişini izler. Kariyerin (güç, oynadığın lig ve kulüp, ün,
// kupalar, milli forma, sezon formu, Altın Top) bir "yükseliş" puanı (0–1) verir; puan logaritmik bir hedef
// takipçi sayısına çevrilir (yeni başlayan ~1 bin, ligin yıldızı ~yüz binler, dünya yıldızı on milyonlar).
// Takipçi her hafta hedefe doğru yaklaşır; iyi maçlar, fotoğraflı paylaşımlar ve gündem anlık sıçrama yaratır.
import { CLUB_BY_ID } from '../data.js';
import { clubRating, leagueIdIn, leaguePrestige } from '../league.js';
import { ovr } from '../player.js';
import { clamp } from '../rng.js';
import { sponsorFollowerMult } from '../sponsors.js';
import { ensureChirp } from './timeline.js';

/** state.chirp (ensureChirp her çağrıda nesneyi yeniden kurar; aynı nesne üzerinde çalışmak için bir kez) */
const chirpOf = (state) => state.chirp || ensureChirp(state);

/** Hedef eğrisi: R=0 → 500, R=0.5 → ~100 bin, R=0.8 → ~3 milyon, R=1 → ~20 milyon */
const BASE = 500;
const SPAN = 4.6;
/** Takipçi kilometre taşları (haber + bildirim) */
export const FOLLOWER_MILESTONES = [1_000, 10_000, 50_000, 100_000, 500_000, 1_000_000, 5_000_000, 10_000_000, 50_000_000, 100_000_000];
/** Bu sayıdan sonra hesap "onaylı" (mavi tik) */
export const VERIFIED_AT = 100_000;
const HISTORY_CAP = 80;

const MAX_PRESTIGE = 1.25;

/**
 * Yükseliş bileşenleri (0–1) ve ağırlıkları. UI "Popülerliğini ne belirliyor?" kartında gösterir.
 * @returns {{key:string, label:string, value:number, weight:number}[]}
 */
export function riseFactors(state) {
  const p = state.player || {};
  const c = state.career || {};
  const lid = state.world ? leagueIdIn(state.world, c.clubId) : CLUB_BY_ID[c.clubId]?.league;
  const prestige = clamp(leaguePrestige(lid) / MAX_PRESTIGE, 0, 1);
  const club = clamp((clubRating(state.world, c.clubId) - 30) / 60, 0, 1);
  const awards = c.awards || [];
  const trophies = awards.filter((a) => a.icon === 'trophy').length;
  const honours = clamp(Math.log1p(trophies * 3 + awards.length) / Math.log1p(150), 0, 1);
  const caps = state.national?.caps || { U19: 0, U21: 0, A: 0 };
  const nat = caps.A > 0 ? clamp(0.45 + caps.A / 70, 0, 1) : caps.U21 > 0 ? 0.18 : caps.U19 > 0 ? 0.08 : 0;
  const se = c.season || {};
  const apps = se.apps || 0;
  const form = apps ? clamp(((se.goals || 0) + (se.assists || 0) * 0.7) / apps / 0.9, 0, 1) * clamp(apps / 8, 0, 1) : 0;
  return [
    { key: 'ovr', label: 'Gücün (OVR)', value: clamp((ovr(p) - 35) / 55, 0, 1), weight: 0.3 },
    { key: 'stage', label: 'Lig ve kulüp', value: prestige * 0.7 + club * 0.3, weight: 0.2 },
    { key: 'fame', label: 'Ün', value: clamp((p.fame || 0) / 100, 0, 1), weight: 0.14 },
    { key: 'honours', label: 'Kupalar ve ödüller', value: honours, weight: 0.14 },
    { key: 'national', label: 'Milli takım', value: nat, weight: 0.12 },
    { key: 'form', label: 'Sezon formu', value: form, weight: 0.1 },
  ];
}

/** Altın Top: kazanan dünya çapında patlar, kürsü ve ilk 10 da büyütür */
function ballonMult(state) {
  const h = state.ballon?.history || [];
  if (!h.length) return 1;
  const best = Math.min(...h.map((x) => x.rank || 99));
  const wins = h.filter((x) => x.rank === 1).length;
  if (wins) return 3 + Math.min(2, wins - 1) * 0.5;
  return best <= 3 ? 1.8 : best <= 10 ? 1.3 : 1;
}

/** Yükseliş puanı 0–1 */
export function riseScore(state) {
  const f = riseFactors(state);
  return clamp(f.reduce((n, x) => n + x.value * x.weight, 0), 0, 1);
}

/** Kariyerine göre olması gereken takipçi sayısı */
export function followerTarget(state) {
  const R = riseScore(state);
  return Math.round(BASE * 10 ** (SPAN * R) * ballonMult(state) * sponsorFollowerMult(state));
}

/** Takipçi → 0–100 popülerlik (logaritmik; 1 milyon ≈ 75) */
export const popularityOf = (followers) => clamp(Math.round(((Math.log10(Math.max(100, followers)) - 2) / 6) * 100), 0, 100);

/** Takipçi değişimini uygular, kilometre taşlarını döndürür */
function setFollowers(state, next) {
  const ch = chirpOf(state);
  const before = ch.followers || 0;
  ch.followers = Math.max(0, Math.round(next));
  const hit = FOLLOWER_MILESTONES.filter((m) => before < m && ch.followers >= m);
  if (hit.length) {
    ch.milestones = [...new Set([...(ch.milestones || []), ...hit])];
    if (ch.followers >= VERIFIED_AT) ch.verified = true;
  }
  return hit;
}

/**
 * Haftalık güncelleme (hafta sonu): hedefin altındaysa hızla yaklaşır, çok üstündeyse yavaşça geriler.
 * @param {() => number} [rnd]
 * @returns {{followers:number, delta:number, target:number, milestones:number[]}}
 */
export function followersOnWeek(state, rnd = Math.random) {
  const ch = chirpOf(state);
  const target = followerTarget(state);
  const f = ch.followers || 0;
  let next = f;
  if (f < target) next = f + (target - f) * (0.07 + rnd() * 0.03) + 3;
  else if (f > target * 1.5) next = f - (f - target * 1.5) * 0.006; // hedefin çok üstü: çok yavaş geriler
  next *= 1 + (rnd() - 0.45) * 0.004; // gündelik dalgalanma
  const milestones = setFollowers(state, next);
  ch.target = target;
  const h = ch.followerHistory || (ch.followerHistory = []);
  const key = `${state.calendar?.season || 1}-${state.calendar?.week || 1}`;
  if (h.at(-1)?.k === key) h[h.length - 1].f = ch.followers;
  else h.push({ k: key, s: state.calendar?.season || 1, w: state.calendar?.week || 1, f: ch.followers });
  if (h.length > HISTORY_CAP) h.splice(0, h.length - HISTORY_CAP);
  return { followers: ch.followers, delta: ch.followers - f, target, milestones };
}

/**
 * Maç sonrası sıçrama: gol, asist ve yüksek not takipçi getirir; büyük maçta etkisi büyür.
 * @returns {{delta:number, milestones:number[]}}
 */
export function followersOnMatch(state, summary, match = null) {
  const ch = chirpOf(state);
  if (!summary?.played) return { delta: 0, milestones: [] };
  const target = Math.max(ch.followers || 0, followerTarget(state));
  const perf = (summary.goals || 0) * 1.4 + (summary.assists || 0) * 0.8 + Math.max(0, (summary.rating || 6) - 6.5) * 0.6 + (summary.motm ? 0.6 : 0) - (summary.red ? 1 : 0);
  if (perf <= 0) return { delta: 0, milestones: [] };
  const big = match?.big ? 1.6 : 1;
  const hat = (summary.goals || 0) >= 3 ? 2 : 1;
  const delta = Math.round(target * 0.0035 * perf * big * hat + 15 * perf);
  const before = ch.followers || 0;
  const milestones = setFollowers(state, before + delta);
  return { delta: ch.followers - before, milestones };
}

/** Kilometre taşı metni: 1000 → "1 bin", 1_000_000 → "1 milyon" */
export function milestoneLabel(n) {
  if (n >= 1_000_000) return `${n / 1_000_000} milyon`;
  return `${n / 1000} bin`;
}

/** Hesabın onaylı (mavi tik) olup olmadığı */
export const isVerified = (state) => !!state.chirp?.verified || (state.chirp?.followers || 0) >= VERIFIED_AT;
