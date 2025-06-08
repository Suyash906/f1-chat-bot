import OpenAI from "openai";
import { DataAPIClient } from "@datastax/astra-db-ts";// optional


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

// Initialize the client
const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(ASTRA_DB_API_ENDPOINT);

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();
        const latestMessage = messages[messages.length - 1]?.content;

        let docContext = ""

        const embedding = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: latestMessage,
            encoding_format: "float"
        })

        try {
            const collection = await db.collection(ASTRA_DB_COLLECTION)
            const cursor = collection.find(null, {
                sort: {
                    $vector: embedding.data[0].embedding,
                },
                limit: 10
            })

            const documents = await cursor.toArray();

            const docMap = documents?.map(doc => doc.text)

            docContext = JSON.stringify(docMap);
        } catch(err) {
            console.log(`Error connecting DB ${err}`)
        }

        const template = {
            role: "system",
            content: `You are an AI assistant who knows everything about Formula One.
            Use the below context to augment what you know about Formula One racing.
            The context will provide with the most recent page data from wikipidea,
            the official F1 website and others.
            If the context does not include the information you need to answer based on your existing knowlegde and don't mention the source of your information or what the context does or does not incude.
            Format responses using markdown where applicable and don't return images.
            ------------
            START CONTEXT
            ${docContext}
            END CONTEXT
            ------------
            Question: ${latestMessage}
            ------------
            `
        }

        const response = await openai.chat.completions.create({
            model: "gpt-4",
            stream: true,
            messages: [template, ...messages]
        })

        const stream = new ReadableStream({
            async start(controller) {
              for await (const chunk of response) {
                const content = chunk.choices[0]?.delta?.content;
                if (content) {
                  controller.enqueue(new TextEncoder().encode(content));
                }
              }
              controller.close();
            },
          });
        
        return new Response(stream, {
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Transfer-Encoding": "chunked",
            },
          });

    } catch(err) {
        throw err;
    }
}