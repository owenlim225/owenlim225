const https = require('https');

const TOKEN = process.env.GH_TOKEN;
const USERNAME = 'owenlim225';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function httpJSON(hostname, path, extraHeaders = {}) {
  const options = {
    hostname,
    path,
    method: 'GET',
    headers: { 'User-Agent': 'Node.js Script', ...extraHeaders },
  };
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Bad JSON from ${hostname}${path}: ${data.slice(0, 120)}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function httpJSONRetry(hostname, path, attempts = 6) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await httpJSON(hostname, path);
    } catch (e) {
      if (i === attempts - 1) {
        console.warn(`  giving up on ${hostname}${path}: ${e.message}`);
        return null;
      }
      await sleep(5000 * (i + 1));
    }
  }
  return null;
}

function postGraphQL(query) {
  const options = {
    hostname: 'api.github.com',
    path: '/graphql',
    method: 'POST',
    headers: {
      Authorization: `bearer ${TOKEN}`,
      'User-Agent': 'Node.js Script',
      'Content-Type': 'application/json',
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.errors) {
            reject(new Error(JSON.stringify(json.errors)));
          } else {
            resolve(json.data);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(JSON.stringify({ query }));
    req.end();
  });
}

async function fetchGitHubData() {
  if (!TOKEN) {
    throw new Error('GH_TOKEN is not set.');
  }

  const userInfoQuery = `
    query {
      user(login: "${USERNAME}") {
        name
        login
        createdAt
        followers {
          totalCount
        }
        pullRequests(first: 1) {
          totalCount
        }
        issues(first: 1) {
          totalCount
        }
        repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, orderBy: {field: STARGAZERS, direction: DESC}) {
          nodes {
            name
            description
            stargazerCount
            forkCount
            primaryLanguage {
              name
              color
            }
          }
        }
      }
    }
  `;

  const basicData = await postGraphQL(userInfoQuery);
  const user = basicData.user;
  for (const repo of user.repositories.nodes) {
    repo.stargazers = { totalCount: repo.stargazerCount || 0 };
    delete repo.stargazerCount;
  }

  const createdYear = new Date(user.createdAt).getFullYear();
  const currentYear = new Date().getFullYear();

  let aggregatedContributions = {
    totalCommitContributions: 0,
    restrictedContributionsCount: 0,
    contributionCalendar: {
      totalContributions: 0,
      weeks: [],
    },
  };

  for (let year = createdYear; year <= currentYear; year++) {
    const from = `${year}-01-01T00:00:00Z`;
    const to = `${year}-12-31T23:59:59Z`;

    const contributionQuery = `
      query {
        user(login: "${USERNAME}") {
          contributionsCollection(from: "${from}", to: "${to}") {
            totalCommitContributions
            restrictedContributionsCount
            contributionCalendar {
              totalContributions
              weeks {
                contributionDays {
                  contributionCount
                  date
                }
              }
            }
          }
        }
      }
    `;

    try {
      const yearData = await postGraphQL(contributionQuery);
      const collection = yearData.user.contributionsCollection;

      aggregatedContributions.totalCommitContributions += collection.totalCommitContributions;
      aggregatedContributions.restrictedContributionsCount += collection.restrictedContributionsCount;
      aggregatedContributions.contributionCalendar.totalContributions += collection.contributionCalendar.totalContributions;
      aggregatedContributions.contributionCalendar.weeks.push(...collection.contributionCalendar.weeks);
    } catch (error) {
      console.error(`Failed to fetch data for ${year}:`, error);
    }
  }

  const todayISO = new Date().toISOString().slice(0, 10);
  aggregatedContributions.contributionCalendar.weeks = aggregatedContributions.contributionCalendar.weeks
    .map((w) => ({ contributionDays: w.contributionDays.filter((d) => d.date <= todayISO) }))
    .filter((w) => w.contributionDays.length > 0);

  user.contributionsCollection = aggregatedContributions;
  return { user };
}

function calendarDays(user) {
  const byDate = new Map();
  for (const week of user.contributionsCollection.contributionCalendar.weeks) {
    for (const day of week.contributionDays) {
      byDate.set(day.date, day.contributionCount);
    }
  }
  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));
}

function monthlyContributions(user, count = 36) {
  const totals = {};
  for (const { date, count: c } of calendarDays(user)) {
    const key = date.slice(0, 7);
    totals[key] = (totals[key] || 0) + c;
  }
  return Object.keys(totals)
    .sort()
    .map((m) => ({ m, c: totals[m] }))
    .slice(-count);
}

function dailyContributions(user, count = 40) {
  const days = calendarDays(user);
  const todayISO = new Date().toISOString().slice(0, 10);
  const upToToday = days.filter((d) => d.date <= todayISO);
  return upToToday.slice(-count).map((d) => ({ d: d.date, c: d.count }));
}

module.exports = { fetchGitHubData, monthlyContributions, dailyContributions };
