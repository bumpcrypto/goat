import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { getOnChainTools } from "@goat-sdk/adapter-vercel-ai";
import { crossmint } from "@goat-sdk/crossmint";
import { USDC, erc20 } from "@goat-sdk/plugin-erc20";
import { createInterface } from 'readline';
import { uniswap } from "../src";
import dotenv from "dotenv";

dotenv.config();

const WALLET_ADDRESS = process.env.SMART_WALLET_ADDRESS;
const PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY_BASE_GOERLI;
const apiKey = process.env.CROSSMINT_STAGING_API_KEY;
const alchemyApiKey = process.env.ALCHEMY_API_KEY_BASE_SEPOLIA;

if (!WALLET_ADDRESS || !PRIVATE_KEY || !ALCHEMY_API_KEY || !apiKey) {
    throw new Error("Missing environment variables");
}

const rl = createInterface({
    input: process.stdin,
    output: process.stdout
});

const { smartwallet } = crossmint(apiKey);

async function main() {
    const tools = await getOnChainTools({
        wallet: await smartwallet({ 
            address: WALLET_ADDRESS,
            signer: {
                secretKey: PRIVATE_KEY as `0x${string}`,
            }, 
            chain: "base-sepolia",
            provider: alchemyApiKey as string,
        }),
        plugins: [
            erc20({ tokens: [USDC] }),
            uniswap(),
        ],
    });

    console.log("\nš¤ AXE - Your Liquidity Management Assistant\n");
    console.log("Type 'exit' to quit\n");

    while (true) {
        const prompt = await new Promise<string>((resolve) => {
            rl.question('You: ', resolve);
        });

        if (prompt.toLowerCase() === 'exit') {
            console.log('\nGoodbye!');
            rl.close();
            break;
        }

        try {
            const result = await generateText({
                model: openai("gpt-4"),
                tools: tools,
                maxSteps: 5,
                prompt: prompt
            });

            console.log('\nAXE:', result.text, '\n');
        } catch (error) {
            console.error('\nError:', error instanceof Error ? error.message : 'Unknown error occurred', '\n');
        }
    }
}

main().catch(console.error);