const https = require('https');
const fs = require('fs');
const path = require('path');

// Load env variables manually from .env if needed
if (!process.env.GOOGLE_SPREADSHEET_ID) {
  try {
    const envPath = path.join(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
      const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
      for (const line of envLines) {
        const match = line.match(/^\s*GOOGLE_SPREADSHEET_ID\s*=\s*["']?([^"'\s#]+)["']?/);
        if (match) {
          process.env.GOOGLE_SPREADSHEET_ID = match[1];
          break;
        }
      }
    }
  } catch (e) {}
}

const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
if (!spreadsheetId) {
  console.error("Error: GOOGLE_SPREADSHEET_ID is not defined in the environment or .env file.");
  process.exit(1);
}

const tabs = [
  { name: 'comedy', gid: '0' },
  { name: 'else', gid: '1152319749' },
  { name: 'Halloween', gid: '214146335' },
  { name: 'Godzilla', gid: '1124227642' },
  { name: 'legacy', gid: '1030811239' },
  { name: 'Ferrell/Reilly', gid: '728634818' },
  { name: 'Segal', gid: '1173719410' },
  { name: 'mel brooks', gid: '523296340' },
  { name: 'Sheet22', gid: '1112877715' },
  { name: 'Brendan Fraser', gid: '281070591' },
  { name: 'SNL/Lorne Michaels', gid: '373176353' },
  { name: 'Martial Arts', gid: '1895817490' },
  { name: 'JCVD Movies', gid: '2054839623' }
];

const BLUE_BG_COLOR = '#cfe2f3';
const RED_BG_COLOR = '#f4cccc';

function fetchTabHtml(gid) {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/htmlview/sheet?headers=true&gid=${gid}`;
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', (err) => reject(err));
  });
}

function parseTab(tabName, html) {
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  if (!styleMatch) return [];
  const styleContent = styleMatch[1];

  const classColors = {};
  const classRegex = /\.ritz\s+\.waffle\s+\.(s\d+)\s*\{([^}]*background-color:\s*([^;]+)[^}]*)\}/g;
  let match;
  while ((match = classRegex.exec(styleContent)) !== null) {
    const className = match[1];
    const color = match[3].trim().toLowerCase();
    classColors[className] = color;
  }

  const movies = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let rowMatch;
  
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowHtml = rowMatch[1];
    const tdMatch = rowHtml.match(/<td\s+class="([^"]+)"[^>]*>([\s\S]*?)<\/td>/);
    if (tdMatch) {
      const className = tdMatch[1];
      let cellText = tdMatch[2]
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();

      if (cellText === 'Title' || !cellText || cellText.match(/^\d+$/) || cellText === 'Year') {
        continue;
      }

      const color = classColors[className] || '#ffffff';
      let type = null;
      if (color === BLUE_BG_COLOR) {
        type = 'blu-ray';
      } else if (color === RED_BG_COLOR) {
        type = '4K';
      }

      if (type) {
        movies.push({
          title: cellText,
          type,
          tab: tabName
        });
      }
    }
  }
  return movies;
}

async function run() {
  const movieMap = new Map();
  
  for (const tab of tabs) {
    try {
      const html = await fetchTabHtml(tab.gid);
      const parsed = parseTab(tab.name, html);
      for (const m of parsed) {
        // Normalize title for key mapping
        const key = m.title.trim().toLowerCase();
        if (movieMap.has(key)) {
          const existing = movieMap.get(key);
          existing.tabs.add(m.tab);
          // If there is any type conflict, we can log it (usually formats should match)
          if (existing.type !== m.type) {
            console.warn(`Mismatch format for movie "${m.title}": ${existing.type} (in ${Array.from(existing.tabs).join(', ')}) vs ${m.type} (in ${m.tab})`);
          }
        } else {
          movieMap.set(key, {
            title: m.title,
            type: m.type,
            tabs: new Set([m.tab])
          });
        }
      }
    } catch (err) {
      console.error(`Failed tab ${tab.name}:`, err.message);
    }
  }

  const consolidatedList = Array.from(movieMap.values()).map(m => ({
    title: m.title,
    type: m.type,
    tabs: Array.from(m.tabs)
  })).sort((a, b) => a.title.localeCompare(b.title));

  // Write JSON output
  const jsonPath = path.join(__dirname, '../prisma/extracted-movies.json');
  fs.writeFileSync(jsonPath, JSON.stringify(consolidatedList, null, 2), 'utf8');
  console.log(`Saved JSON list to ${jsonPath}`);

  // Write Markdown Table output
  const mdPath = path.join(__dirname, '../prisma/extracted-movies.md');
  let mdContent = `# Extracted Movie Media Formats\n\n`;
  mdContent += `This list contains all movies with blue (blu-ray) or red (4K) backgrounds from the Google Sheet.\n\n`;
  mdContent += `Total unique movies: **${consolidatedList.length}**\n\n`;
  mdContent += `| Movie Title | Format | Source Sheet Tab(s) |\n`;
  mdContent += `| :--- | :---: | :--- |\n`;
  
  for (const m of consolidatedList) {
    mdContent += `| ${m.title} | **${m.type}** | ${m.tabs.join(', ')} |\n`;
  }
  
  fs.writeFileSync(mdPath, mdContent, 'utf8');
  console.log(`Saved Markdown list to ${mdPath}`);
}

run();
