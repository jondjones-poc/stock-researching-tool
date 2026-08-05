#!/usr/bin/env node
/**
 * Apply Company Finder migration and warm the cache with an initial SEC/quote batch.
 *
 * Usage:
 *   node scripts/apply-company-finder.mjs
 *   node scripts/apply-company-finder.mjs --warm
 *   node scripts/apply-company-finder.mjs --warm --batch=40 --reset
 */
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFile(path) {
  try {
    const content = readFileSync(path, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

loadEnvFile(join(__dirname, '..', '.env.local'));
loadEnvFile(join(__dirname, '..', '.env'));

const password = process.env.SUPABASE_DB_PASSWORD;
if (!password) {
  console.error('SUPABASE_DB_PASSWORD is not set');
  process.exit(1);
}

const projectRef = 'wnazcizhbqjxvbyffyhp';
const connectionString = `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-1-eu-west-1.pooler.supabase.com:6543/postgres`;

const doWarm = process.argv.includes('--warm');
const resetCursor = process.argv.includes('--reset');
const batchArg = process.argv.find((a) => a.startsWith('--batch='));
const batchSize = batchArg ? Number(batchArg.split('=')[1]) : 30;

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
const sql = readFileSync(join(__dirname, 'migrations', '030_company_finder.sql'), 'utf8');
await client.query(sql);
console.log('Applied 030_company_finder.sql');
await client.end();

if (doWarm) {
  const { spawnSync } = await import('child_process');
  const args = ['--yes', 'tsx', join(__dirname, 'warm-company-finder.mts'), `--batch=${batchSize}`];
  if (resetCursor) args.push('--reset');
  const result = spawnSync('npx', args, { stdio: 'inherit', cwd: join(__dirname, '..') });
  process.exit(result.status ?? 1);
} else {
  console.log('Migration only. Warm with: node scripts/apply-company-finder.mjs --warm --reset');
  console.log('Daily cron: POST /api/company-finder/refresh with x-cron-secret');
}
