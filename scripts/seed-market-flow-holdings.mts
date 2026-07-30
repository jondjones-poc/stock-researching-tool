import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnvFile(join(root, '.env.local'));
loadEnvFile(join(root, '.env'));
process.env.MARKET_FLOW_MOCK = process.env.MARKET_FLOW_MOCK || 'true';
const { listActiveMarketFlowFunds } = await import('../src/app/utils/marketFlowDb.ts');
const { refreshFundHoldingsIfStale } = await import('../src/app/utils/marketFlowHoldings.ts');
const funds = await listActiveMarketFlowFunds();
let ok = 0;
for (const f of funds) {
  const r = await refreshFundHoldingsIfStale(f.id, f.symbol, true);
  console.log(f.symbol, r);
  ok += r.refreshed ? 1 : 0;
}
console.log(JSON.stringify({ funds: funds.length, refreshed: ok }));
process.exit(0);
