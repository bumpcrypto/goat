import { z } from "zod";

// For scanning pools
export const scanPoolsParametersSchema = z.object({
    minLiquidity: z.number()
        .describe("Minimum liquidity in USD"),
    minVolume24h: z.number()
        .describe("Minimum 24h volume in USD"),
    minFeeAPR: z.number()
        .describe("Minimum fee APR percentage"),
    token0: z.optional(z.string())
        .describe("Optional: Filter by token0 address"),
    token1: z.optional(z.string())
        .describe("Optional: Filter by token1 address")
});

// For adding liquidity
export const addLiquidityParametersSchema = z.object({
    // Token information
    token0: z.object({
        address: z.string().describe("Address of token0"),
        decimals: z.number().describe("Decimals of token0"),
        symbol: z.string().describe("Symbol of token0"),
        name: z.string().describe("Name of token0")
    }),
    token1: z.object({
        address: z.string().describe("Address of token1"),
        decimals: z.number().describe("Decimals of token1"),
        symbol: z.string().describe("Symbol of token1"),
        name: z.string().describe("Name of token1")
    }),
    
    // Pool parameters
    fee: z.number().describe("Fee tier of the pool (500, 3000, 10000)"),
    
    // Position parameters
    amount0Desired: z.string().describe("Amount of token0 to add"),
    amount1Desired: z.string().describe("Amount of token1 to add"),
    tickLower: z.number().describe("Lower tick of position range"),
    tickUpper: z.number().describe("Upper tick of position range"),
    slippageTolerance: z.number().describe("Slippage tolerance in bips (1 = 0.01%)")
});

// For removing liquidity
export const removeLiquidityParametersSchema = z.object({
    tokenId: z.number()
        .describe("The NFT token ID of the position"),
    liquidity: z.string()
        .describe("Amount of liquidity to remove (use MaxUint128 for all)"),
    slippageTolerance: z.number()
        .min(0)
        .max(100)
        .describe("Maximum allowed slippage percentage (0-100)")
});

// For collecting fees
export const collectFeesParametersSchema = z.object({
    tokenId: z.number()
        .describe("The NFT token ID of the position")
});

// For swaps
export const swapExactInputParametersSchema = z.object({
    tokenIn: z.object({
        address: z.string().describe("Address of input token"),
        decimals: z.number().describe("Decimals of input token"),
        symbol: z.string().describe("Symbol of input token"),
        name: z.string().describe("Name of input token")
    }),
    tokenOut: z.object({
        address: z.string().describe("Address of output token"),
        decimals: z.number().describe("Decimals of output token"),
        symbol: z.string().describe("Symbol of output token"),
        name: z.string().describe("Name of output token")
    }),
    fee: z.number().describe("Fee tier of the pool (500, 3000, 10000)"),
    amountIn: z.string().describe("Exact amount of input tokens to swap"),
    amountOutMinimum: z.string().describe("Minimum amount of output tokens to receive"),
    sqrtPriceLimitX96: z.string().optional().describe("Price limit for the trade (optional)")
});

export const swapExactOutputParametersSchema = z.object({
    tokenIn: z.object({
        address: z.string().describe("Address of input token"),
        decimals: z.number().describe("Decimals of input token"),
        symbol: z.string().describe("Symbol of input token"),
        name: z.string().describe("Name of input token")
    }),
    tokenOut: z.object({
        address: z.string().describe("Address of output token"),
        decimals: z.number().describe("Decimals of output token"),
        symbol: z.string().describe("Symbol of output token"),
        name: z.string().describe("Name of output token")
    }),
    fee: z.number().describe("Fee tier of the pool (500, 3000, 10000)"),
    amountOut: z.string().describe("Exact amount of output tokens to receive"),
    amountInMaximum: z.string().describe("Maximum amount of input tokens to spend"),
    sqrtPriceLimitX96: z.string().optional().describe("Price limit for the trade (optional)")
});

export const swapAndAddLiquidityParametersSchema = z.object({
    token0Address: z.string()
        .describe("The address of the first token in the pair (must be lower address than token1)"),
    token1Address: z.string()
        .describe("The address of the second token in the pair (must be higher address than token0)"),
    amount0Desired: z.string()
        .describe("The desired amount of token0 to add to the position in wei"),
    amount1Desired: z.string()
        .describe("The desired amount of token1 to add to the position in wei"),
    tickLower: z.number()
        .describe("The lower tick of the position, must be a multiple of the pool's tickSpacing"),
    tickUpper: z.number()
        .describe("The upper tick of the position, must be a multiple of the pool's tickSpacing"),
    slippageTolerance: z.number()
        .min(0)
        .max(10000)
        .describe("The maximum allowed slippage in bips (1 bip = 0.01%). Value between 0-10000")
});