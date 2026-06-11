const fs = require('fs');

const TOKEN = process.env.GH_TOKEN;
const USERNAME = 'akhandsinghjr';

// We fetch base stats and the account creation date first
const baseQuery = `
  query {
    user(login: "${USERNAME}") {
      createdAt
      followers { totalCount }
      pullRequests(first: 1) { totalCount }
      repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
        totalCount
        nodes {
          stargazerCount
        }
      }
    }
  }
`;

async function fetchGitHubAPI(query) {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query })
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.statusText}`);
  }
  return response.json();
}

async function fetchStats() {
  console.log('Fetching base profile data...');
  const baseData = await fetchGitHubAPI(baseQuery);
  const user = baseData.data.user;

  // Determine the years we need to fetch
  const creationYear = new Date(user.createdAt).getFullYear();
  const currentYear = new Date().getFullYear();

  // Calculate static metrics
  const totalStars = user.repositories.nodes.reduce((acc, repo) => acc + repo.stargazerCount, 0);

  let allDays = [];
  let contributionsThisYear = 0;

  console.log(`Fetching contribution data from ${creationYear} to ${currentYear}...`);
  
  // Loop through every year since the account was created to get ALL contributions
  for (let year = creationYear; year <= currentYear; year++) {
    const from = `${year}-01-01T00:00:00Z`;
    const to = `${year}-12-31T23:59:59Z`;

    const yearQuery = `
      query {
        user(login: "${USERNAME}") {
          contributionsCollection(from: "${from}", to: "${to}") {
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

    const yearData = await fetchGitHubAPI(yearQuery);
    const calendar = yearData.data.user.contributionsCollection.contributionCalendar;

    if (year === currentYear) {
      contributionsThisYear = calendar.totalContributions;
    }

    calendar.weeks.forEach(week => {
      allDays.push(...week.contributionDays);
    });
  }

  console.log('Processing timeline and calculating streaks...');
  
  // Sort all days chronologically
  allDays.sort((a, b) => new Date(a.date) - new Date(b.date));

  let longestStreak = 0;
  let currentStreak = 0;
  let tempStreak = 0;
  let totalContributionsAllTime = 0;

  // We only evaluate up to "today" to avoid counting future un-committed days as broken streaks
  const todayStr = new Date().toISOString().split('T')[0];
  const pastDays = allDays.filter(d => d.date <= todayStr);

  // 1. Calculate All-Time Total and Longest Streak
  for (const day of pastDays) {
    totalContributionsAllTime += day.contributionCount;
    
    if (day.contributionCount > 0) {
      tempStreak++;
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
    } else {
      tempStreak = 0;
    }
  }

  // 2. Calculate Current Streak (Iterate backwards from today)
  let cStreak = 0;
  for (let i = pastDays.length - 1; i >= 0; i--) {
    const day = pastDays[i];
    if (day.contributionCount > 0) {
      cStreak++;
    } else {
      // If today is 0, the streak isn't necessarily broken yet (user might commit later today)
      // So we give a 1-day grace period for the absolute last day in the array.
      if (i === pastDays.length - 1) continue;
      break; // Streak broken
    }
  }

  return {
    stars: totalStars,
    repos: user.repositories.totalCount,
    prs: user.pullRequests.totalCount,
    followers: user.followers.totalCount,
    totalContributionsAllTime,
    contributionsThisYear,
    longestStreak,
    currentStreak
  };
}

function generateSVG(stats) {
  return `<svg fill="none" viewBox="0 0 800 220" width="800" height="220" xmlns="http://www.w3.org/2000/svg">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        .wrap {
          width: 800px;
          height: 220px;
          background: #0d1117;
          font-family: 'Courier New', monospace;
          padding: 20px 40px;
        }
        .section-label {
          font-size: 10px;
          letter-spacing: 0.15em;
          color: #4ade80;
          margin-bottom: 14px;
          text-transform: uppercase;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }
        .card {
          background: #161b22;
          border: 1px solid #21262d;
          border-radius: 8px;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .label {
          font-size: 10.5px;
          color: #8b949e;
          margin-bottom: 4px;
          white-space: nowrap;
        }
        .value {
          font-size: 20px;
          color: #e6edf3;
          font-weight: 700;
        }
        .value span {
          color: #4ade80;
        }
      </style>
      <div class="wrap">
        <div class="section-label">// git_stats</div>
        <div class="grid">
          <!-- Row 1: The Requested Deep Stats -->
          <div class="card">
            <div class="label">Overall Contribs</div>
            <div class="value"><span>></span> ${stats.totalContributionsAllTime}</div>
          </div>
          <div class="card">
            <div class="label">Current Year</div>
            <div class="value"><span>></span> ${stats.contributionsThisYear}</div>
          </div>
          <div class="card">
            <div class="label">Longest Streak</div>
            <div class="value"><span>></span> ${stats.longestStreak}</div>
          </div>
          <div class="card">
            <div class="label">Current Streak</div>
            <div class="value"><span>></span> ${stats.currentStreak}</div>
          </div>
          
          <!-- Row 2: Standard GitHub Stats -->
          <div class="card">
            <div class="label">Total Stars</div>
            <div class="value"><span>></span> ${stats.stars}</div>
          </div>
          <div class="card">
            <div class="label">Pull Requests</div>
            <div class="value"><span>></span> ${stats.prs}</div>
          </div>
          <div class="card">
            <div class="label">Public Repos</div>
            <div class="value"><span>></span> ${stats.repos}</div>
          </div>
          <div class="card">
            <div class="label">Followers</div>
            <div class="value"><span>></span> ${stats.followers}</div>
          </div>
        </div>
      </div>
    </div>
  </foreignObject>
</svg>`;
}

async function main() {
  try {
    const stats = await fetchStats();
    console.log('Generating SVG...');
    const svg = generateSVG(stats);
    fs.writeFileSync('stats.svg', svg);
    console.log('Successfully generated stats.svg!');
  } catch (error) {
    console.error('Failed to generate stats:', error);
    process.exit(1);
  }
}

main();
