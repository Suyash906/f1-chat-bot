import {
    DataAPIClient,
    CollectionInsertManyError,
    vector,
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

const checkAndCreateCollection = async () => {
    try {
        // Check if collection already exists
        const collections = await db.listCollections();
        const collectionExists = collections.some(col => col.name === ASTRA_DB_COLLECTION);
        
        if (collectionExists) {
            console.log(`Collection '${ASTRA_DB_COLLECTION}' already exists. Skipping creation.`);
            return;
        }
        
        // Create the collection if it doesn't exist
        console.log(`Creating collection '${ASTRA_DB_COLLECTION}'...`);
        const collection = await db.createCollection(
            ASTRA_DB_COLLECTION,
            collection_definition
        );
        console.log(`Collection '${ASTRA_DB_COLLECTION}' created successfully.`);
    } catch (error) {
        console.error('Error checking/creating collection:', error);
        throw error;
    }
};

const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 512,
    chunkOverlap: 100
})

const isValidEmbedding = (embedding: number[]): boolean => {
    // Check if embedding exists and is an array
    if (!embedding || !Array.isArray(embedding)) {
        console.warn('Embedding is not a valid array');
        return false;
    }
    
    // Check if dimension is exactly 1536
    if (embedding.length !== MODEL_DIMENSIONS) {
        console.warn(`Invalid embedding dimension: ${embedding.length}, expected: ${MODEL_DIMENSIONS}`);
        return false;
    }
    
    // Check if all values are valid numbers
    if (embedding.some(val => typeof val !== 'number' || isNaN(val) || !isFinite(val))) {
        console.warn('Embedding contains invalid numeric values');
        return false;
    }
    
    return true;
};

const loadSampleData = async () => {
    const collection = db.collection(ASTRA_DB_COLLECTION)
    let processedChunks = 0;
    let skippedChunks = 0;
    
    for await (const url of f1Data) {
        console.log(`Processing URL: ${url}`);
        try {
            const content = await scrapePage(url)
            const chunks = await splitter.splitText(content)
            
            for await (const chunk of chunks) {
                try {
                    const embedding = await openai.embeddings.create({
                        model: "text-embedding-3-small",
                        input: chunk,
                        encoding_format: "float"
                    })

                    const vector = embedding.data[0].embedding

                    // Validate embedding before inserting
                    if (!isValidEmbedding(vector)) {
                        console.error(`Skipping invalid embedding for chunk: ${chunk.substring(0, 100)}...`);
                        skippedChunks++;
                        continue;
                    }

                    const res = await collection.insertOne({
                        $vector: vector,
                        text: chunk
                    })
                    
                    processedChunks++;
                } catch (error) {
                    console.error(`Error processing chunk from ${url}:`, error);
                    skippedChunks++;
                }
            }
        } catch (error) {
            console.error(`Error processing URL ${url}:`, error);
        }
    }
    
    console.log(`Data loading completed. Processed: ${processedChunks}, Skipped: ${skippedChunks}`);
}

const scrapePage = async (url: string) => {
    const loader = new PuppeteerWebBaseLoader(url, {
        launchOptions: {
            headless: true
        },
        gotoOptions: {
            waitUntil: "domcontentloaded"
        },
        evaluate: async (page, browser) => {
            const result = await page.evaluate(() => document.body.innerHTML)
            await browser.close()
            return result
        }
    })
    return (await loader.scrape())?.replace(/<[^>]*>?/gm, '')
}

checkAndCreateCollection().then(() => loadSampleData())