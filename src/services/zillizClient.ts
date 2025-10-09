import { FloatVector, MilvusClient } from "@zilliz/milvus2-sdk-node";
import { config } from "@/config/index.js";
import { v4 as uuidv4 } from "uuid";
import { Collection } from "@zilliz/milvus2-sdk-node/dist/milvus/grpc/Collection.js";
import e from "express";

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

export async function queryZilliz(embedding: FloatVector, docTypes: string[]) {
  try {
    const dataParams = {
      "data": [embedding],
      "anns_field": "embedding",
      "param": { "nprobe": 10 },
      "limit": 3,
    };
    const results = await client.search({
      collection_name: "system_docs",
      data: [dataParams],
      limit: 3,
      expr: `doc_type in ["${docTypes.join('","')}"]`,
      output_fields: ["doc_type", "title", "text"]
    });
    return results.results;
  } catch (err) {
    console.error("Error querying Zilliz:", err);
  }
}

export async function insertZilliz(embedding: FloatVector, docType: string, title: string, text: string) {
  try {
    const data = [
        {
          embedding,
          doc_type: docType,
          title,
          chunk_id: 2,
          text,
        },
      ];

    const results = await client.insert({
      collection_name: "system_docs",
      data: data,
    });
    
    console.log(`Inserted chunk into Zilliz: ${JSON.stringify(results)} record(s)`);

    /*// Flush the data to ensure it's persisted and searchable
    await client.flush({
      collection_names: ["system_docs"],
    });

    //// Load the collection into memory to make it searchable
    await client.loadCollection({
      collection_name: "system_docs",
      replica_number: 1,
    });

    await client.closeConnection();*/
  } catch (err) {
    console.error("Error inserting into Zilliz:", err);
  }
}

export async function ensureCollection(COLLECTION_NAME: string) {
  const collections: any = await client.showCollections();

  if (COLLECTION_NAME in collections) {
    console.log(`📦 Collection ${COLLECTION_NAME} already exists`);
  } else {
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
