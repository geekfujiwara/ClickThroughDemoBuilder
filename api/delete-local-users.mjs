/**
 * ローカルユーザー削除スクリプト
 * email なし（Entra ID と紐付かない）クリエイターを masters/creators.json から削除します。
 *
 * 使い方:
 *   AZURE_STORAGE_ACCOUNT_URL=https://<account>.blob.core.windows.net \
 *   node api/delete-local-users.mjs
 *
 * または AZURE_STORAGE_CONNECTION_STRING が設定されている場合はそちらが優先されます。
 */
import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const accountUrl = process.env.AZURE_STORAGE_ACCOUNT_URL;

let blobServiceClient;
if (connectionString && !connectionString.startsWith('UseDevelopment')) {
  blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  console.log('Using connection string authentication.');
} else if (accountUrl) {
  blobServiceClient = new BlobServiceClient(accountUrl, new DefaultAzureCredential());
  console.log('Using DefaultAzureCredential (az login / managed identity).');
} else {
  console.error('ERROR: Set AZURE_STORAGE_ACCOUNT_URL or AZURE_STORAGE_CONNECTION_STRING');
  process.exit(1);
}

const container = blobServiceClient.getContainerClient('masters');
const blobClient = container.getBlockBlobClient('creators.json');

// --- Read ---
let data;
try {
  const buf = await blobClient.downloadToBuffer();
  data = JSON.parse(buf.toString('utf-8'));
} catch (e) {
  if (e.statusCode === 404) {
    console.log('creators.json not found — nothing to do.');
    process.exit(0);
  }
  throw e;
}

const before = data.creators ?? [];
console.log(`\nTotal creators before cleanup: ${before.length}`);
before.forEach((c, i) => {
  const hasEmail = !!(c.email && c.email.trim());
  console.log(`  [${i + 1}] ${c.name} | email: ${c.email ?? '(none)'} | role: ${c.role ?? 'designer(legacy)'} => ${hasEmail ? 'KEEP' : 'DELETE (no email = local user)'}`);
});

const after = before.filter((c) => c.email && c.email.trim());

const deleted = before.filter((c) => !(c.email && c.email.trim()));
console.log(`\nTo be deleted (${deleted.length}):`);
deleted.forEach((c) => console.log(`  - ${c.name} (id: ${c.id})`));

if (deleted.length === 0) {
  console.log('No local users found. Nothing to do.');
  process.exit(0);
}

// --- Dry-run guard ---
const dryRun = process.argv.includes('--dry-run');
if (dryRun) {
  console.log('\n[DRY RUN] No changes written. Remove --dry-run to apply.');
  process.exit(0);
}

// --- Write ---
data.creators = after;
const json = JSON.stringify(data);
await blobClient.upload(json, Buffer.byteLength(json, 'utf-8'), {
  blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' },
  overwrite: true,
});

console.log(`\nDone. ${deleted.length} local user(s) removed. ${after.length} Entra user(s) remain.`);
