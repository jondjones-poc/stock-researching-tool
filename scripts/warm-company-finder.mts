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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(join(root, '.env.local'));
loadEnvFile(join(root, '.env'));

const resetCursor = process.argv.includes('--reset');
const batchArg = process.argv.find((a) => a.startsWith('--batch='));
const batchSize = batchArg ? Number(batchArg.split('=')[1]) : 30;

const { runCompanyFinderUpdate } = await import('../src/app/utils/companyFinderUpdate.ts');
console.log(`Warming Company Finder (batchSize=${batchSize}, reset=${resetCursor})…`);
const result = await runCompanyFinderUpdate({
  batchSize,
  resetCursor,
  mode: 'warm',
});
console.log(JSON.stringify(result, null, 2));
process.exit(result.status === 'error' ? 1 : 0);
