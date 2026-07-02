#!/usr/bin/env node
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

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function runFile(filename) {
  const sql = readFileSync(join(__dirname, 'migrations', filename), 'utf8');
  await client.query(sql);
  console.log(`Applied ${filename}`);
}

try {
  await client.connect();
  const path = join(__dirname, 'migrations', '024_fx_rate_cache.sql');
  if (existsSync(path)) {
    await runFile('024_fx_rate_cache.sql');
  }

  const result = await client.query(
    `SELECT base_currency, quote_currency, rate, rate_date::text AS rate_date, fetched_at
     FROM fx_rate_cache
     ORDER BY base_currency, quote_currency`
  );
  console.log('\nFX rate cache:');
  if (result.rows.length === 0) {
    console.log('  (empty — rate will be fetched on first portfolio or /api/usd-to-gbp request)');
  } else {
    for (const row of result.rows) {
      console.log(
        `  ${row.base_currency}→${row.quote_currency}: ${row.rate} (${row.rate_date ?? 'no date'}, cached ${row.fetched_at})`
      );
    }
  }
} catch (error) {
  console.error('Migration failed:', error.message);
  process.exit(1);
} finally {
  await client.end();
}
