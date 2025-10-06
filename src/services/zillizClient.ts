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
