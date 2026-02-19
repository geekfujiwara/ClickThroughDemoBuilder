import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';

// Uses DefaultAzureCredential - set AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_CLIENT_SECRET env vars
// or run with az login / managed identity
const accountUrl = process.env.AZURE_STORAGE_ACCOUNT_URL ?? 'https://stclickthroughprod.blob.core.windows.net';
const client = new BlobServiceClient(accountUrl, new DefaultAzureCredential());
const containers = ['masters', 'projects', 'videos', 'clickthrough-data'];

for (const c of containers) {
  try {
    const r = await client.getContainerClient(c).createIfNotExists();
    console.log(`${c}: ${r.succeeded ? 'created' : 'already exists'}`);
  } catch (e) {
    console.error(`${c}: FAIL - ${e.message}`);
    console.error(`  statusCode: ${e.statusCode}, code: ${e.code}`);
  }
}
