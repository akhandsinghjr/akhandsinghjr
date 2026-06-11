const fs = require('fs');

const TOKEN = process.env.GH_TOKEN;
const USERNAME = 'akhandsinghjr';

// We fetch up to 100 repositories owned by the user (ignoring forks)
// and get the top 10 languages from each repository by byte size.
const query = `
  query {
    user(login: "${USERNAME}") {
      repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
        nodes {
          name
          languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
            edges {
              size
              node {
                name
                color
              }
            }
          }
        }
      }
    }
  }
`;

async function fetchGitHubAPI() {
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

async function fetchTopLanguages() {
  console.log('Fetching language data...');
  const data = await fetchGitHubAPI();
  const repos = data.data.user.repositories.nodes;

  const langMap = {};
  let totalSize = 0;

  // Aggregate sizes for each language across all repositories
  repos.forEach(repo => {
    if (repo.languages && repo.languages.edges) {
      repo.languages.edges.forEach(edge => {
        const name = edge.node.name;
        // Fallback to our neon green if a language lacks a color
        const color = edge.node.color || '#4ade80';
        const size = edge.size;

        if (!langMap[name]) {
          langMap[name] = { name, color, size: 0 };
        }
        langMap[name].size += size;
        totalSize += size;
      });
    }
  });

  // Convert map to array, sort by size descending, and take the top 6
  const topLangs = Object.values(langMap)
    .sort((a, b) => b.size - a.size)
    .slice(0, 6)
    .map(lang => ({
      ...lang,
      // Calculate percentage and format to 1 decimal place
      percent: ((lang.size / totalSize) * 100).toFixed(1)
    }));

  return topLangs;
}

function generateSVG(langs) {
  // We map over the languages array to generate individual cards
  // Each card displays the language dot, name, percentage, and a dynamic progress bar
  const cardsHtml = langs.map(lang => `
    <div class="card">
      <div class="header">
        <div class="name">
          <span class="dot" style="background: ${lang.color}"></span>
          ${lang.name}
        </div>
        <div class="percent">${lang.percent}%</div>
      </div>
      <div class="bar-bg">
        <div class="bar-fill" style="width: ${lang.percent}%; background: ${lang.color}"></div>
      </div>
    </div>
  `).join('');

  return `<svg fill="none" viewBox="0 0 800 200" width="800" height="200" xmlns="http://www.w3.org/2000/svg">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        .wrap {
          width: 800px;
          height: 200px;
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
          grid-template-columns: repeat(3, 1fr);
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
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .name {
          font-size: 13px;
          color: #e6edf3;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .percent {
          font-size: 11px;
          color: #8b949e;
        }
        .bar-bg {
          width: 100%;
          height: 4px;
          background: #21262d;
          border-radius: 2px;
          overflow: hidden;
        }
        .bar-fill {
          height: 100%;
          border-radius: 2px;
        }
      </style>
      <div class="wrap">
        <div class="section-label">// top_languages</div>
        <div class="grid">
          ${cardsHtml}
        </div>
      </div>
    </div>
  </foreignObject>
</svg>`;
}

async function main() {
  try {
    const langs = await fetchTopLanguages();
    console.log('Generating Languages SVG...');
    const svg = generateSVG(langs);
    fs.writeFileSync('langs.svg', svg);
    console.log('Successfully generated langs.svg!');
  } catch (error) {
    console.error('Failed to generate languages stat:', error);
    process.exit(1);
  }
}

main();
