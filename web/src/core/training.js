// ANTRENMAN — zorluk seviyesi, yıldız puanı ve rekorlar, hocanın yorumu, yorgunluk etkisi.
import { STAT_KEYS } from './data.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Zorluk: mini oyundaki etkin yetenek kaydırması ve gelişim çarpanı. */
export const DIFFICULTY = {
  easy: { id: 'easy', name: 'Kolay', skill: 0.15, gain: 0.75, desc: 'Daha rahat, gelişim ×0.75' },
  normal: { id: 'normal', name: 'Normal', skill: 0, gain: 1, desc: 'Standart antrenman' },
  hard: { id: 'hard', name: 'Zor', skill: -0.15, gain: 1.35, desc: 'Zorlu, başarırsan gelişim ×1.35' },
};
export const DIFF_IDS = ['easy', 'normal', 'hard'];

export function ensureTraining(state) {
  const t = (state.training ||= {});
  t.diff ||= 'normal';
  t.best ||= {};
  t.sessions ||= 0;
  t.log ||= [];
  return t;
}

export function trainingSkill(baseSkill, diff = 'normal') {
  return clamp(baseSkill + (DIFFICULTY[diff]?.skill || 0), 0.02, 1);
}

/** Yorgunluk: enerji düşükken antrenman verimi düşer. */
export function fatigueFactor(energy) {
  if (energy >= 50) return 1;
  if (energy >= 30) return 0.85;
  return 0.65;
}

/** 0–3 yıldız: başarısız 0; isabet/kaliteye göre 1–3. */
export function starsFor(result) {
  if (!result?.success) return 0;
  const a = clamp(result.accuracy || 0, 0, 1);
  return a >= 0.78 ? 3 : a >= 0.45 ? 2 : 1;
}

/** Zorluk gelişim çarpanı: zor antrenmanda başarısızlık da biraz öğretir ama ödül başarıda. */
export function difficultyGain(diff, success) {
  const d = DIFFICULTY[diff] || DIFFICULTY.normal;
  if (diff === 'hard' && !success) return 1.1;
  return d.gain;
}

/** Yıldızı kaydeder; rekor mu? */
export function recordDrill(state, stat, diff, stars) {
  const t = ensureTraining(state);
  const b = (t.best[stat] ||= {});
  const prev = b[diff] || 0;
  const newBest = stars > prev;
  if (newBest) b[diff] = stars;
  t.sessions++;
  t.log.unshift({ stat, diff, stars });
  t.log.length = Math.min(t.log.length, 20);
  return { prev, best: Math.max(prev, stars), newBest: newBest && stars > 0 };
}

/** Zor seviyede 3 yıldız alınan antrenman sayısı (başarım). */
export function hardMasters(state) {
  const best = state.training?.best || {};
  return STAT_KEYS.filter((k) => best[k]?.hard === 3).length;
}

const pct = (v) => `%${Math.round(v * 100)}`;

/**
 * Hocanın yorumu: ne yaptın, neyi düzeltmelisin. {tone:'good'|'warn'|'bad', text}
 */
export function coachTip(game, r = {}) {
  const ok = !!r.success;
  const o = r.outcome;
  if (game === 'shot') {
    if (ok) return { tone: 'good', text: (r.accuracy || 0) > 0.75 ? 'Tam köşeye! Kaleciye şans tanımadın.' : 'Gol güzel ama köşeyi biraz daha zorlayabilirsin.' };
    const t = {
      save: 'Kaleciye yakın vurdun. Köşelere yönel, kalecinin uzağına.',
      over: 'Topun altına girdin. Daha kısa kaydır, şut alçak gitsin.',
      wide: 'Nişan açık kaldı. Kaydırmayı kaleye doğru, daha dik yap.',
      post: 'Az kalsın! Bir tık içeri nişan alsaydın gol.',
      block: 'Savunmacının bacağına vurdun. Şut açısını onun yanından aç.',
      timeout: 'Çok bekledin, top elinden alındı. Karar ver ve vur.',
    }[o];
    return { tone: 'bad', text: t || 'Bu sefer olmadı. Nişanı sakin al.' };
  }
  if (game === 'pass') {
    if (ok) {
      if (Math.abs(r.curve || 0) >= 0.25) return { tone: 'good', text: 'O falso ne öyle! Rakipler topun yolunu okuyamadı.' };
      return { tone: 'good', text: (r.accuracy || 0) > 0.7 ? 'Temiz, adrese teslim pas.' : 'Pas ulaştı ama koridor dardı. Kavis kullan, rakipten uzaklaştır.' };
    }
    const t = {
      intercept: 'Koridor kapalıydı. Rakibin etrafından kavisle dolaş ya da başka arkadaşı seç.',
      stolen: 'Çok bekledin, baskı geldi. Ağır çekimi kullan ama oyalanma.',
      out: 'Pas çok sert ya da uzun gitti. Çizgiyi arkadaşının ayağında bitir.',
      missed: 'Top boşluğa gitti. Çizgiyi bir arkadaşının üstünde bitir.',
      timeout: 'Süre doldu. Pası daha erken ver.',
    }[o];
    return { tone: 'bad', text: t || 'Pas yerini bulmadı.' };
  }
  if (game === 'tackle') {
    if (ok) {
      const t = {
        lunge: 'Bakışı okudun, koridoru kapattın ve tam zamanında uzandın. Pas arası!',
        intercept: 'Doğru yerdeydin: pas ayağına geldi.',
        tackle: 'Top sahibine yapıştın ve topu aldın. Cesur ama riskli!',
        loose: 'Baskın pası boşa çıkardı.',
        time: 'Rakibi oyaladın, takım geri döndü.',
      }[r.method];
      return { tone: 'good', text: t || 'Topu kazandın!' };
    }
    if (r.method === 'dribble') return { tone: 'bad', text: 'Top sahibinden çok uzak kaldın; topu sürüp ceza sahasına girdi. Yaklaş ama dibine girme.' };
    return { tone: 'bad', text: 'Ara pasını kesemedin. Bakış çizgisini izle, koridorun ortasına koş; top yanından geçerken dokun.' };
  }
  if (game === 'dribble') {
    const n = r.rows || 0;
    const c = r.clean || 0;
    if (ok) return { tone: 'good', text: c === n ? `Kusursuz! ${n} sıranın hepsini temiz geçtin.` : `${n} sıranın ${c} tanesini temiz geçtin. Rakibe yaklaşınca daha erken yüklen.` };
    return { tone: 'bad', text: `${n} sıranın ${c} tanesini geçebildin. Rakip seni kolluyor: bir yana yüklen, o gelince sert şekilde öbür yana kır.` };
  }
  if (game === 'shuttle') {
    if (ok) return { tone: 'good', text: `Seviye ${r.level}! ${r.perfectTurns ? `${r.perfectTurns} süper dönüş.` : ''} Tempo ayarın iyiydi.` };
    if (r.gassed) return { tone: 'bad', text: 'Nefesin bitti. Hep basılı tutma: bip\'e yetişecek kadar koş, erken varınca nefes topla.' };
    if ((r.perfectTurns || 0) < (r.turns || 0) / 2) return { tone: 'bad', text: 'Dönüşlerde çok zaman kaybettin. Çizgiye yaklaşınca DÖN\'e bas.' };
    return { tone: 'bad', text: `Seviye ${r.level}'de kaldın (hedef ${r.target}). Bip temposu çizgisini izle, onun önünde kal.` };
  }
  return { tone: ok ? 'good' : 'bad', text: ok ? 'İyi iş.' : 'Bir dahaki sefere.' };
}
