#!/usr/bin/env node
import { readFileSync } from 'fs';
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
    // optional file
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

const sql = readFileSync(
  join(__dirname, 'migrations', '018_precious_metals_watchlist.sql'),
  'utf8'
);

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(sql);
  const result = await client.query(
    `SELECT symbol, name, category FROM dashboard_watchlist
     WHERE category = 'PRECIOUS METALS'
     ORDER BY display_order, symbol`
  );
  console.log('PRECIOUS METALS watchlist:');
  for (const row of result.rows) {
    console.log(`  ${row.symbol}: ${row.name}`);
  }
} catch (error) {
  if (error.code === '42P01') {
    console.error('dashboard_watchlist table does not exist — config fallback will still show PRECIOUS METALS.');
    process.exit(0);
  }
  console.error('Migration failed:', error.message);
  process.exit(1);
} finally {
  await client.end();
}
