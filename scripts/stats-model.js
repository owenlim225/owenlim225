const { calculateRank } = require('./utils');
const { MONTH_NAMES } = require('./theme');

/** Parse YYYY-MM-DD without timezone shift. */
function parts(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

function formatMonthYear(isoOrYm) {
  const key = isoOrYm.length === 7 ? `${isoOrYm}-01` : isoOrYm;
  const { y, m } = parts(key);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

function formatRangeLabel(startIso) {
  if (!startIso) return 'N/A';
  return `${formatMonthYear(startIso)} – Present`;
}

/** Build a continuous YYYY-MM list ending at `endYm` (inclusive), length `count`. */
function monthWindow(endYm, count) {
  let [y, m] = endYm.split('-').map(Number);
  const keys = [];
  for (let i = 0; i < count; i++) {
    keys.unshift(`${y}-${String(m).padStart(2, '0')}`);
    m -= 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
  }
  return keys;
}

function computeStreaks(days, todayISO) {
  let longestStreak = 0;
  let temp = 0;
  for (const day of days) {
    if (day.count > 0) {
      temp += 1;
      longestStreak = Math.max(longestStreak, temp);
    } else {
      temp = 0;
    }
  }

  // Current streak: walk backward from today. If today is empty, yesterday may still keep it alive.
  let currentStreak = 0;
  if (days.length === 0) {
    return { currentStreak, longestStreak };
  }

  let i = days.length - 1;
  if (days[i].date === todayISO && days[i].count === 0) {
    i -= 1;
  }
  if (i < 0 || days[i].count === 0) {
    return { currentStreak: 0, longestStreak };
  }
  while (i >= 0 && days[i].count > 0) {
    currentStreak += 1;
    i -= 1;
  }
  return { currentStreak, longestStreak };
}

/**
 * Normalize raw GitHub user payload into a single presentation model.
 * Generators must display these values — they must not re-fetch or re-aggregate.
 */
function buildStats(user, { monthlyCount = 36, dailyCount = 40 } = {}) {
  const todayISO = new Date().toISOString().slice(0, 10);
  const todayYm = todayISO.slice(0, 7);

  // Deduplicate calendar days (year-boundary weeks can overlap when fetched per year).
  const byDate = new Map();
  for (const week of user.contributionsCollection.contributionCalendar.weeks || []) {
    for (const day of week.contributionDays || []) {
      if (day.date > todayISO) continue;
      byDate.set(day.date, day.contributionCount || 0);
    }
  }

  const days = [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));

  const totalFromDays = days.reduce((sum, d) => sum + d.count, 0);
  const firstActive = days.find((d) => d.count > 0);
  const startDate = firstActive ? firstActive.date : null;
  const endDate = todayISO;

  const { currentStreak, longestStreak } = computeStreaks(days, todayISO);

  const monthTotals = {};
  for (const { date, count } of days) {
    const key = date.slice(0, 7);
    monthTotals[key] = (monthTotals[key] || 0) + count;
  }

  const monthKeys = monthWindow(todayYm, monthlyCount);
  const monthly = monthKeys.map((m) => ({ m, c: monthTotals[m] || 0 }));
  const monthlyTotal = monthly.reduce((sum, mo) => sum + mo.c, 0);
  const monthlyAvg = monthly.length ? Math.round(monthlyTotal / monthly.length) : 0;

  let peakIdx = 0;
  for (let i = 1; i < monthly.length; i++) {
    if (monthly[i].c > monthly[peakIdx].c) peakIdx = i;
  }
  const peak = monthly[peakIdx] || { m: todayYm, c: 0 };
  const currentMonth = monthly[monthly.length - 1] || { m: todayYm, c: 0 };

  const daily = days.filter((d) => d.date <= todayISO).slice(-dailyCount);

  // Commits = commit contributions only (do not blend restricted/private misc activity).
  const commits = user.contributionsCollection.totalCommitContributions || 0;
  const stars = (user.repositories?.nodes || []).reduce(
    (acc, repo) => acc + (repo.stargazers?.totalCount || 0),
    0,
  );
  const pullRequests = user.pullRequests?.totalCount || 0;
  const issues = user.issues?.totalCount || 0;
  const followers = user.followers?.totalCount || 0;
  const repos = user.repositories?.nodes?.length || 0;

  const rank = calculateRank({
    commits,
    contribs: totalFromDays,
    issues,
    prs: pullRequests,
    stars,
    followers,
    repos,
  });

  const stats = {
    stars,
    commits,
    pullRequests,
    issues,
    followers,
    repos,
    rank,
    contributions: {
      total: totalFromDays,
      startDate,
      endDate,
      rangeLabel: formatRangeLabel(startDate),
      currentStreak,
      longestStreak,
      monthly,
      monthlyTotal,
      monthlyAvg,
      peak,
      peakIdx,
      currentMonth,
      monthlyRangeLabel: monthly.length
        ? `${formatMonthYear(monthly[0].m)} — ${formatMonthYear(monthly[monthly.length - 1].m)} · last ${monthly.length} months · GitHub contributions`
        : '',
      daily,
      sparkline: monthly.slice(-14),
    },
  };

  validateStats(stats);
  return stats;
}

function validateStats(stats) {
  const c = stats.contributions;
  const monthCounts = c.monthly.map((m) => m.c);
  const monthlySum = monthCounts.reduce((s, n) => s + n, 0);

  if (monthlySum !== c.monthlyTotal) {
    console.warn(
      `[stats-model] monthlyTotal mismatch: sum(bars)=${monthlySum} vs monthlyTotal=${c.monthlyTotal}`,
    );
  }

  const maxBar = monthCounts.length ? Math.max(...monthCounts) : 0;
  if (c.peak.c !== maxBar) {
    console.warn(`[stats-model] peak mismatch: peak.c=${c.peak.c} vs max(bars)=${maxBar}`);
  }

  const last = monthCounts[monthCounts.length - 1];
  if (c.currentMonth.c !== last) {
    console.warn(
      `[stats-model] currentMonth mismatch: currentMonth.c=${c.currentMonth.c} vs last bar=${last}`,
    );
  }

  // When first contribution falls inside the chart window, all-time must equal chart total.
  if (c.startDate && c.monthly.length) {
    const startYm = c.startDate.slice(0, 7);
    if (startYm >= c.monthly[0].m) {
      if (c.total !== c.monthlyTotal) {
        console.warn(
          `[stats-model] all-time total (${c.total}) should equal chart total (${c.monthlyTotal}) ` +
            `because first contribution (${c.startDate}) falls inside the ${c.monthly.length}-month window starting ${c.monthly[0].m}`,
        );
      }
    } else if (c.total < c.monthlyTotal) {
      console.warn(
        `[stats-model] all-time total (${c.total}) is less than chart total (${c.monthlyTotal}) — unexpected`,
      );
    }
  }

  console.log(
    `[stats-model] stars=${stats.stars} commits=${stats.commits} ` +
      `contribs=${c.total} (${c.rangeLabel}) | ` +
      `chart ${c.monthly.length}mo total=${c.monthlyTotal} avg=${c.monthlyAvg} ` +
      `peak=${c.peak.c} (${c.peak.m}) thisMonth=${c.currentMonth.c} (${c.currentMonth.m}) | ` +
      `streak current=${c.currentStreak} longest=${c.longestStreak}`,
  );
}

module.exports = { buildStats, formatMonthYear, formatRangeLabel, monthWindow, validateStats };
