// Match ball selection and visual palettes. Designs are original color/pattern
// combinations, not copies of licensed tournament balls.
export const BALL_DESIGNS = {
  white: { light: '#f4f4f0', dark: '#22262b', shade: '#b9bfc4', accent: '#f4f4f0', pattern: 'plain' },
  orange: { light: '#ff8a1f', dark: '#1e293b', shade: '#d9650b', accent: '#ffe06a', pattern: 'diagonal' },
  rain: { light: '#9aa8b4', dark: '#172536', shade: '#566674', accent: '#42d5e8', pattern: 'cross' },
  night: { light: '#fff3a3', dark: '#14334a', shade: '#bfaa58', accent: '#21d4fd', pattern: 'geometric' },
  turkey: { light: '#f4f4f0', dark: '#22262b', shade: '#b9bfc4', accent: '#e11d48', pattern: 'diagonal' },
  brazil: { light: '#ffe05a', dark: '#245b42', shade: '#c19f26', accent: '#1d9a68', pattern: 'geometric' },
  england: { light: '#f4f4f0', dark: '#26364d', shade: '#b9bfc4', accent: '#dc3545', pattern: 'cross' },
  spain: { light: '#f4f4f0', dark: '#5b2020', shade: '#b9bfc4', accent: '#f4c542', pattern: 'horizontal' },
  italy: { light: '#f4f4f0', dark: '#214b79', shade: '#b9bfc4', accent: '#34a66f', pattern: 'vertical' },
  germany: { light: '#f4f4f0', dark: '#202020', shade: '#b9bfc4', accent: '#d43b37', pattern: 'horizontal' },
  international: { light: '#e8f3ff', dark: '#18325b', shade: '#9db4d0', accent: '#d6a7ff', pattern: 'geometric' },
};

const COUNTRY_BALLS = {
  tr: 'turkey', br: 'brazil', en: 'england', es: 'spain', it: 'italy', de: 'germany',
};
const WEATHER_BALLS = { rain: 'rain', storm: 'rain', mud: 'rain' };
const LEAGUE_BALLS = { 'tr-super': 'turkey', 'tr-first': 'turkey', super: 'turkey', first: 'turkey' };

/** Stable precedence: snow > other weather > night > tournament > country/league > default. */
export function selectMatchBall({ weather, country, league, tournament, night = false } = {}) {
  if (weather?.id === 'snow' || weather?.surface === 'snow') return 'orange';
  const weatherBall = WEATHER_BALLS[weather?.id];
  if (weatherBall) return weatherBall;
  if (night || weather?.id === 'night') return 'night';
  if (tournament) return 'international';
  return COUNTRY_BALLS[country] || LEAGUE_BALLS[league] || 'white';
}
