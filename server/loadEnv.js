import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

function loadEnv() {
  const preservedNodeEnv = process.env.NODE_ENV;
  const currentDir = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));
  const possiblePaths = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(currentDir, '../.env.local'),
    path.resolve(currentDir, '../.env')
  ];

  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      if (typeof process.loadEnvFile === 'function') {
        try {
          process.loadEnvFile(envPath);
        } catch (err) {
          // Continue to manual parse if error
        }
      }
      try {
        const content = fs.readFileSync(envPath, 'utf8');
        content.split('\n').forEach(line => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx > 0) {
              const key = trimmed.slice(0, eqIdx).trim();
              let val = trimmed.slice(eqIdx + 1).trim();
              if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
              }
              if (!process.env[key] && val) {
                process.env[key] = val;
              }
            }
          }
        });
      } catch (e) {
        // Continue
      }
    }
  }

  // Restore or default NODE_ENV to development so Next.js dev server runs properly
  if (preservedNodeEnv) {
    process.env.NODE_ENV = preservedNodeEnv;
  } else if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'development';
  }

  // Ensure DATABASE_URL is never missing to avoid PrismaClientInitializationError
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
    process.env.DATABASE_URL = process.env.DIRECT_URL || 'postgresql://postgres:postgres@localhost:5432/tanico?schema=public';
  }
  if (!process.env.DIRECT_URL || process.env.DIRECT_URL.trim() === '') {
    process.env.DIRECT_URL = process.env.DATABASE_URL;
  }
}

loadEnv();

export default loadEnv;
