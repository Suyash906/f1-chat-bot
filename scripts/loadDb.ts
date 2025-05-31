import {
    DataAPIClient,
    CollectionInsertManyError,
  } from "@datastax/astra-db-ts";
import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer";
import OpenAI from "openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

import "dotenv/config";

const { 
    ASTRA_DB_NAMESPACE, 
    ASTRA_DB_COLLECTION, 
    ASTRA_DB_API_ENDPOINT, 
    ASTRA_DB_APPLICATION_TOKEN, 
    OPENAI_API_KEY
} = process.env

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
});

const f1Data = [
    "https://en.wikipedia.org/wiki/Formula_One",
    "https://www.formula1.com/en/racing/2025",
    "https://www.formula1.com/en/latest/tags/stats",
    "https://www.motorsport.com/f1/news/",
    "https://www.autosport.com/f1/",
    "http://www.gptoday.com/",
    "https://motorsportstats.com/",
    "https://en.wikipedia.org/wiki/2025_Formula_One_World_Championship",
    "https://en.wikipedia.org/wiki/2025_F1_Academy_season",
    "https://en.wikipedia.org/wiki/List_of_Formula_One_World_Drivers'_Champions",
    "https://en.wikipedia.org/wiki/List_of_Formula_One_Grand_Prix_winners",
    "https://en.wikipedia.org/wiki/List_of_Formula_One_circuits",
    "https://en.wikipedia.org/wiki/2026_Formula_One_World_Championship"
]

// Initialize the client
const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(ASTRA_DB_API_ENDPOINT);
// const collection = db.collection(ASTRA_DB_COLLECTION);

type SimilarityMetric = "dot_product" | "cosine" | "euclidean"
const MODEL_DIMENSIONS = 1536;

// Define the collection
const collection_definition = {
    vector: {
      dimension: MODEL_DIMENSIONS,
      metric: "cosine" as SimilarityMetric,
      service: {
        provider: "openai",
        modelName: "text-embedding-3-small",
        authentication: {
          providerKey: "OPENAI_API_KEY",
        },
      },
    },
  };
  
  (async function () {
    // Create the collection
    const collection = await db.createCollection(
      ASTRA_DB_COLLECTION,
      collection_definition
    );
  })();

  (async () => {
    const colls = await db.listCollections();
    console.log('Connected to AstraDB:', colls);
  })();

const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 512,
    chunkOverlap: 100
})

