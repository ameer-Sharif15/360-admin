import { Client, Databases } from 'appwrite';

const endpoint = 'https://fra.cloud.appwrite.io/v1';
const projectId = '69336519000e10827583';
const databaseId = '6933653e00093009e393';
const apiKey =
  'standard_01c8ddf62537f29931af581794f1191d169548c4599c56d9b5458cad75c5477b152e18eeb87a84c130b1702fa564001be766610f7fc11a1b75b5a4e087c515ff2448a838a47c3e4e890a47a2753b33b35ef0a9c95abb78fb971b49bb5207f132200838a15cd74e8c1b00d7d8b5393f0f153a68558082140b4a2bd5b6cf9da958';

export function getClients() {
  if (!endpoint || !projectId || !apiKey) {
    throw new Error('Missing Appwrite configuration for admin dashboard');
  }
  const client = new Client().setEndpoint(endpoint).setProject(projectId);
  // setKey is available in the Node client; typings in the web bundle omit it, so we cast.
  // (client as any).setKey(apiKey);
  const databases = new Databases(client);
  return { client, databases, databaseId };
}
