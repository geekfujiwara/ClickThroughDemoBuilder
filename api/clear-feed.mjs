/**
 * clear-feed.mjs
 * フィードデータ (masters/feed.json) を空配列でリセットするスクリプト。
 *
 * 使い方:
 *   # ローカル (Azurite / 接続文字列)
 *   STORAGE_CONNECTION_STRING="<接続文字列>" node clear-feed.mjs
 *
 *   # Azure 本番 (az login 済みの場合)
 *   AZURE_STORAGE_ACCOUNT_URL="https://<account>.blob.core.windows.net" node clear-feed.mjs
 */

import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';

const connectionString = process.env.STORAGE_CONNECTION_STRING;
const accountUrl       = process.env.AZURE_STORAGE_ACCOUNT_URL;

let blobClient;
if (connectionString && connectionString !== 'UseDevelopmentStorage=true') {
  blobClient = BlobServiceClient.fromConnectionString(connectionString);
} else if (connectionString === 'UseDevelopmentStorage=true') {
  blobClient = BlobServiceClient.fromConnectionString('UseDevelopmentStorage=true');
} else if (accountUrl) {
  blobClient = new BlobServiceClient(accountUrl, new DefaultAzureCredential());
} else {
  console.error('ERROR: STORAGE_CONNECTION_STRING または AZURE_STORAGE_ACCOUNT_URL を設定してください。');
  process.exit(1);
}

const CONTAINER = 'masters';
const BLOB_NAME  = 'feed.json';
const EMPTY_FEED = '[]';

const container = blobClient.getContainerClient(CONTAINER);
const blob      = container.getBlockBlobClient(BLOB_NAME);

console.log(`${CONTAINER}/${BLOB_NAME} を空配列で上書きします...`);
await blob.upload(EMPTY_FEED, Buffer.byteLength(EMPTY_FEED, 'utf-8'), {
  blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' },
});
console.log('完了: フィードデータをクリアしました。');
