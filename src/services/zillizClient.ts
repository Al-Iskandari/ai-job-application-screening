import { MilvusClient } from "@zilliz/milvus2-sdk-node";
import { config } from "../config";

if (!config.zillizApiKey) {
  throw new Error("ZILLIZ_API_KEY is not set");
}
if (!config.zillizBaseUrl) {
  throw new Error("ZILLIZ_BASE_URL is not set");
}

export const client = new MilvusClient({
  address: config.zillizBaseUrl,
  token: config.zillizApiKey,
});

export async function queryZilliz(embedding: number[], docTypes: string[]) {
  const results = await client.search({
    collection_name: "system_docs",
    data: [embedding],
    anns_field: "embedding",
    param: { nprobe: 10 },
    limit: 5,
    expr: `doc_type in ["${docTypes.join('","')}"]`,
    output_fields: ["doc_type", "title", "text"]
  });
  return results.results;
}

export async function insertZilliz(embedding: number[], docType: string, title: string, text: string) {
  await client.insert({
    collection_name: "system_docs",
    fields_data: [
      {
        doc_type: docType,
        title,
        text,
        embedding,
      },
    ],
  });
}

export async function ensureCollection(COLLECTION_NAME: string) {
  const collections: any = await client.showCollections();
  const exists = collections.filter((c: any) => c.name === COLLECTION_NAME);

  if (exists.length === 0) {
    console.log(`📦 Creating collection: ${COLLECTION_NAME}`);
    await client.createCollection({
      collection_name: COLLECTION_NAME,
      fields: [
        { name: "id", description: "Document ID", data_type: "Int64", is_primary_key: true, autoID: true },
        { name: "doc_type", description: "Type of system doc", data_type: "VarChar", max_length: 64 },
        { name: "title", description: "Document title", data_type: "VarChar", max_length: 256 },
        { name: "text", description: "Content of the document", data_type: "VarChar", max_length: 2048 },
        { name: "embedding", description: "Vector embedding", data_type: "FloatVector", dim: 768 },
      ],
    });
  }
}
