#!/usr/bin/env node
/**
 * Apply Market Flow Tracker migration, seed 10 markets, and optionally import prices.
 *
 * Usage:
 *   node scripts/apply-market-flow-tracker.mjs
 *   node scripts/apply-market-flow-tracker.mjs --seed-only
 *   MARKET_FLOW_MOCK=true node scripts/apply-market-flow-tracker.mjs --import
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

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const seedOnly = process.argv.includes('--seed-only');
const doImport = process.argv.includes('--import');

const SEED = [
  ['united-states', 'United States', 'Americas', 1, 'SPY', 'SPDR S&P 500 ETF', 'Large-cap US equities (S&P 500)', 'IWM', 'iShares Russell 2000 ETF', 'Small-cap US equities (Russell 2000)'],
  ['united-kingdom', 'United Kingdom', 'Europe', 2, 'EWU', 'iShares MSCI United Kingdom ETF', 'Large/mid-cap UK equities', 'EWUS', 'iShares MSCI United Kingdom Small-Cap ETF', 'Small-cap UK equities'],
  ['japan', 'Japan', 'Asia', 3, 'EWJ', 'iShares MSCI Japan ETF', 'Large/mid-cap Japanese equities', 'SCJ', 'iShares MSCI Japan Small-Cap ETF', 'Small-cap Japanese equities'],
  ['germany', 'Germany', 'Europe', 4, 'EWG', 'iShares MSCI Germany ETF', 'Large/mid-cap German equities', 'FGM', 'First Trust Germany AlphaDEX ETF', 'German equities with smaller-cap tilt'],
  ['france', 'France', 'Europe', 5, 'EWQ', 'iShares MSCI France ETF', 'Large/mid-cap French equities', 'FLFR', 'Franklin FTSE France ETF', 'Broad French equity exposure'],
  ['canada', 'Canada', 'Americas', 6, 'EWC', 'iShares MSCI Canada ETF', 'Large/mid-cap Canadian equities', 'CNDA', 'IQ Canada Small Cap ETF', 'Small-cap Canadian equities'],
  ['australia', 'Australia', 'Asia Pacific', 7, 'EWA', 'iShares MSCI Australia ETF', 'Large/mid-cap Australian equities', 'KROO', 'IQ Australia Small Cap ETF', 'Small-cap Australian equities'],
  ['china', 'China', 'Asia', 8, 'MCHI', 'iShares MSCI China ETF', 'Large/mid-cap Chinese equities', 'ECNS', 'iShares MSCI China Small-Cap ETF', 'Small-cap Chinese equities'],
  ['india', 'India', 'Asia', 9, 'INDA', 'iShares MSCI India ETF', 'Large/mid-cap Indian equities', 'SMIN', 'iShares MSCI India Small-Cap ETF', 'Small-cap Indian equities'],
  ['emerging-markets', 'Emerging Markets', 'Global', 10, 'EEM', 'iShares MSCI Emerging Markets ETF', 'Large/mid-cap EM equities', 'EEMS', 'iShares MSCI Emerging Markets Small-Cap ETF', 'Small-cap EM equities'],
];

async function seed() {
  for (const row of SEED) {
    const [slug, name, region, sortOrder, lSym, lName, lDesc, sSym, sName, sDesc] = row;
    const m = await client.query(
      `INSERT INTO market_flow_markets (slug, name, region, sort_order)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, region=EXCLUDED.region, sort_order=EXCLUDED.sort_order
       RETURNING id`,
      [slug, name, region, sortOrder]
    );
    const marketId = m.rows[0].id;
    for (const [cap, symbol, fname, desc] of [
      ['large', lSym, lName, lDesc],
      ['small', sSym, sName, sDesc],
    ]) {
      const f = await client.query(
        `INSERT INTO market_flow_funds (market_id, cap_type, symbol, name, description, is_active)
         VALUES ($1,$2,$3,$4,$5,true)
         ON CONFLICT (market_id, cap_type) DO UPDATE SET
           symbol=EXCLUDED.symbol, name=EXCLUDED.name, description=EXCLUDED.description, is_active=true
         RETURNING id`,
        [marketId, cap, symbol, fname, desc]
      );
      await client.query(
        `INSERT INTO market_flow_fund_meta (fund_id, status) VALUES ($1,'pending')
         ON CONFLICT (fund_id) DO NOTHING`,
        [f.rows[0].id]
      );
    }
  }
  console.log(`Seeded ${SEED.length} markets (20 funds)`);
}

try {
  await client.connect();
  if (!seedOnly) {
    const sqlPath = join(__dirname, 'migrations', '026_market_flow_tracker.sql');
    if (!existsSync(sqlPath)) throw new Error('Missing 026_market_flow_tracker.sql');
    await client.query(readFileSync(sqlPath, 'utf8'));
    console.log('Applied 026_market_flow_tracker.sql');
  }
  await seed();

  if (doImport) {
    console.log('Import prices via app API (set MARKET_FLOW_MOCK=true for offline):');
    console.log('  curl -X POST http://localhost:3000/api/market-flow/refresh -H "x-cron-secret: $KEEPALIVE_SECRET"');
  }

  const count = await client.query('SELECT COUNT(*)::int AS n FROM market_flow_markets');
  console.log(`markets in DB: ${count.rows[0].n}`);
} catch (error) {
  console.error('Failed:', error.message);
  process.exit(1);
} finally {
  await client.end();
}
