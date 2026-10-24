// Validate documentation, audit traceability, source/asset references and text encoding.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const absolute = name => path.join(root, name);
const relative = name => path.relative(root, name).replaceAll('\\', '/');
const generatedDirectories = new Set(['node_modules', 'venv', '.venv', '__pycache__', 'dist', '.pio']);
const walk = directory => fs.readdirSync(directory, {withFileTypes: true})
  .flatMap(entry => entry.isDirectory()
    ? generatedDirectories.has(entry.name) ? [] : walk(path.join(directory, entry.name))
    : entry.isFile() ? [path.join(directory, entry.name)] : []);
const failures = [];
function checkEncoding(file, text) {
  const damaged = /\uFFFD|\u00c3[\u0080-\u00ff\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u2000-\u20ff]|\u00e2[\u0080-\u00bf\u2000-\u20ff]|\u00f0\u0178|\u00c2[\u0080-\u00bf]/;
  if (damaged.test(text)) failures.push(`${relative(file)}: damaged text encoding`);
}
const documents = ['README.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'hardware/README.md']
  .map(absolute).concat(walk(absolute('docs')).filter(file => file.endsWith('.md')));
const withoutFences = text => text.replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, '');
const headingCache = new Map();
function headings(file) {
  if (!headingCache.has(file)) {
    const used = new Map();
    const slugs = new Set();
    for (const match of withoutFences(fs.readFileSync(file, 'utf8')).matchAll(/^#{1,6}\s+(.+)$/gm)) {
      const slug = match[1].toLowerCase().replace(/[^\p{L}\p{N}_\-\s]/gu, '').replace(/\s/g, '-');
      const count = used.get(slug) || 0;
      used.set(slug, count + 1);
      slugs.add(slug + (count ? `-${count}` : ''));
    }
    headingCache.set(file, slugs);
  }
  return headingCache.get(file);
}
let links = 0;
for (const file of documents) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.trim()) failures.push(`${relative(file)}: empty document`);
  checkEncoding(file, text);
  for (const match of withoutFences(text).matchAll(/!?\[[^\]\n]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    const href = match[1].replace(/^<|>$/g, '');
    if (/^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('//')) continue;
    links++;
    let decoded;
    try { decoded = decodeURIComponent(href); } catch { failures.push(`${relative(file)}: malformed link ${href}`); continue; }
    const [target, fragment] = decoded.split('#');
    const resolved = target ? path.resolve(path.dirname(file), target.split('?')[0]) : file;
    if (!resolved.startsWith(root + path.sep) || !fs.existsSync(resolved)) {
      failures.push(`${relative(file)}: missing local target ${href}`);
    } else if (fragment && resolved.endsWith('.md') && !headings(resolved).has(fragment)) {
      failures.push(`${relative(file)}: missing heading ${href}`);
    }
  }
}
const ids = [...Array.from({length: 36}, (_, i) => `F${String(i + 1).padStart(2, '0')}`),
  ...Array.from({length: 11}, (_, i) => `A${String(i + 1).padStart(2, '0')}`)];
for (const file of ['docs/audit/2026-10-24.md', 'docs/audit/STATUS.md']) {
  const text = fs.readFileSync(absolute(file), 'utf8');
  for (const id of ids) if (!new RegExp(`^\\| ${id} \\|`, 'm').test(text)) failures.push(`${file}: missing finding ${id}`);
}
const plan = fs.readFileSync(absolute('docs/audit/PLAN.md'), 'utf8');
for (let i = 1; i <= 22; i++) {
  const id = `R${String(i).padStart(2, '0')}`;
  if (!new RegExp(`^\\| ${id} \\|`, 'm').test(plan)) failures.push(`Remediation plan: missing ${id}`);
}

const sources = ['apps/web/src', 'apps/api/src', 'shared'].flatMap(directory => walk(absolute(directory)))
  .filter(file => /\.(?:ts|tsx)$/.test(file));
const edges = new Map();
const packages = new Set();
for (const file of sources) {
  const text = fs.readFileSync(file, 'utf8');
  checkEncoding(file, text);
  const references = ts.preProcessFile(text, true, true).importedFiles;
  const dependencies = [];
  for (const {fileName: specifier} of references) {
    if (specifier.startsWith('.')) {
      const base = path.resolve(path.dirname(file), specifier.replace(/\.js$/, ''));
      const resolved = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]
        .find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      if (resolved) dependencies.push(resolved);
      else failures.push(`${relative(file)}: missing import ${specifier}`);
    } else if (relative(file).startsWith('apps/web/')) {
      packages.add(specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]);
    }
  }
  edges.set(file, dependencies);
}
const seen = new Set();
function visit(file) {
  if (seen.has(file)) return;
  seen.add(file);
  for (const dependency of edges.get(file) || []) visit(dependency);
}
const entries = ['apps/web/src/main.tsx', 'shared/index.ts',
  ...['index', 'create-user', 'delivery-sink', 'legacy-import', 'maintenance', 'provision'].map(name => `apps/api/src/${name}.ts`)];
entries.map(absolute).concat(sources.filter(file => /\.test\./.test(file))).forEach(visit);
for (const file of sources) if (!seen.has(file)) failures.push(`Unreachable source: ${relative(file)}`);
const manifest = JSON.parse(fs.readFileSync(absolute('apps/web/package.json'), 'utf8'));
for (const dependency of Object.keys(manifest.dependencies)) {
  if (!packages.has(dependency)) failures.push(`Unused web dependency: ${dependency}`);
}
const webText = walk(absolute('apps/web/src')).filter(file => /\.(?:tsx?|css)$/.test(file))
  .concat(absolute('apps/web/index.html')).map(file => fs.readFileSync(file, 'utf8')).join('\n');
const extraTextFiles = ['ai/main.py', 'ai/__init__.py', 'apps/web/index.html', 'apps/web/src/index.css']
  .map(absolute).concat(['ai/services', 'ai/tests', 'simulator', 'scripts', 'hardware/esp32/src', 'hardware/esp32/test']
    .flatMap(directory => walk(absolute(directory)))
    .filter(file => /\.(?:py|cjs|h|cpp)$/.test(file) && path.basename(file) !== 'config.h'));
for (const file of extraTextFiles) checkEncoding(file, fs.readFileSync(file, 'utf8'));
const assets = walk(absolute('apps/web/public')).filter(file => /\.(?:png|jpe?g|gif|svg|webp|ico)$/i.test(file));
for (const match of webText.matchAll(/["'`]\/(?!\/)([^"'`\s]+\.(?:png|jpe?g|gif|svg|webp|ico))["'`]/gi)) {
  const file = path.resolve(absolute('apps/web/public'), match[1]);
  if (!file.startsWith(absolute('apps/web/public') + path.sep) || !fs.existsSync(file)) {
    failures.push(`Missing public image: /${match[1]}`);
  }
}
for (const file of assets) {
  const url = '/' + path.relative(absolute('apps/web/public'), file).replaceAll('\\', '/');
  if (!webText.includes(url)) failures.push(`Unreferenced public asset: ${relative(file)}`);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else console.log(`Project references passed: ${documents.length} documents, ${links} local links, 47 audit IDs, 22 regression cases, ${sources.length} source modules, ${assets.length} public image asset(s).`);
