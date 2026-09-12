import './loadEnv.js';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');

const { default: app } = await import('./app.js');

const BACKEND_PORT = Number(process.env.BACKEND_PORT) || 5000;
const FRONTEND_PORT = 3000;

// Start Express Backend
const expressServer = app.listen(BACKEND_PORT, () => {
  console.log(`\n=================================================`);
  console.log(` 🌾 [TaniCo Express Backend PROD] Running on http://localhost:${BACKEND_PORT}`);
  console.log(` 🚀 [TaniCo Next.js Frontend PROD] Starting on http://localhost:${FRONTEND_PORT}`);
  console.log(`=================================================\n`);
});

// Resolve Next.js binary
const localNextBin = path.resolve(appRoot, 'node_modules/.bin/next');
const directNextJs = path.resolve(appRoot, 'node_modules/next/dist/bin/next');

let nextBin = 'next';
let nextArgs = ['start', '-p', String(FRONTEND_PORT), '-H', '0.0.0.0'];

if (fs.existsSync(localNextBin)) {
  nextBin = localNextBin;
} else if (fs.existsSync(directNextJs)) {
  nextBin = process.execPath;
  nextArgs = [directNextJs, 'start', '-p', String(FRONTEND_PORT), '-H', '0.0.0.0'];
} else {
  nextBin = 'npx';
  nextArgs = ['next', 'start', '-p', String(FRONTEND_PORT), '-H', '0.0.0.0'];
}

// Start Next.js Frontend Server
const nextProcess = spawn(nextBin, nextArgs, {
  cwd: appRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    PORT: String(FRONTEND_PORT),
    BACKEND_PORT: String(BACKEND_PORT),
    INTERNAL_API_URL: `http://127.0.0.1:${BACKEND_PORT}`
  }
});

function handleExit(signal) {
  console.log(`\nReceived ${signal}, shutting down TaniCo servers...`);
  if (expressServer) {
    try { expressServer.close(); } catch (_) {}
  }
  if (nextProcess) {
    try { nextProcess.kill(); } catch (_) {}
  }
  process.exit(0);
}

process.on('SIGINT', () => handleExit('SIGINT'));
process.on('SIGTERM', () => handleExit('SIGTERM'));

nextProcess.on('close', (code) => {
  if (expressServer) {
    try { expressServer.close(); } catch (_) {}
  }
  process.exit(code || 0);
});
