/**
 * hfujiwara@microsoft.com をシステム管理者に設定するスクリプト
 *
 * 使用方法:
 *   cd api && node set-system-admin.mjs
 *
 * 環境変数:
 *   AZURE_STORAGE_CONNECTION_STRING (local.settings.json にて設定)
 */
import { BlobServiceClient } from '@azure/storage-blob';
import { readFileSync } from 'fs';

// local.settings.json から接続文字列を読み取る
let connectionString;
try {
  const settings = JSON.parse(readFileSync('./local.settings.json', 'utf8'));
  connectionString = settings.Values?.STORAGE_CONNECTION_STRING
    || settings.Values?.AZURE_STORAGE_CONNECTION_STRING
    || settings.Values?.AzureWebJobsStorage
    || process.env.AZURE_STORAGE_CONNECTION_STRING
    || process.env.STORAGE_CONNECTION_STRING;
} catch {
  connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || process.env.STORAGE_CONNECTION_STRING;
}

if (!connectionString) {
  console.error('AZURE_STORAGE_CONNECTION_STRING が設定されていません');
  process.exit(1);
}

const CONTAINER = 'masters';
const BLOB_NAME = 'creators.json';
const TARGET_EMAIL = 'hfujiwara@microsoft.com';
const TARGET_ROLE = 'system_admin';

async function main() {
  const blobClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobClient.getContainerClient(CONTAINER);

  // コンテナが存在しない場合は作成
  await containerClient.createIfNotExists();

  const blobRef = containerClient.getBlockBlobClient(BLOB_NAME);

  // 現在のデータを読み込み
  let data;
  try {
    const download = await blobRef.download(0);
    const text = await streamToString(download.readableStreamBody);
    data = JSON.parse(text);
  } catch (e) {
    // blob が存在しない場合は空データで初期化
    console.log('creators.json が存在しません。新規作成します。');
    data = { creators: [] };
  }

  // hfujiwara@microsoft.com を検索してロールを変更
  const creators = data.creators || [];
  let found = false;
  for (const creator of creators) {
    if (creator.email?.toLowerCase() === TARGET_EMAIL) {
      console.log(`Found: ${creator.name} (${creator.email})`);
      console.log(`Current role: ${creator.role || 'undefined'}`);
      creator.role = TARGET_ROLE;
      creator.updatedAt = new Date().toISOString();
      found = true;
      console.log(`Updated role: ${TARGET_ROLE}`);
      break;
    }
  }

  if (!found) {
    // ユーザーが未登録の場合、新規レコードを作成
    console.log(`${TARGET_EMAIL} が見つかりません。新規レコードを作成します。`);
    const newCreator = {
      id: 'hfujiwara',
      name: 'hfujiwara',
      email: TARGET_EMAIL,
      role: TARGET_ROLE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    creators.push(newCreator);
    if (!data.creators) data.creators = creators;
    console.log(`Created new user with role: ${TARGET_ROLE}`);
  }

  // 保存
  const json = JSON.stringify(data);
  await blobRef.upload(json, json.length, {
    blobHTTPHeaders: { blobContentType: 'application/json' },
  });

  console.log('✅ 完了: hfujiwara@microsoft.com を system_admin に設定しました');
}

async function streamToString(readableStream) {
  const chunks = [];
  for await (const chunk of readableStream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
