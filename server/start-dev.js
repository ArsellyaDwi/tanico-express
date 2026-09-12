import './loadEnv.js';
import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');

// Ensure Prisma client is initialized before loading app
try {
  const schemaPath = path.resolve(appRoot, 'prisma/schema.prisma');
  let needsPrisma = false;
  try {
    const { PrismaClient } = await import('@prisma/client');
    new PrismaClient();
  } catch (err) {
    if (err.message && err.message.includes('did not initialize yet')) {
      needsPrisma = true;
    }
  }

  if (needsPrisma && fs.existsSync(schemaPath)) {
    console.log('🌾 [TaniCo] Generating Prisma Client...');
    const localPrismaBin = path.resolve(appRoot, 'node_modules/.bin/prisma');
    const directPrismaJs = path.resolve(appRoot, 'node_modules/prisma/build/index.js');
    const rootPrismaBin = path.resolve(appRoot, '../node_modules/.bin/prisma');

    let prismaCmd = null;
    if (fs.existsSync(localPrismaBin)) {
      prismaCmd = `"${localPrismaBin}"`;
    } else if (fs.existsSync(directPrismaJs)) {
      prismaCmd = `"${process.execPath}" "${directPrismaJs}"`;
    } else if (fs.existsSync(rootPrismaBin)) {
      prismaCmd = `"${rootPrismaBin}"`;
    } else {
      prismaCmd = 'npx prisma';
    }

    execSync(`${prismaCmd} generate --schema="${schemaPath}"`, {
      cwd: appRoot,
      stdio: 'inherit',
      env: { ...process.env }
    });
    console.log('🌾 [TaniCo] Prisma Client generated successfully.');
  }
} catch (prismaErr) {
  console.warn('🌾 [TaniCo] Notice on Prisma initialization check:', prismaErr.message);
}

// Dynamically import Express app
const { default: app } = await import('./app.js');

const BACKEND_PORT = Number(process.env.BACKEND_PORT) || 5000;
const FRONTEND_PORT = 3000;

// Start Express Backend
const expressServer = app.listen(BACKEND_PORT, () => {
  console.log(`\n=================================================`);
  console.log(` 🌾 [TaniCo Express Backend] Running on http://localhost:${BACKEND_PORT}`);
  console.log(` 🚀 [TaniCo Next.js Frontend] Starting on http://localhost:${FRONTEND_PORT}`);
  console.log(`=================================================\n`);
});

expressServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`[TaniCo Express Backend] Port ${BACKEND_PORT} already in use. Assuming instance is running.`);
  } else {
    console.error('[TaniCo Express Backend] Server error:', err);
  }
});

// Resolve Next.js binary
const localNextBin = path.resolve(appRoot, 'node_modules/.bin/next');
const directNextJs = path.resolve(appRoot, 'node_modules/next/dist/bin/next');

let nextBin = 'next';
let nextArgs = ['dev', '-p', String(FRONTEND_PORT), '-H', '0.0.0.0'];

if (fs.existsSync(localNextBin)) {
  nextBin = localNextBin;
} else if (fs.existsSync(directNextJs)) {
  nextBin = process.execPath;
  nextArgs = [directNextJs, 'dev', '-p', String(FRONTEND_PORT), '-H', '0.0.0.0'];
} else if (process.platform === 'win32') {
  nextBin = 'npx';
  nextArgs = ['next', 'dev', '-p', String(FRONTEND_PORT), '-H', '0.0.0.0'];
} else {
  nextBin = 'npx';
  nextArgs = ['next', 'dev', '-p', String(FRONTEND_PORT), '-H', '0.0.0.0'];
}

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

nextProcess.on('error', (err) => {
  console.error('[TaniCo Next.js] Failed to spawn Next.js process:', err);
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
