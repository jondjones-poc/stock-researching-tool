#!/usr/bin/env node
/**
 * Apply markets.index_symbol migration and seed sector ETF proxies.
 *
 * Usage:
 *   node scripts/apply-markets-index-symbol.mjs
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

/** Fallback name patterns when exact seed match missed (first match wins). */
const FALLBACK_PATTERNS = [
  [/semiconductor|ai\b|chip/i, 'SOXX'],
  [/cloud/i, 'IGV'],
  [/big tech|technology|\bsoftware\b/i, 'XLK'],
  [/staple/i, 'XLP'],
  [/discretionary|retail(?!.*estate)/i, 'XLY'],
  [/biotech/i, 'XBI'],
  [/health/i, 'XLV'],
  [/bank|financial/i, 'XLF'],
  [/insurance|asset manage/i, 'KIE'],
  [/energy|oil|gas/i, 'XLE'],
  [/utilit/i, 'XLU'],
  [/industrial/i, 'XLI'],
  [/material|mining|metal/i, 'XLB'],
  [/real estate|reit/i, 'XLRE'],
  [/telecom|media|communication/i, 'XLC'],
  [/defense|aerospace/i, 'ITA'],
  [/transport/i, 'IYT'],
  [/auto|ev\b|electric vehicle/i, 'DRIV'],
  [/payment|fintech/i, 'FINX'],
  [/emerging/i, 'EEM'],
  [/drone|robot/i, 'BOTZ'],
  [/restaurant|resturant/i, 'EATZ'],
  [/space|satellite/i, 'UFO'],
];

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  const sql = readFileSync(
    join(__dirname, 'migrations', '036_markets_index_symbol.sql'),
    'utf8'
  );
  await client.query(sql);
  console.log('Applied 036_markets_index_symbol.sql');

  const markets = await client.query(
    `SELECT id, name, index_symbol FROM markets ORDER BY display_order, name`
  );

  let filled = 0;
  for (const row of markets.rows) {
    if (row.index_symbol && String(row.index_symbol).trim()) continue;
    const match = FALLBACK_PATTERNS.find(([re]) => re.test(row.name));
    if (!match) continue;
    await client.query(
      `UPDATE markets SET index_symbol = $1, updated_at = NOW() WHERE id = $2`,
      [match[1], row.id]
    );
    filled += 1;
    console.log(`  fallback: ${row.name} → ${match[1]}`);
  }

  const result = await client.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(index_symbol) FILTER (WHERE index_symbol IS NOT NULL AND btrim(index_symbol) <> '')::int AS with_index
     FROM markets`
  );
  console.log(
    `markets: ${result.rows[0].with_index}/${result.rows[0].total} have index_symbol` +
      (filled ? ` (${filled} via fallback)` : '')
  );
} catch (error) {
  console.error('Migration failed:', error.message);
  process.exit(1);
} finally {
  await client.end();
}
