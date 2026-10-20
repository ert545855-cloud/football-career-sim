// HAKEM VE DİSİPLİN — maç içi kart kararları ve oyundan atılma.
//   Yandan/önden adama kayma: ilk faulde sözlü uyarı, sonra sarı; sarısı olan oyuncunun ikinci sarısı → kırmızı.
//   Arkadan kayma: doğrudan sarı; son adamsan ya da çok sert girdiysen doğrudan kırmızı riski.
//   Disiplinli / mütevazı oyuncuyu hakem bazen sözlü uyarıyla bırakır; egoist oyuncuya hakem daha serttir.
//   Kırmızı kart: oyundan atılırsın, kalan kritik anlar iptal, takım 10 kişi (rakibe ek gol şansı, sizin gollerden biri kaybolabilir).
//   Ceza: ikinci sarıdan 1 maç, doğrudan kırmızıdan 2 maç. Sezonda 4 sarı = 1 maç ceza.
import { chance, clamp, randInt } from './rng.js';

export const DISC_RULES = { yellowsForBan: 4, redBan: 2, secondYellowBan: 1 };

export function ensureDisc(match) {
  return (match.disc ||= { warnings: 0, yellow: 0, red: null, fouls: 0 });
}

/**
 * Hakem kararı. foul: { foulType: 'behind'|'side', reckless?, lastMan? }
 * ctx: { discipline (0–100 kişilik), attitude (−100 mütevazı … +100 egoist) }
 * @returns {{card:'none'|'warning'|'yellow'|'second'|'red', text:string}}
 */
export function refDecision(match, foul, ctx = {}, roll = Math.random) {
  const d = ensureDisc(match);
  d.fouls += 1;
  const disc = ctx.discipline ?? 50;
  const att = ctx.attitude ?? 0;
  // hakemin hoşgörüsü: disiplin ve mütevazılık artırır, egoizm azaltır
  const lenient = clamp(0.12 + (disc - 50) / 300 - att / 500, 0, 0.35);
  let card;
  if (foul.foulType === 'behind') {
    const redP = foul.reckless && foul.lastMan ? 0.6 : foul.lastMan ? 0.35 : foul.reckless ? 0.25 : 0;
    if (redP && roll() < redP) card = 'red';
    else card = d.yellow ? 'second' : 'yellow';
  } else if (d.warnings === 0 && !foul.reckless) {
    card = 'warning';
  } else {
    card = d.yellow ? 'second' : 'yellow';
    if (roll() < lenient) card = d.warnings < 2 ? 'warning' : card; // hakem bir kez daha uyarır
  }
  // egoist oyuncu: hakem sözlü uyarı yerine sarıya gidebilir
  if (card === 'warning' && att > 30 && roll() < (att - 30) / 250) card = d.yellow ? 'second' : 'yellow';
  if (card === 'warning') d.warnings += 1;
  if (card === 'yellow') d.yellow += 1;
  if (card === 'second' || card === 'red') { d.yellow += card === 'second' ? 1 : 0; d.red = card; }
  return { card };
}

/**
 * Oyundan atılma: kalan anlar iptal; takım 10 kişi. Ek rakip golü olayı ve sizin bir golünüzün kaybı (olasılıkla).
 * Eklenen olaylar match._inject içine yazılır (arayüz zaman çizelgesine ekler).
 */
export function sendOff(match, minute) {
  match.sentOff = minute;
  for (const m of match.moments || []) if (!m.done && m.minute > minute) { m.done = true; m.skipped = true; }
  const remaining = Math.max(0, 90 - minute);
  const inj = (match._inject ||= []);
  // sizin ileriki gollerinizden biri olmayabilir
  const myLater = (match.events || []).filter((e) => e.minute > minute && e.side === 'my' && e.kind === 'goal' && !e.cancelled);
  if (myLater.length && chance(0.35)) { const e = myLater[Math.floor(Math.random() * myLater.length)]; e.kind = 'chance'; e.tenMen = true; }
  // 10 kişiye karşı rakip baskısı
  if (remaining > 4 && chance(clamp(0.18 + (remaining / 90) * 0.45, 0, 0.6))) {
    const ev = { minute: randInt(Math.min(88, minute + 3), Math.min(89, Math.max(minute + 4, 88))), side: 'opp', kind: 'goal', tenMen: true };
    match.events.push(ev);
    inj.push(ev);
  }
}

/** Maç sonu: cezalar ve sarı birikimi. @returns {{ban:number, reason:string|null, yellows:number}} */
export function disciplineOnMatch(state, match) {
  const d = match.disc || { yellow: 0, red: null };
  const c = state.career;
  const f = state.flags;
  let ban = 0;
  let reason = null;
  if (d.red === 'red') { ban = DISC_RULES.redBan; reason = 'red'; }
  else if (d.red === 'second') { ban = DISC_RULES.secondYellowBan; reason = 'second'; }
  else if (d.yellow) {
    c.yellows = (c.yellows || 0) + d.yellow;
    if (c.yellows >= DISC_RULES.yellowsForBan) { ban = 1; reason = 'yellows'; c.yellows = 0; }
  }
  if (ban) f.suspendedWeeks = Math.max(f.suspendedWeeks || 0, ban);
  return { ban, reason, yellows: c.yellows || 0 };
}
