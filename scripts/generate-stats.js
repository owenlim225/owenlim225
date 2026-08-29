const fs = require('fs');
const { fetchGitHubData } = require('./api');
const { buildStats } = require('./stats-model');
const { THEMES } = require('./theme');
const { generateCombinedStatsSVG } = require('./generators/combined-stats');
const { generateCommitsMonthlySVG } = require('./generators/commits-monthly');
const { generateActivityPulseSVG } = require('./generators/activity-pulse');
const { generateWavesSVG } = require('./generators/waves');

const STATS_DIR = 'images/stats';

function writeSVG(path, svg) {
  fs.writeFileSync(path, svg);
  console.log(`Generated ${path}`);
}

async function main() {
  try {
    if (!process.env.GH_TOKEN) {
      throw new Error('GH_TOKEN is not set.');
    }

    fs.mkdirSync(STATS_DIR, { recursive: true });

    const data = await fetchGitHubData();
    const stats = buildStats(data.user, { monthlyCount: 36, dailyCount: 40 });
    const { contributions } = stats;

    for (const themeName of ['dark', 'light']) {
      const theme = THEMES[themeName];
      writeSVG(
        `${STATS_DIR}/combined-stats-${themeName}.svg`,
        generateCombinedStatsSVG(theme, stats),
      );
      writeSVG(
        `${STATS_DIR}/commits-monthly-${themeName}.svg`,
        generateCommitsMonthlySVG(theme, contributions.monthly, {
          monthlyTotal: contributions.monthlyTotal,
          monthlyAvg: contributions.monthlyAvg,
          peakIdx: contributions.peakIdx,
          monthlyRangeLabel: contributions.monthlyRangeLabel,
        }),
      );
      writeSVG(
        `${STATS_DIR}/activity-pulse-${themeName}.svg`,
        generateActivityPulseSVG(theme, contributions.daily),
      );
      writeSVG(`${STATS_DIR}/waves-${themeName}.svg`, generateWavesSVG(theme));
    }
  } catch (error) {
    console.error('Error generating stats:', error);
    process.exit(1);
  }
}

main();
