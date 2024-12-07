// methods.ts
import { 
    Pool,
    Position,
    NonfungiblePositionManager,
    nearestUsableTick,
    SwapRouter
} from '@uniswap/v3-sdk'
import {
    Token,
    CurrencyAmount,
    Percent
} from '@uniswap/sdk-core'
import type { EVMWalletClient } from "@goat-sdk/core";
import type { z } from "zod";
import { 
    addLiquidityParametersSchema,
    scanPoolsParametersSchema,
    removeLiquidityParametersSchema,
    collectFeesParametersSchema,
    swapExactInputParametersSchema,
    swapExactOutputParametersSchema,
    swapAndAddLiquidityParametersSchema
} from './parameters';
import { computePoolAddress } from '@uniswap/v3-sdk'
import { getContract, encodeFunctionData } from 'viem'
import { publicClient } from './constants'
import { abi as V3PoolABI } from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json'
import { abi as NonfungiblePositionManagerABI } from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json'
import { DexDataQuery } from './queries/dexDataQuery';
  
const FACTORY_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
const abi = V3PoolABI;
const nonfungiblePositionManagerAbi = NonfungiblePositionManagerABI;
const NONFUNGIBLE_POSITION_MANAGER_ADDRESS = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const SWAP_ROUTER_ADDRESS = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45';
const MAX_UINT128 = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF');
  
export async function addLiquidity(
    walletClient: EVMWalletClient,
    parameters: z.infer<typeof addLiquidityParametersSchema>
): Promise<string> {
    const chainId = walletClient.getChain().id ?? 84532;
    
    // Create token instances from passed parameters
    const token0 = new Token(
        chainId,
        parameters.token0.address as `0x${string}`,
        parameters.token0.decimals,
        parameters.token0.symbol,
        parameters.token0.name
    );
    
    const token1 = new Token(
        chainId,
        parameters.token1.address as `0x${string}`,
        parameters.token1.decimals,
        parameters.token1.symbol,
        parameters.token1.name
    );
    
    // Create pool instance
    const poolAddress = computePoolAddress({
        factoryAddress: FACTORY_ADDRESS,
        tokenA: token0,
        tokenB: token1,
        fee: parameters.fee,
    });

    // Fetch current pool state
    const poolContract = getContract({
        address: poolAddress as `0x${string}`,
        abi: abi,
        client: publicClient
    });

    const [slot0, liquidity] = await Promise.all([
        poolContract.read.slot0() as Promise<[bigint, number, number, number, number, boolean, number]>,
        poolContract.read.liquidity() as Promise<bigint>
    ]);

    const pool = new Pool(
        token0,
        token1,
        parameters.fee,
        slot0[0].toString(),
        liquidity.toString(),
        slot0[1]
    );
  
    // Create position
    const position = Position.fromAmounts({
        pool,
        tickLower: parameters.tickLower,
        tickUpper: parameters.tickUpper,
        amount0: parameters.amount0Desired,
        amount1: parameters.amount1Desired,
        useFullPrecision: true,
    });
  
    // Get calldata for minting
    const { calldata, value } = NonfungiblePositionManager.addCallParameters(
        position,
        {
            slippageTolerance: new Percent(parameters.slippageTolerance, 10_000),
            deadline: Math.floor(Date.now() / 1000) + 1200,
            recipient: walletClient.getAddress()
        }
    );
  
    // Execute transaction
    const tx = await walletClient.sendTransaction({
        to: NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
        functionName: 'mint',
        args: [{ 
            token0: position.pool.token0.address,
            token1: position.pool.token1.address,
            fee: position.pool.fee,
            tickLower: position.tickLower,
            tickUpper: position.tickUpper,
            amount0Desired: parameters.amount0Desired,
            amount1Desired: parameters.amount1Desired,
            amount0Min: 0, 
            amount1Min: 0,
            recipient: walletClient.getAddress(),
            deadline: Math.floor(Date.now() / 1000) + 1200
        }],
        value: BigInt(value)
    });
  
    return tx.hash;
}

export async function scanPools(
    walletClient: EVMWalletClient,
    parameters: z.infer<typeof scanPoolsParametersSchema>
): Promise<Array<{
    poolAddress: string,
    token0: Token,
    token1: Token,
    fee: number,
    liquidity: string,
    volume24h: string,
    feeAPR: number
}>> {
    const chainId = walletClient.getChain().id;
    if (!chainId) throw new Error("Chain ID is required");

    const dexQuery = new DexDataQuery();
    return dexQuery.getHighFeePools(
        chainId,
        parameters.minLiquidity,
        parameters.minVolume24h,
        parameters.minFeeAPR,
        parameters.token0,
        parameters.token1
    );
}

export async function removeLiquidity(
    walletClient: EVMWalletClient,
    parameters: z.infer<typeof removeLiquidityParametersSchema>
): Promise<string> {
    const chainId = walletClient.getChain().id;
    if (!chainId) throw new Error("Chain ID is required");

    // Get all positions for the owner
    const dexQuery = new DexDataQuery();
    const positions = await dexQuery.getPositionsByOwner(chainId, walletClient.getAddress());
    
    // Find the specific position
    const position = positions.find(p => p.id === parameters.tokenId.toString());
    if (!position) {
        throw new Error(`Position ${parameters.tokenId} not found`);
    }

    // Calculate minimum amounts based on slippage tolerance
    const amount0Min = position.depositedToken0 * BigInt(100 - parameters.slippageTolerance) / BigInt(100);
    const amount1Min = position.depositedToken1 * BigInt(100 - parameters.slippageTolerance) / BigInt(100);

    // First decrease liquidity
    const decreaseTx = await walletClient.sendTransaction({
        to: NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
        functionName: 'decreaseLiquidity',
        args: [{
            tokenId: BigInt(parameters.tokenId),
            liquidity: BigInt(parameters.liquidity),
            amount0Min,
            amount1Min,
            deadline: BigInt(Math.floor(Date.now() / 1000) + 1200)
        }]
    });

    // Wait for decrease to complete using the public client from constants
    await publicClient.waitForTransactionReceipt({ 
        hash: decreaseTx.hash as `0x${string}` 
    });

    // Then collect the tokens
    const collectTx = await walletClient.sendTransaction({
        to: NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
        functionName: 'collect',
        args: [{
            tokenId: BigInt(parameters.tokenId),
            recipient: walletClient.getAddress(),
            amount0Max: MAX_UINT128,
            amount1Max: MAX_UINT128
        }]
    });

    return collectTx.hash;
}

export async function collectFees(
    walletClient: EVMWalletClient,
    parameters: z.infer<typeof collectFeesParametersSchema>
): Promise<{
    amount0: string,
    amount1: string,
    txHash: string
}> {
    // Implementation coming soon
    throw new Error("Not implemented");
}

export async function getPositions(
    walletClient: EVMWalletClient
): Promise<{
    id: string;
    owner: string;
    liquidity: string;
    token0: Token;
    token1: Token;
    depositedToken0: string;
    depositedToken1: string;
    withdrawnToken0: string;
    withdrawnToken1: string;
    collectedFeesToken0: string;
    collectedFeesToken1: string;
    tickLower: number;
    tickUpper: number;
}[]> {
    const chainId = walletClient.getChain().id;
    if (!chainId) throw new Error("Chain ID is required");

    const dexQuery = new DexDataQuery();
    const positions = await dexQuery.getPositionsByOwner(chainId, walletClient.getAddress());

    return positions.map(pos => ({
        id: pos.id,
        owner: pos.owner,
        liquidity: pos.liquidity.toString(),
        token0: new Token(
            chainId,
            pos.token0.address as `0x${string}`,
            pos.token0.decimals,
            pos.token0.symbol,
            pos.token0.name
        ),
        token1: new Token(
            chainId,
            pos.token1.address as `0x${string}`,
            pos.token1.decimals,
            pos.token1.symbol,
            pos.token1.name
        ),
        depositedToken0: pos.depositedToken0.toString(),
        depositedToken1: pos.depositedToken1.toString(),
        withdrawnToken0: pos.withdrawnToken0.toString(),
        withdrawnToken1: pos.withdrawnToken1.toString(),
        collectedFeesToken0: pos.collectedFeesToken0.toString(),
        collectedFeesToken1: pos.collectedFeesToken1.toString(),
        tickLower: pos.tickLower.tickIdx,
        tickUpper: pos.tickUpper.tickIdx
    }));
}

export async function getPoolInfo(
    walletClient: EVMWalletClient,
    token0Address: string,
    token1Address: string
): Promise<{
    poolAddress: string;
    token0: Token;
    token1: Token;
    fee: number;
    liquidity: string;
    sqrtPrice: string;
    tick: number;
    token0Price: string;
    token1Price: string;
    volumeUSD: string;
    feesUSD: string;
}> {
    const chainId = walletClient.getChain().id;
    if (!chainId) throw new Error("Chain ID is required");

    const dexQuery = new DexDataQuery();
    const pool = await dexQuery.getPool(chainId, token0Address, token1Address);
    
    if (!pool) {
        throw new Error("Pool not found");
    }

    return {
        poolAddress: pool.id,
        token0: new Token(
            chainId,
            pool.token0.id as `0x${string}`,
            parseInt(pool.token0.decimals),
            pool.token0.symbol,
            pool.token0.name
        ),
        token1: new Token(
            chainId,
            pool.token1.id as `0x${string}`,
            parseInt(pool.token1.decimals),
            pool.token1.symbol,
            pool.token1.name
        ),
        fee: parseInt(pool.feeTier),
        liquidity: pool.liquidity,
        sqrtPrice: pool.sqrtPrice,
        tick: parseInt(pool.tick),
        token0Price: pool.token0Price,
        token1Price: pool.token1Price,
        volumeUSD: pool.volumeUSD,
        feesUSD: pool.feesUSD
    };
}

export async function swapExactInput(
    walletClient: EVMWalletClient,
    parameters: z.infer<typeof swapExactInputParametersSchema>
): Promise<{
    amountIn: string,
    amountOut: string,
    txHash: string
}> {
    const chainId = walletClient.getChain().id;
    if (!chainId) throw new Error("Chain ID is required");

    // Get pool info from subgraph
    const dexQuery = new DexDataQuery();
    const pool = await dexQuery.getPool(chainId, parameters.tokenIn.address, parameters.tokenOut.address);
    
    if (!pool) {
        throw new Error("Pool not found");
    }

    // Create token instances
    const tokenIn = new Token(
        chainId,
        parameters.tokenIn.address as `0x${string}`,
        parameters.tokenIn.decimals,
        parameters.tokenIn.symbol,
        parameters.tokenIn.name
    );

    const tokenOut = new Token(
        chainId,
        parameters.tokenOut.address as `0x${string}`,
        parameters.tokenOut.decimals,
        parameters.tokenOut.symbol,
        parameters.tokenOut.name
    );

    // Create exact input parameters
    const swapParams = {
        tokenIn: parameters.tokenIn.address,
        tokenOut: parameters.tokenOut.address,
        fee: parameters.fee,
        recipient: walletClient.getAddress(),
        deadline: Math.floor(Date.now() / 1000) + 1200,
        amountIn: parameters.amountIn,
        amountOutMinimum: parameters.amountOutMinimum,
        sqrtPriceLimitX96: parameters.sqrtPriceLimitX96 || '0'
    };

    // Execute swap
    const tx = await walletClient.sendTransaction({
        to: SWAP_ROUTER_ADDRESS,
        functionName: 'exactInputSingle',
        args: [swapParams]
    });

    return {
        amountIn: parameters.amountIn,
        amountOut: parameters.amountOutMinimum,
        txHash: tx.hash
    };
}

export async function swapExactOutput(
    walletClient: EVMWalletClient,
    parameters: z.infer<typeof swapExactOutputParametersSchema>
): Promise<{
    amountIn: string,
    amountOut: string,
    txHash: string
}> {
    const chainId = walletClient.getChain().id;
    if (!chainId) throw new Error("Chain ID is required");

    // Get pool info from subgraph
    const dexQuery = new DexDataQuery();
    const pool = await dexQuery.getPool(chainId, parameters.tokenIn.address, parameters.tokenOut.address);
    
    if (!pool) {
        throw new Error("Pool not found");
    }

    // Create token instances
    const tokenIn = new Token(
        chainId,
        parameters.tokenIn.address as `0x${string}`,
        parameters.tokenIn.decimals,
        parameters.tokenIn.symbol,
        parameters.tokenIn.name
    );

    const tokenOut = new Token(
        chainId,
        parameters.tokenOut.address as `0x${string}`,
        parameters.tokenOut.decimals,
        parameters.tokenOut.symbol,
        parameters.tokenOut.name
    );

    // Create exact output parameters
    const swapParams = {
        tokenIn: parameters.tokenIn.address,
        tokenOut: parameters.tokenOut.address,
        fee: parameters.fee,
        recipient: walletClient.getAddress(),
        deadline: Math.floor(Date.now() / 1000) + 1200,
        amountOut: parameters.amountOut,
        amountInMaximum: parameters.amountInMaximum,
        sqrtPriceLimitX96: parameters.sqrtPriceLimitX96 || '0'
    };

    // Execute swap
    const tx = await walletClient.sendTransaction({
        to: SWAP_ROUTER_ADDRESS,
        functionName: 'exactOutputSingle',
        args: [swapParams]
    });

    return {
        amountIn: parameters.amountInMaximum,
        amountOut: parameters.amountOut,
        txHash: tx.hash
    };
}

export async function swapAndAddLiquidity(
    walletClient: EVMWalletClient,
    parameters: z.infer<typeof swapAndAddLiquidityParametersSchema>
): Promise<string> {
    const chainId = walletClient.getChain().id;
    if (!chainId) throw new Error("Chain ID is required");

    // Get pool info from subgraph
    const dexQuery = new DexDataQuery();
    const pool = await dexQuery.getPool(chainId, parameters.token0Address, parameters.token1Address);
    
    if (!pool) {
        throw new Error("Pool not found");
    }

    // Create token instances
    const token0 = new Token(
        chainId,
        pool.token0.id as `0x${string}`,
        parseInt(pool.token0.decimals),
        pool.token0.symbol,
        pool.token0.name
    );

    const token1 = new Token(
        chainId,
        pool.token1.id as `0x${string}`,
        parseInt(pool.token1.decimals),
        pool.token1.symbol,
        pool.token1.name
    );

    // Create Pool instance for SDK
    const poolInstance = new Pool(
        token0,
        token1,
        parseInt(pool.feeTier),
        pool.sqrtPrice,
        pool.liquidity,
        parseInt(pool.tick)
    );

    // Calculate optimal swap amount to achieve desired ratio
    const position = Position.fromAmounts({
        pool: poolInstance,
        tickLower: parameters.tickLower,
        tickUpper: parameters.tickUpper,
        amount0: parameters.amount0Desired,
        amount1: parameters.amount1Desired,
        useFullPrecision: true,
    });

    // Create the multicall parameters
    const { calldata, value } = NonfungiblePositionManager.addCallParameters(
        position,
        {
            slippageTolerance: new Percent(parameters.slippageTolerance, 10_000),
            deadline: Math.floor(Date.now() / 1000) + 1200,
            recipient: walletClient.getAddress(),
            createPool: false 
        }
    );

    const tx = await walletClient.sendTransaction({
        to: NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
        functionName: 'addLiquidity',
        args: [calldata],
        value: BigInt(value)
    });

    return tx.hash;
}