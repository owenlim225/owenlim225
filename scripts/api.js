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
  const todayISO = new Date().toISOString().slice(0, 10);

  // Collect per-year, then normalize via date map so year-boundary weeks do not double-count.
  const byDate = new Map();
  let totalCommitContributions = 0;
  let restrictedContributionsCount = 0;

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

      totalCommitContributions += collection.totalCommitContributions;
      restrictedContributionsCount += collection.restrictedContributionsCount;

      for (const week of collection.contributionCalendar.weeks) {
        for (const day of week.contributionDays) {
          // Keep only days inside the requested year and not past today.
          // Year queries return partial weeks that spill into adjacent years.
          if (day.date < `${year}-01-01` || day.date > `${year}-12-31`) continue;
          if (day.date > todayISO) continue;
          byDate.set(day.date, day.contributionCount || 0);
        }
      }
    } catch (error) {
      console.error(`Failed to fetch data for ${year}:`, error);
    }
  }

  // Rebuild a calendar weeks structure from the deduped day map for downstream consumers.
  const sortedDates = [...byDate.keys()].sort();
  const weeks = [];
  let currentWeek = null;
  for (const date of sortedDates) {
    const dow = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0=Sun
    if (!currentWeek || dow === 0) {
      currentWeek = { contributionDays: [] };
      weeks.push(currentWeek);
    }
    currentWeek.contributionDays.push({
      date,
      contributionCount: byDate.get(date),
    });
  }

  const totalContributions = [...byDate.values()].reduce((a, b) => a + b, 0);

  user.contributionsCollection = {
    totalCommitContributions,
    restrictedContributionsCount,
    contributionCalendar: {
      // Always derived from the same day map used for charts/streaks.
      totalContributions,
      weeks,
    },
  };

  return { user };
}

module.exports = { fetchGitHubData };
