// Denge simülasyonu: farklı mevki ve oyuncu becerileriyle kariyerleri baştan sona oynatır.
// Kullanım: npm run simulate
import { CLUB_BY_ID } from '../src/core/data.js';
import { newGame } from '../src/core/game.js';
import { ovr } from '../src/core/player.js';
import { money } from '../src/core/economy.js';
import { setRandom, seeded } from '../src/core/rng.js';
import { playWeek } from './bot.js';

const runs = [
  ['FW', 0.5], ['MF', 0.5], ['DF', 0.5], ['FW', 0.85], ['FW', 0.2],
];

for (const [position, human] of runs) {
  setRandom(seeded(position.charCodeAt(0) * 1000 + Math.round(human * 100)));
  const state = newGame({ name: 'Bot', position, number: 9 });
  console.log(`\n=== ${position} · insan becerisi ${human} · başlangıç ${CLUB_BY_ID[state.career.clubId].name} OVR ${ovr(state.player)} maaş ${money(state.career.contract.wage)}`);
  let weeks = 0;
  while (state.calendar.phase !== 'retired' && state.player.age < 33 && weeks < 400) {
    const { report } = playWeek(state, human);
    weeks++;
    if (report) {
      const r = report.record;
      console.log(
        `S${r.season} yaş ${r.age} ${CLUB_BY_ID[r.clubId].short.padEnd(4)} ${r.leagueId.padEnd(5)} sıra ${String(r.position).padStart(2)} | maç ${String(r.apps).padStart(2)} (${String(r.starts).padStart(2)} ilk11) gol ${String(r.goals).padStart(2)} asist ${String(r.assists).padStart(2)} ort ${r.avg.toFixed(1)} | OVR ${r.ovr} | para ${money(state.career.money)} maaş ${money(state.career.contract.wage)} | ödül: ${report.awards.map((a) => a.title).join(', ') || '-'}`
        + `\n      mentor: ${report.mentor.farewell ? `${report.mentor.farewell.mentor} (ilişki ${report.mentor.farewell.relationship})` : '-'} | nüfuz ${state.player.influence} sadakat ${state.player.loyalty} | gençler ${state.mentor.legacy.mentees.map((m) => m.name).join(', ') || '-'}${report.mentor.start?.legacyShift ? ' | ROL DEĞİŞİMİ' : ''}`,
      );
    }
  }
}
