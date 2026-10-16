import './loadEnv.js';
import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Standardize development environment for Next.js and Express
process.env.NODE_ENV = 'development';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');

// Functionally verify Prisma client readiness (fast and reliable without repetitive regeneration)
let isPrismaReady = false;
try {
  const { PrismaClient } = await import('@prisma/client');
  const testClient = new PrismaClient();
  if (testClient) isPrismaReady = true;
} catch (_) {
  isPrismaReady = false;
}

if (!isPrismaReady) {
  try {
    const schemaPath = path.resolve(appRoot, 'prisma/schema.prisma');
    if (fs.existsSync(schemaPath)) {
      console.log('🌾 [TaniCo] Initializing Prisma Client...');
      const localPrismaBin = path.resolve(appRoot, 'node_modules/.bin/prisma');
      const directPrismaJs = path.resolve(appRoot, 'node_modules/prisma/build/index.js');

      let prismaCmd = null;
      if (fs.existsSync(directPrismaJs)) {
        prismaCmd = `"${process.execPath}" "${directPrismaJs}"`;
      } else if (fs.existsSync(localPrismaBin)) {
        prismaCmd = `"${localPrismaBin}"`;
      } else {
        prismaCmd = 'npx prisma';
      }

      execSync(`${prismaCmd} generate --schema="${schemaPath}"`, {
        cwd: appRoot,
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'development' }
      });
      console.log('🌾 [TaniCo] Prisma Client ready.');
    }
  } catch (prismaErr) {
    console.warn('🌾 [TaniCo] Notice on Prisma initialization check:', prismaErr.message);
  }
}
// Clean stale Next.js build cache to prevent dev/prod RSC mismatches
try {
  const cacheDir = path.resolve(appRoot, '.next/cache');
  if (fs.existsSync(cacheDir)) {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
} catch (_) {}
// Function to clean up stale processes holding target ports or running orphan next/express processes
function cleanupStaleProcesses(ports) {
  const currentPid = process.pid;
  const parentPid = process.ppid;
  const targetPortsHex = ports.map(p => p.toString(16).toUpperCase().padStart(4, '0'));
  const stalePids = new Set();

  try {
    const inodes = new Set();
    for (const tcpFile of ['/proc/net/tcp', '/proc/net/tcp6']) {
      if (!fs.existsSync(tcpFile)) continue;
      const lines = fs.readFileSync(tcpFile, 'utf8').split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length > 9) {
          const localAddr = parts[1];
          const inode = parts[9];
          for (const hp of targetPortsHex) {
            if (localAddr.endsWith(':' + hp)) {
              inodes.add(inode);
            }
          }
        }
      }
    }

    if (inodes.size > 0 && fs.existsSync('/proc')) {
      const procEntries = fs.readdirSync('/proc');
      for (const entry of procEntries) {
        const pid = parseInt(entry, 10);
        if (isNaN(pid) || pid <= 1 || pid === currentPid || pid === parentPid) continue;
        try {
          const fdDir = `/proc/${pid}/fd`;
          if (!fs.existsSync(fdDir)) continue;
          const fds = fs.readdirSync(fdDir);
          for (const fd of fds) {
            try {
              const link = fs.readlinkSync(`${fdDir}/${fd}`);
              for (const inode of inodes) {
                if (link === `socket:[${inode}]`) {
                  stalePids.add(pid);
                }
              }
            } catch (_) {}
          }
        } catch (_) {}
      }
    }
  } catch (_) {}

  try {
    if (fs.existsSync('/proc')) {
      const procEntries = fs.readdirSync('/proc');
      for (const entry of procEntries) {
        const pid = parseInt(entry, 10);
        if (isNaN(pid) || pid <= 1 || pid === currentPid || pid === parentPid) continue;
        try {
          const cmd = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8');
          if (
            cmd.includes('next-server') ||
            (cmd.includes('next') && cmd.includes('dev')) ||
            (cmd.includes('start-dev.js') && pid !== currentPid)
          ) {
            stalePids.add(pid);
          }
        } catch (_) {}
      }
    }
  } catch (_) {}

  for (const pid of stalePids) {
    try {
      console.log(`🌾 [TaniCo Dev] Releasing port occupied by stale process ${pid}...`);
      process.kill(pid, 'SIGKILL');
    } catch (_) {}
  }

  if (stalePids.size > 0) {
    const start = Date.now();
    while (Date.now() - start < 350) {
      // Synchronous pause to allow kernel socket release
    }
  }
}

const BACKEND_PORT = Number(process.env.BACKEND_PORT) || 5000;
const FRONTEND_PORT = Number(process.env.FRONTEND_PORT) || 3000;

// Preemptively free ports from previous crashed or orphaned instances
cleanupStaleProcesses([FRONTEND_PORT, BACKEND_PORT]);

// Dynamically import Express app
const { default: app } = await import('./app.js');

// Start Express Backend
const expressServer = app.listen(BACKEND_PORT, '0.0.0.0', () => {
  console.log(`\n=================================================`);
  console.log(` 🌾 [TaniCo Express Backend] Ready on http://127.0.0.1:${BACKEND_PORT}`);
  console.log(` 🚀 [TaniCo Next.js Frontend] Launching on http://127.0.0.1:${FRONTEND_PORT}`);
  console.log(`=================================================\n`);
});

expressServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`[TaniCo Express Backend] Port ${BACKEND_PORT} in use, assuming backend service is already active.`);
  } else {
    console.error('[TaniCo Express Backend] Server error:', err);
  }
});

// Resolve Next.js binary cross-platform without shell pitfalls
const directNextJs = path.resolve(appRoot, 'node_modules/next/dist/bin/next');
const localNextBin = path.resolve(appRoot, 'node_modules/.bin/next' + (process.platform === 'win32' ? '.cmd' : ''));

let nextBin = process.execPath;
let nextArgs = [directNextJs, 'dev', '-p', String(FRONTEND_PORT), '-H', '0.0.0.0'];

if (!fs.existsSync(directNextJs)) {
  if (fs.existsSync(localNextBin)) {
    nextBin = localNextBin;
    nextArgs = ['dev', '-p', String(FRONTEND_PORT), '-H', '0.0.0.0'];
  } else {
    nextBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    nextArgs = ['next', 'dev', '-p', String(FRONTEND_PORT), '-H', '0.0.0.0'];
  }
}

const nextProcess = spawn(nextBin, nextArgs, {
  cwd: appRoot,
  stdio: 'inherit',
  shell: false,
  env: {
    ...process.env,
    NODE_ENV: 'development',
    PORT: String(FRONTEND_PORT),
    BACKEND_PORT: String(BACKEND_PORT),
    INTERNAL_API_URL: `http://127.0.0.1:${BACKEND_PORT}`
  }
});

nextProcess.on('error', (err) => {
  console.error('[TaniCo Next.js] Failed to spawn Next.js process:', err);
});

function cleanShutdown(signal) {
  console.log(`\nShutting down TaniCo processes (${signal})...`);
  
  if (expressServer) {
    try { expressServer.close(); } catch (_) {}
  }

  if (nextProcess && nextProcess.pid) {
    if (process.platform === 'win32') {
      try {
        execSync(`taskkill /pid ${nextProcess.pid} /T /F`, { stdio: 'ignore' });
      } catch (_) {}
    } else {
      try {
        nextProcess.kill('SIGTERM');
      } catch (_) {}
      try {
        cleanupStaleProcesses([FRONTEND_PORT, BACKEND_PORT]);
      } catch (_) {}
    }
  }

  process.exit(0);
}

process.on('SIGINT', () => cleanShutdown('SIGINT'));
process.on('SIGTERM', () => cleanShutdown('SIGTERM'));
process.on('exit', () => {
  if (expressServer) {
    try { expressServer.close(); } catch (_) {}
  }
  if (nextProcess && nextProcess.pid) {
    try { nextProcess.kill('SIGKILL'); } catch (_) {}
  }
});

nextProcess.on('close', (code) => {
  if (expressServer) {
    try { expressServer.close(); } catch (_) {}
  }
  process.exit(code || 0);
});
