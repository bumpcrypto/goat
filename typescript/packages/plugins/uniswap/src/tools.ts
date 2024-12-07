import {
    addLiquidity,
    removeLiquidity,
    collectFees,
    getPositions,
    getPoolInfo,
    swapExactInput,
    swapExactOutput,
    swapAndAddLiquidity
} from "./methods";

import {
    addLiquidityParametersSchema,
    removeLiquidityParametersSchema,
    collectFeesParametersSchema,
    swapExactInputParametersSchema,
    swapExactOutputParametersSchema,
    swapAndAddLiquidityParametersSchema
} from "./parameters";

import type { DeferredTool, EVMWalletClient } from "@goat-sdk/core";
import { z } from "zod";

export function getTools(): DeferredTool<EVMWalletClient>[] {
    const tools: DeferredTool<EVMWalletClient>[] = [
        {
            name: "uniswap_add_liquidity",
            description: "This {{tool}} adds liquidity to a Uniswap V3 pool by creating a new position or increasing an existing one",
            parameters: addLiquidityParametersSchema,
            method: (
                walletClient: EVMWalletClient,
                parameters: z.infer<typeof addLiquidityParametersSchema>
            ) => addLiquidity(walletClient, parameters),
        },
        {
            name: "uniswap_remove_liquidity",
            description: "This {{tool}} removes liquidity from a Uniswap V3 position by specifying the position ID and amount to remove",
            parameters: removeLiquidityParametersSchema,
            method: (
                walletClient: EVMWalletClient,
                parameters: z.infer<typeof removeLiquidityParametersSchema>
            ) => removeLiquidity(walletClient, parameters),
        },
        {
            name: "uniswap_collect_fees",
            description: "This {{tool}} collects accumulated fees from a Uniswap V3 position",
            parameters: collectFeesParametersSchema,
            method: async (
                walletClient: EVMWalletClient,
                parameters: z.infer<typeof collectFeesParametersSchema>
            ) => {
                const result = await collectFees(walletClient, parameters);
                return result.txHash;
            },
        },
        {
            name: "uniswap_get_positions",
            description: "This {{tool}} retrieves all Uniswap V3 positions owned by the current wallet",
            parameters: z.object({}),
            method: async (walletClient: EVMWalletClient) => {
                const positions = await getPositions(walletClient);
                return JSON.stringify(positions);
            },
        },
        {
            name: "uniswap_get_pool_info",
            description: "This {{tool}} retrieves detailed information about a specific Uniswap V3 pool",
            parameters: z.object({
                token0Address: z.string().describe("Address of the first token in the pair"),
                token1Address: z.string().describe("Address of the second token in the pair")
            }),
            method: async (walletClient: EVMWalletClient, parameters: { token0Address: string; token1Address: string }) => {
                const poolInfo = await getPoolInfo(walletClient, parameters.token0Address, parameters.token1Address);
                return JSON.stringify(poolInfo);
            },
        },
        {
            name: "uniswap_swap_exact_input",
            description: "This {{tool}} performs a token swap with an exact input amount on Uniswap V3",
            parameters: swapExactInputParametersSchema,
            method: async (walletClient: EVMWalletClient, parameters: z.infer<typeof swapExactInputParametersSchema>) => {
                const result = await swapExactInput(walletClient, parameters);
                return result.txHash;
            },
        },
        {
            name: "uniswap_swap_exact_output",
            description: "This {{tool}} performs a token swap with an exact output amount on Uniswap V3",
            parameters: swapExactOutputParametersSchema,
            method: async (walletClient: EVMWalletClient, parameters: z.infer<typeof swapExactOutputParametersSchema>) => {
                const result = await swapExactOutput(walletClient, parameters);
                return result.txHash;
            },
        },
        {
            name: "uniswap_swap_and_add_liquidity",
            description: "This {{tool}} performs a token swap and adds liquidity to a Uniswap V3 pool in a single transaction",
            parameters: swapAndAddLiquidityParametersSchema,
            method: (
                walletClient: EVMWalletClient,
                parameters: z.infer<typeof swapAndAddLiquidityParametersSchema>
            ) => swapAndAddLiquidity(walletClient, parameters),
        }
    ];

    return tools;
}
