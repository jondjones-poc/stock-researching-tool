#!/usr/bin/env node
/**
 * Apply market_region_etfs (per-country sector ETF proxies).
 *
 * Usage:
 *   node scripts/apply-market-region-etfs.mjs
 */
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

try {
  await client.connect();
  const sql = readFileSync(
    join(__dirname, 'migrations', '039_market_region_etfs.sql'),
    'utf8'
  );
  await client.query(sql);
  console.log('Applied 039_market_region_etfs.sql');

  const byRegion = await client.query(
    `SELECT region_code, COUNT(*)::int AS n,
            COUNT(*) FILTER (WHERE is_proxy)::int AS proxies
     FROM market_region_etfs
     GROUP BY region_code
     ORDER BY region_code`
  );
  console.table(byRegion.rows);

  const sample = await client.query(
    `SELECT m.name, r.region_code, r.index_symbol, r.is_proxy
     FROM market_region_etfs r
     JOIN markets m ON m.id = r.market_id
     WHERE r.region_code IN ('uk', 'jp', 'cn')
     ORDER BY r.region_code, m.display_order
     LIMIT 18`
  );
  console.table(sample.rows);
} catch (error) {
  console.error('Migration failed:', error.message);
  process.exit(1);
} finally {
  await client.end();
}
