#!/usr/bin/env node
/**
 * Add missing common + emerging sectors with US index ETFs and
 * per-country region ETF mappings.
 *
 * Usage:
 *   node scripts/apply-missing-sector-indexes.mjs
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

const EXPECTED = [
  'Healthcare',
  'Pharmaceuticals',
  'Utilities',
  'Materials & Mining',
  'Industrials',
  'Real Estate & REITs',
  'Telecom & Media',
  'Retail',
  'Homebuilders',
  'Semiconductors',
  'Cybersecurity',
  'Clean Energy',
  'Autos & EVs',
  'Uranium & Nuclear',
  'Lithium & Batteries',
  'Gold Miners',
  'Water Infrastructure',
  'Gaming & Esports',
  'Agribusiness',
  'Quantum Computing',
  'Copper & Miners',
  '5G & Connectivity',
];

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  const before = await client.query(
    `SELECT COUNT(*)::int AS n FROM markets WHERE COALESCE(market_group,'sector')='sector'`
  );

  const sql = readFileSync(
    join(__dirname, 'migrations', '040_missing_sector_indexes.sql'),
    'utf8'
  );
  await client.query(sql);
  console.log('Applied 040_missing_sector_indexes.sql');

  const after = await client.query(
    `SELECT id, name, index_symbol, display_order
     FROM markets
     WHERE COALESCE(market_group,'sector')='sector'
       AND name = ANY($1::text[])
     ORDER BY display_order, name`,
    [EXPECTED]
  );
  console.log('\nAdded / updated sectors:');
  console.table(after.rows);

  const missing = EXPECTED.filter(
    (n) => !after.rows.some((r) => r.name === n)
  );
  if (missing.length) {
    console.warn('Still missing:', missing);
  }

  const coverage = await client.query(
    `SELECT m.name, COUNT(r.region_code)::int AS regions
     FROM markets m
     LEFT JOIN market_region_etfs r ON r.market_id = m.id
     WHERE COALESCE(m.market_group,'sector')='sector'
       AND m.name = ANY($1::text[])
     GROUP BY m.name
     ORDER BY m.name`,
    [EXPECTED]
  );
  console.log('\nRegion ETF rows per new sector (expect 10):');
  console.table(coverage.rows);

  const total = await client.query(
    `SELECT COUNT(*)::int AS sectors FROM markets WHERE COALESCE(market_group,'sector')='sector'`
  );
  console.log(
    `\nSector count: ${before.rows[0].n} → ${total.rows[0].sectors}`
  );
} catch (error) {
  console.error('Migration failed:', error.message);
  process.exit(1);
} finally {
  await client.end();
}
