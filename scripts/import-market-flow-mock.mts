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
process.env.MARKET_FLOW_MOCK = 'true';
const { runMarketFlowUpdate } = await import('../src/app/utils/marketFlowUpdate.ts');
const r = await runMarketFlowUpdate({ forceFullHistory: true });
console.log(JSON.stringify({ status: r.status, mode: r.mode, ok: r.fundsOk, fail: r.fundsFailed }, null, 2));
