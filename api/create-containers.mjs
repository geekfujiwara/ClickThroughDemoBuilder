import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';

// Uses DefaultAzureCredential (az login, managed identity, or AZURE_* env vars)
// Set AZURE_STORAGE_ACCOUNT_URL to your storage account endpoint
const accountUrl = process.env.AZURE_STORAGE_ACCOUNT_URL;
if (!accountUrl) {
  console.error('ERROR: Set AZURE_STORAGE_ACCOUNT_URL=https://<account>.blob.core.windows.net');
  process.exit(1);
}
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
