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

// Hex colors representing blue (blu-ray) and red (4K)
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
  // 1. Extract CSS styles
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  if (!styleMatch) {
    return [];
  }
  const styleContent = styleMatch[1];

  // Parse class names and their background colors
  const classColors = {};
  const classRegex = /\.ritz\s+\.waffle\s+\.(s\d+)\s*\{([^}]*background-color:\s*([^;]+)[^}]*)\}/g;
  let match;
  while ((match = classRegex.exec(styleContent)) !== null) {
    const className = match[1];
    const color = match[3].trim().toLowerCase();
    classColors[className] = color;
  }

  // 2. Parse table rows
  const movies = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let rowMatch;
  
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowHtml = rowMatch[1];
    
    // Find first td inside this row
    const tdMatch = rowHtml.match(/<td\s+class="([^"]+)"[^>]*>([\s\S]*?)<\/td>/);
    if (tdMatch) {
      const className = tdMatch[1];
      let cellText = tdMatch[2]
        .replace(/<[^>]+>/g, '') // remove HTML tags
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();

      // Skip structural headers
      if (cellText === 'Title' || !cellText || cellText.match(/^\d+$/) || cellText === 'Year') {
        continue;
      }

      // Check background color for this cell class
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
  console.log('Fetching and parsing all tabs...');
  const allMovies = [];
  
  for (const tab of tabs) {
    try {
      console.log(`Processing tab: ${tab.name} (gid=${tab.gid})...`);
      const html = await fetchTabHtml(tab.gid);
      const movies = parseTab(tab.name, html);
      console.log(`  Found ${movies.length} matches in tab: ${tab.name}`);
      allMovies.push(...movies);
    } catch (err) {
      console.error(`  Failed to fetch/parse tab: ${tab.name}:`, err.message);
    }
  }

  console.log('\nConsolidated List of Movies:');
  console.log(JSON.stringify(allMovies, null, 2));
  console.log(`\nTotal movies found across all tabs: ${allMovies.length}`);
}

run();
