const fs = require('fs');
const path = require('path');

const root = __dirname;
const frontend = path.join(root, 'frontend');
const backend = path.join(root, 'backend');

// Ensure directories exist
if (!fs.existsSync(frontend)) fs.mkdirSync(frontend);
if (!fs.existsSync(backend)) fs.mkdirSync(backend);

const frontendFiles = [
  'public', 'src', 'index.html', 'vite.config.ts', 'eslint.config.js',
  'tsconfig.app.json', 'tsconfig.json', 'tsconfig.node.json'
];

frontendFiles.forEach(file => {
  const oldPath = path.join(root, file);
  const newPath = path.join(frontend, file);
  if (fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, newPath);
  }
});

const serverDir = path.join(root, 'server');
if (fs.existsSync(serverDir)) {
  fs.renameSync(serverDir, path.join(backend, 'src'));
}

console.log("Migration complete.");
