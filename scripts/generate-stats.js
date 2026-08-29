const fs = require('fs');
const { fetchGitHubData, monthlyContributions, dailyContributions } = require('./api');
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
    const monthly = monthlyContributions(data.user, 36);
    const daily = dailyContributions(data.user, 40);

    for (const themeName of ['dark', 'light']) {
      const theme = THEMES[themeName];
      writeSVG(`${STATS_DIR}/combined-stats-${themeName}.svg`, generateCombinedStatsSVG(theme, data));
      writeSVG(`${STATS_DIR}/commits-monthly-${themeName}.svg`, generateCommitsMonthlySVG(theme, monthly));
      writeSVG(`${STATS_DIR}/activity-pulse-${themeName}.svg`, generateActivityPulseSVG(theme, daily));
      writeSVG(`${STATS_DIR}/waves-${themeName}.svg`, generateWavesSVG(theme));
    }
  } catch (error) {
    console.error('Error generating stats:', error);
    process.exit(1);
  }
}

main();
