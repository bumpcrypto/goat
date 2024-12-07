// types.ts
import type { Token } from '@uniswap/sdk-core';

export interface PoolInfo {
    token0: Token;
    token1: Token;
    fee: number;
    sqrtPriceX96: string;
    liquidity: string;
    tick: number;
}

export interface PositionInfo {
    tokenId: number;
    operator: string;
    token0: string;
    token1: string;
    fee: number;
    tickLower: number;
    tickUpper: number;
    liquidity: string;
}