// @ts-check
// Başlangıç akışı: isim → seçmeler kampı → rapor/mevki → teklifler → imza.
// Bu dosya, başlangıç yollarının (A/B/C) sezon boyunca oyun akışına etkilerini de yönetir.
import { AVATAR, CLUB_BY_ID, CLUBS } from '../data.js';
import { clubRating } from '../league.js';
import { ovr } from '../player.js';
import { ensureNumberAfterMove } from './numbers.js';

export * from './tryouts.js';
export * from './offers.js';
export * from './numbers.js';

/** Rastgele görünüş (karakter oluşturmada yalnızca isim girilir) */
export function randomAvatar(rnd = Math.random) {
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  return {
    skin: Math.floor(rnd() * AVATAR.skins.length),
    hair: pick(AVATAR.hairStyles.filter((h) => h !== 'bald')),
    hairColor: Math.floor(rnd() * 4),
  };
}

/** Kiralıkta ya da altyapıdayken devre arası transferi yapılamaz. */
export function isTransferLocked(state) {
  const { career, calendar } = state;
  return !!((career.loan && calendar.season <= career.loan.untilSeason) || (career.academy && calendar.season <= career.academy.untilSeason));
}

/** İlk 11 garantisi bu sezon geçerli mi? */
export function hasStarterGuarantee(state) {
  const g = state.career.guarantee;
  return !!g && state.calendar.season <= g.untilSeason;
}

/** Bu oyuncu için kadro/mentor kulübü: altyapıdayken A takım kadrosu */
export const squadClubId = (state) => state.career.academy?.parentId || state.career.clubId;

const round50 = (v) => Math.round(v / 50) * 50;

/**
 * Sezon sonu: kiralık dönüşü ve altyapıdan A takıma yükselme.
 * endSeason içinde, yaşlanma ve sözleşme yılı düşüşünden sonra, teklifler üretilmeden önce çağrılır.
 * @param {any} state
 * @param {() => number} [rnd]
 * @returns {null | {kind:'loan_return'|'graduation'|'graduation_loan', from:string, to:string, parentId:string, text:string, numberChanged:boolean, number:number, prevSquadClub:string}}
 */
export function resolveStartTerms(state, rnd = Math.random) {
  const { career, calendar, player, world } = state;
  const season = calendar.season;
  const prevSquadClub = squadClubId(state);

  // B (ya da yükselme sonrası) kiralık bitti → ana kulübe dönüş
  if (career.loan && season >= career.loan.untilSeason) {
    const from = career.clubId;
    const to = career.loan.parentId;
    career.loan = null;
    career.clubId = to;
    player.rel.manager = 50;
    player.rel.teammates = 42;
    const n = ensureNumberAfterMove(state, rnd);
    return { kind: 'loan_return', from, to, parentId: to, text: `Kiralık süren bitti: ${CLUB_BY_ID[from].name} → ${CLUB_BY_ID[to].name}. Ana kulübüne döndün!`, numberChanged: n.changed, number: n.number, prevSquadClub };
  }

  // C: altyapı sezonu bitti → A takım sözleşmesi (seviyesi çok gerideyse 1 yıllık kiralık)
  if (career.academy && season >= career.academy.untilSeason) {
    const parentId = career.academy.parentId;
    const from = career.clubId;
    const parentR = clubRating(world, parentId);
    const o = ovr(player);
    career.academy = null;
    career.contract = { wage: Math.max(400, round50(100 * Math.exp(parentR / 14) * 0.5 * 0.6)), yearsLeft: 3 };
    player.rel.manager = 52;
    player.rel.teammates = 45;
    if (o < parentR - 28) {
      const loans = CLUBS.filter((c) => c.league === 'first').sort((a, b) => clubRating(world, b.id) - clubRating(world, a.id)).slice(0, 6);
      const loanTo = loans[Math.floor(rnd() * loans.length)].id;
      career.clubId = loanTo;
      career.loan = { parentId, untilSeason: season + 1 };
      career.guarantee = { untilSeason: season + 1, reason: 'loan' };
      const n = ensureNumberAfterMove(state, rnd);
      return { kind: 'graduation_loan', from, to: loanTo, parentId, text: `${CLUB_BY_ID[parentId].name} seninle 3 yıllık profesyonel sözleşme imzaladı ve gelişmen için ${CLUB_BY_ID[loanTo].name} takımına kiraladı.`, numberChanged: n.changed, number: n.number, prevSquadClub };
    }
    career.clubId = parentId;
    const n = ensureNumberAfterMove(state, rnd);
    return { kind: 'graduation', from, to: parentId, parentId, text: `Altyapıdan A takıma yükseldin! ${CLUB_BY_ID[parentId].name} ile 3 yıllık profesyonel sözleşme.`, numberChanged: n.changed, number: n.number, prevSquadClub };
  }
  return null;
}
