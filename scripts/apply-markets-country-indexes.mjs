#!/usr/bin/env node
/**
 * Apply markets.market_group + seed UK/World/Japan/major country index ETFs.
 *
 * Usage:
 *   node scripts/apply-markets-country-indexes.mjs
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
    join(__dirname, 'migrations', '038_markets_country_indexes.sql'),
    'utf8'
  );
  await client.query(sql);
  console.log('Applied 038_markets_country_indexes.sql');

  const result = await client.query(
    `SELECT market_group, COUNT(*)::int AS n,
            COUNT(index_symbol) FILTER (WHERE index_symbol IS NOT NULL AND btrim(index_symbol) <> '')::int AS with_index
     FROM markets
     GROUP BY market_group
     ORDER BY market_group`
  );
  console.table(result.rows);

  const countries = await client.query(
    `SELECT name, index_symbol FROM markets WHERE market_group = 'country' ORDER BY display_order, name`
  );
  console.log('Country indexes:');
  for (const row of countries.rows) {
    console.log(`  ${row.name} → ${row.index_symbol}`);
  }
} catch (error) {
  console.error('Migration failed:', error.message);
  process.exit(1);
} finally {
  await client.end();
}
