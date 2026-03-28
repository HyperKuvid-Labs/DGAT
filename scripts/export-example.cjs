const fs = require('fs');
const path = require('path');

const exampleName = process.argv[2] || 'dgat-self';
const dataDir = path.join('examples', exampleName);
const outputDir = path.join('docs/examples', exampleName);

// Read config
const config = JSON.parse(fs.readFileSync(path.join(outputDir, 'config.json'), 'utf8'));

// Read data
const tree = JSON.parse(fs.readFileSync(path.join(dataDir, 'file_tree.json'), 'utf8'));
const graph = JSON.parse(fs.readFileSync(path.join(dataDir, 'dep_graph.json'), 'utf8'));
const blueprint = fs.readFileSync(path.join(dataDir, 'dgat_blueprint.md'), 'utf8');

// Create data script
const data = JSON.stringify({ tree, graph, blueprint, config });
const dataScript = '<script>window.__DGAT_DATA__ = ' + data + ';</script>';

// Read base HTML
let html = fs.readFileSync('frontend/dist-export/index.html', 'utf8');

// Inject data before first module script
html = html.replace(/<script type="module"/, dataScript + '\n<script type="module"');

fs.writeFileSync(path.join(outputDir, 'index.html'), html);
console.log('Done - HTML exported');
