const { fmt } = require('../theme');

function generateCombinedStatsSVG(theme, stats) {
  const t = theme;
  const {
    stars,
    commits,
    pullRequests,
    issues,
    followers,
    rank,
    contributions,
  } = stats;

  const {
    total: totalContributions,
    rangeLabel,
    currentStreak,
    longestStreak,
    sparkline: monthly,
  } = contributions;

  const leftWidth = 450;
  const rightWidth = 495;
  const height = 195;
  const gap = 10;
  const totalWidth = leftWidth + rightWidth + gap;

  const metrics = [
    { label: 'Total Stars', value: stars },
    { label: 'Total Commits', value: commits },
    { label: 'Total PRs', value: pullRequests },
    { label: 'Total Issues', value: issues },
    { label: 'Followers', value: followers },
  ];

  const trackW = 275;
  const maxLog = Math.max(...metrics.map((m) => Math.log10((m.value || 0) + 1)), 1);
  metrics.forEach((m) => {
    m.barW = Math.round(trackW * (Math.log10((m.value || 0) + 1) / maxLog));
  });

  const rankR = 44;
  const rankC = 2 * Math.PI * rankR;
  const rankOffset = rankC - (Math.max(0, Math.min(100, rank.score)) / 100) * rankC;

  const streakR = 40;
  const streakC = 2 * Math.PI * streakR;
  const streakProgress = longestStreak > 0 ? currentStreak / longestStreak : 0;
  const streakOffset = streakC - streakProgress * streakC;

  let sparkSVG = '';
  if (monthly.length >= 2) {
    const maxC = Math.max(...monthly.map((m) => m.c), 1);
    const pts = monthly.map((m, i) => {
      const x = 1 + (i * (rightWidth - 2)) / (monthly.length - 1);
      const y = 192 - (m.c / maxC) * 60;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const line = 'M' + pts.join(' L');
    const area = `${line} L${(rightWidth - 1)},194 L1,194 Z`;
    sparkSVG = `<g class="cs-spark" clip-path="url(#cs-clipR)">
      <path d="${area}" fill="${t.accent}" opacity="${t.name === 'dark' ? '.08' : '.06'}"/>
      <path d="${line}" stroke="${t.accent}" stroke-width="1.5" fill="none" opacity="${t.name === 'dark' ? '.35' : '.3'}"/>
    </g>`;
  }

  const rows = metrics.map((m, i) => `
    <g class="cs-row" style="animation-delay:${150 + i * 110}ms">
      <text class="cs-lab" x="25" y="${36 + i * 32}">${m.label}</text>
      <text class="cs-val" x="300" y="${37 + i * 32}" text-anchor="end">${fmt(m.value)}</text>
      <rect x="25" y="${44 + i * 32}" width="${trackW}" height="4" rx="2" fill="${t.grid}"/>
      <rect class="cs-bar" style="animation-delay:${250 + i * 110}ms" x="25" y="${44 + i * 32}" width="${m.barW}" height="4" rx="2" fill="url(#cs-bg)"/>
    </g>`).join('');

  return `<svg width="${totalWidth}" height="${height}" viewBox="0 0 ${totalWidth} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="GitHub stats: ${fmt(stars)} stars, ${fmt(commits)} commits, rank ${rank.level}. ${fmt(totalContributions)} contributions, current streak ${currentStreak} days.">
  <style>
    .cs-lab { font: 400 12.5px 'Segoe UI', Ubuntu, sans-serif; fill: ${t.muted}; }
    .cs-val { font: 600 14px 'Segoe UI', Ubuntu, sans-serif; fill: ${t.ink}; }
    .cs-big { font: 700 28px 'Segoe UI', Ubuntu, sans-serif; fill: ${t.ink}; }
    .cs-rank { font: 700 24px 'Segoe UI', Ubuntu, sans-serif; fill: ${t.ink}; }
    .cs-cap { font: 600 9px 'Segoe UI', Ubuntu, sans-serif; fill: ${t.muted}; letter-spacing: 1.4px; }
    .cs-sub { font: 400 13px 'Segoe UI', Ubuntu, sans-serif; fill: ${t.muted}; }
    .cs-date { font: 400 11px 'Segoe UI', Ubuntu, sans-serif; fill: ${t.muted}; }
    .cs-cur { font: 700 13.5px 'Segoe UI', Ubuntu, sans-serif; fill: ${t.accent}; }
    .cs-fade { opacity: 0; animation: cs-fadein .5s ease-out forwards; }
    .cs-row { opacity: 0; animation: cs-fadein .45s ease-out both; }
    .cs-bar { transform: scaleX(0); transform-box: fill-box; transform-origin: left; animation: cs-grow .8s cubic-bezier(.33,1,.4,1) both; }
    .cs-ringL { stroke-dasharray: ${rankC.toFixed(2)}; stroke-dashoffset: ${rankC.toFixed(2)}; animation: cs-drawL 1.2s cubic-bezier(.33,1,.4,1) .5s both; }
    .cs-ringR { stroke-dasharray: ${streakC.toFixed(2)}; stroke-dashoffset: ${streakC.toFixed(2)}; animation: cs-drawR 1.2s cubic-bezier(.33,1,.4,1) .6s both; }
    .cs-spark { opacity: 0; animation: cs-fadein 1s ease-out .9s forwards; }
    .cs-halo { animation: cs-breathe 4.5s ease-in-out infinite alternate; }
    .cs-flame { animation: cs-flick 2.8s ease-in-out infinite; }
    @keyframes cs-fadein { to { opacity: 1; } }
    @keyframes cs-grow { to { transform: scaleX(1); } }
    @keyframes cs-drawL { to { stroke-dashoffset: ${rankOffset.toFixed(2)}; } }
    @keyframes cs-drawR { to { stroke-dashoffset: ${streakOffset.toFixed(2)}; } }
    @keyframes cs-breathe { from { opacity: .45; } to { opacity: 1; } }
    @keyframes cs-flick { 0%, 100% { opacity: 1; } 40% { opacity: .68; } 65% { opacity: .9; } }
    @media (prefers-reduced-motion: reduce) {
      .cs-fade, .cs-row, .cs-spark { animation: none; opacity: 1; }
      .cs-bar { animation: none; transform: none; }
      .cs-ringL { animation: none; stroke-dashoffset: ${rankOffset.toFixed(2)}; }
      .cs-ringR { animation: none; stroke-dashoffset: ${streakOffset.toFixed(2)}; }
      .cs-halo, .cs-flame { animation: none; }
    }
  </style>
  <defs>
    <linearGradient id="cs-bg" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${t.accent}"/>
      <stop offset="1" stop-color="${t.accentHi}"/>
    </linearGradient>
    <linearGradient id="cs-rg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${t.accentHi}"/>
      <stop offset="1" stop-color="${t.accent}"/>
    </linearGradient>
    <radialGradient id="cs-hg">
      <stop offset=".55" stop-color="${t.accent}" stop-opacity="0"/>
      <stop offset=".8" stop-color="${t.accent}" stop-opacity=".14"/>
      <stop offset="1" stop-color="${t.accent}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="cs-sep" x1="0" y1="30" x2="0" y2="170" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${t.grid}" stop-opacity="0"/>
      <stop offset=".5" stop-color="${t.grid}"/>
      <stop offset="1" stop-color="${t.grid}" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="cs-clipR"><rect x="0.5" y="0.5" rx="6" width="${rightWidth - 1}" height="${height - 1}"/></clipPath>
  </defs>

  <g>
    <rect x="0.5" y="0.5" rx="6" width="${leftWidth - 1}" height="${height - 1}" fill="${t.bg}" stroke="${t.border}"/>
    ${rows}
    <g transform="translate(382,92)">
      <circle class="cs-halo" r="57" fill="url(#cs-hg)"/>
      <circle r="${rankR}" stroke="${t.grid}" stroke-width="6" fill="none"/>
      <circle class="cs-ringL" r="${rankR}" stroke="url(#cs-rg)" stroke-width="6" fill="none" stroke-linecap="round" transform="rotate(-90)"/>
      <text class="cs-rank cs-fade" y="9" text-anchor="middle">${rank.level}</text>
    </g>
    <text class="cs-cap cs-fade" x="382" y="162" text-anchor="middle">TOP ${Math.max(1, Math.ceil(100 - rank.score))}%</text>
  </g>

  <g transform="translate(${leftWidth + gap},0)">
    <rect x="0.5" y="0.5" rx="6" width="${rightWidth - 1}" height="${height - 1}" fill="${t.bg}" stroke="${t.border}"/>
    ${sparkSVG}
    <line x1="165" y1="30" x2="165" y2="170" stroke="url(#cs-sep)"/>
    <line x1="330" y1="30" x2="330" y2="170" stroke="url(#cs-sep)"/>
    <g class="cs-row" style="animation-delay:250ms">
      <text class="cs-big" x="82.5" y="86" text-anchor="middle">${fmt(totalContributions)}</text>
      <text class="cs-sub" x="82.5" y="114" text-anchor="middle">Total Contributions</text>
      <text class="cs-date" x="82.5" y="136" text-anchor="middle">${rangeLabel}</text>
    </g>
    <g transform="translate(247.5,92)">
      <circle r="44" stroke="${t.grid}" stroke-width="7" fill="none"/>
      <circle class="cs-ringR" r="44" stroke="url(#cs-rg)" stroke-width="7" fill="none" stroke-linecap="round" transform="rotate(-90)"/>
      <text class="cs-big" y="10" text-anchor="middle">${currentStreak}</text>
    </g>
    <text class="cs-cur" x="247.5" y="162" text-anchor="middle">Current streak</text>
    <g transform="translate(350,120)">
      <path d="M-10 20 C-6 2, 12 -2, 16 18 L16 24 L-10 24 Z" fill="${t.accent}" opacity="0.8" class="cs-flame"/>
      <circle cx="2" cy="8" r="2.25" fill="${t.accent}" class="cs-flame"/>
    </g>
    <text class="cs-sub" x="355" y="156" text-anchor="middle">Longest streak: ${longestStreak} days</text>
  </g>
</svg>`;
}

module.exports = { generateCombinedStatsSVG };
