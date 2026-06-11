const fs = require('fs');

// You can test this locally by running: GH_TOKEN=your_token node scripts/generate-stats.js
const TOKEN = process.env.GH_TOKEN;
const USERNAME = 'akhandsinghjr';

const query = `
  query {
    user(login: "${USERNAME}") {
      repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
        totalCount
        nodes {
          stargazerCount
        }
      }
      contributionsCollection {
        contributionCalendar {
          totalContributions
        }
        totalCommitContributions
        totalPullRequestContributions
      }
    }
  }
`;

async function fetchStats() {
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

  const data = await response.json();
  const user = data.data.user;

  // Calculate total stars
  const totalStars = user.repositories.nodes.reduce((acc, repo) => acc + repo.stargazerCount, 0);

  return {
    stars: totalStars,
    repos: user.repositories.totalCount,
    contributions: user.contributionsCollection.contributionCalendar.totalContributions,
    prs: user.contributionsCollection.totalPullRequestContributions
  };
}

function generateSVG(stats) {
  return `<svg fill="none" viewBox="0 0 800 160" width="800" height="160" xmlns="http://www.w3.org/2000/svg">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        .wrap {
          width: 800px;
          height: 160px;
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
          display: flex;
          gap: 12px;
        }
        .card {
          flex: 1;
          background: #161b22;
          border: 1px solid #21262d;
          border-radius: 8px;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .label {
          font-size: 11px;
          color: #8b949e;
          margin-bottom: 4px;
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
          <div class="card">
            <div class="label">Total Contributions</div>
            <div class="value"><span>></span> ${stats.contributions}</div>
          </div>
          <div class="card">
            <div class="label">Total Stars Earned</div>
            <div class="value"><span>></span> ${stats.stars}</div>
          </div>
          <div class="card">
            <div class="label">Pull Requests</div>
            <div class="value"><span>></span> ${stats.prs}</div>
          </div>
          <div class="card">
            <div class="label">Public Repositories</div>
            <div class="value"><span>></span> ${stats.repos}</div>
          </div>
        </div>
      </div>
    </div>
  </foreignObject>
</svg>`;
}

async function main() {
  try {
    console.log('Fetching GitHub stats...');
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
