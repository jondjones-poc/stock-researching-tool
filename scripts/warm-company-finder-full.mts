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

const batchArg = process.argv.find((a) => a.startsWith('--batch='));
const maxArg = process.argv.find((a) => a.startsWith('--max-batches='));
const batchSize = batchArg ? Number(batchArg.split('=')[1]) : 50;
const maxBatches = maxArg ? Number(maxArg.split('=')[1]) : 250;

const { runCompanyFinderUpdate } = await import('../src/app/utils/companyFinderUpdate.ts');
const { getCompanyFinderStats } = await import('../src/app/utils/companyFinderDb.ts');

console.log(
  JSON.stringify(
    {
      note: 'Full universe is fine for DB size (~10k rows, a few MB). Limits are SEC/quote rate + runtime.',
      batchSize,
      maxBatches,
    },
    null,
    2
  )
);

let batches = 0;
let firstCursor: number | null = null;

while (batches < maxBatches) {
  const result = await runCompanyFinderUpdate({
    batchSize,
    resetCursor: batches === 0,
    mode: 'one-off-full',
  });
  batches += 1;
  if (firstCursor == null) firstCursor = result.cursorStart;
  const stats = await getCompanyFinderStats();
  console.log(
    JSON.stringify(
      {
        batch: batches,
        status: result.status,
        processed: result.processed,
        upserted: result.upserted,
        failed: result.failed,
        candidatesInBatch: result.candidates,
        cursorEnd: result.cursorEnd,
        universeSize: result.universeSize,
        dbTotal: stats.total,
        dbCandidates: stats.candidates,
      },
      null,
      2
    )
  );

  // Completed a full pass when cursor wraps to/near start after progress.
  if (result.cursorEnd <= (firstCursor ?? 0) && batches > 1) {
    console.log('Completed full universe pass.');
    break;
  }
  if (result.status === 'error') {
    console.error('Stopping after error:', result.errorMessage);
    process.exit(1);
  }
}

console.log('Done.');
process.exit(0);
