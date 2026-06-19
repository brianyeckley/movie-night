const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../sheet_tab.html');
const html = fs.readFileSync(filePath, 'utf8');

// 1. Extract CSS styles
const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/);
if (!styleMatch) {
  console.error('Could not find style tag');
  process.exit(1);
}
const styleContent = styleMatch[1];

// Parse class names and their background colors
// CSS format: .ritz .waffle .sX{background-color:#ffffff;...}
const classColors = {};
const classRegex = /\.ritz\s+\.waffle\s+\.(s\d+)\s*\{([^}]*background-color:\s*([^;]+)[^}]*)\}/g;
let match;
while ((match = classRegex.exec(styleContent)) !== null) {
  const className = match[1];
  const color = match[3].trim().toLowerCase();
  classColors[className] = color;
}

console.log('Class mapping to background colors:');
console.log(classColors);

// 2. Parse table rows
// HTML format: <tr style="...">...<td class="sX"...>Title</td>...</tr>
const rows = [];
const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
let rowMatch;

// Skip the first tr because it contains column headers (A, B, C...)
let isFirstRow = true;

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

    // If it is the column headers row, skip it. The first row we find with cellText "Title" is the header.
    if (cellText === 'Title') {
      continue;
    }

    // Get background color for this cell class
    const color = classColors[className] || '#ffffff';
    rows.push({
      title: cellText,
      className,
      color
    });
  }
}

// 3. Filter and categorize movies
const bluRayColor = '#cfe2f3'; // Light blue
const fourKColor = '#f4cccc';  // Light red

console.log('\nProcessed Movies:');
const filteredMovies = rows
  .map(row => {
    let type = null;
    if (row.color === bluRayColor) {
      type = 'blu-ray';
    } else if (row.color === fourKColor) {
      type = '4K';
    }
    return { title: row.title, type, color: row.color };
  })
  .filter(movie => movie.type !== null && movie.title);

console.log(JSON.stringify(filteredMovies, null, 2));
console.log(`\nFound ${filteredMovies.length} movies with blue or red backgrounds.`);
