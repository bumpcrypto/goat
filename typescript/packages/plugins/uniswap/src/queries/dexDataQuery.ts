import { createClient, cacheExchange, fetchExchange } from '@urql/core';
import NodeCache from 'node-cache';
import { Token } from '@uniswap/sdk-core';

// GraphQL queries
const HIGH_FEE_POOLS_QUERY = `
  query HighFeePools($minLiquidity: Float!, $minVolume: Float!, $minFeeAPR: Float!, $token0: String, $token1: String) {
    pools(
      where: {
        volumeUSD_gt: $minVolume,
        feesUSD_gt: $minLiquidity,
        token0_: { id_in: [$token0] },
        token1_: { id_in: [$token1] }
      },
      orderBy: feesUSD,
      orderDirection: desc,
      first: 50
    ) {
      id
      token0 {
        id
        symbol
        decimals
        name
      }
      token1 {
        id
        symbol
        decimals
        name
      }
      feeTier
      liquidity
      volumeUSD
      feesUSD
      txCount
    }
  }
`;

const NEW_POOLS_QUERY = `
  query NewPools {
    pools(
      orderBy: createdAtTimestamp,
      orderDirection: desc,
      first: 20
    ) {
      id
      token0 {
        id
        symbol
        decimals
        name
      }
      token1 {
        id
        symbol
        decimals
        name
      }
      feeTier
      liquidity
      volumeUSD
      feesUSD
      txCount
      createdAtTimestamp
    }
  }
`;

export interface PoolData {
    poolAddress: string;
    token0: Token;
    token1: Token;
    fee: number;
    liquidity: string;
    volume24h: string;
    feeAPR: number;
    txCount: number;
}

interface Position {
    id: string;
    owner: string;
    liquidity: bigint;
    token0: {
        address: string;
        decimals: number;
        symbol: string;
        name: string;
    };
    token1: {
        address: string;
        decimals: number;
        symbol: string;
        name: string;
    };
    depositedToken0: bigint;
    depositedToken1: bigint;
    withdrawnToken0: bigint;
    withdrawnToken1: bigint;
    collectedFeesToken0: bigint;
    collectedFeesToken1: bigint;
    feeGrowthInside0LastX128: bigint;
    feeGrowthInside1LastX128: bigint;
    tickLower: {
        tickIdx: number;
    };
    tickUpper: {
        tickIdx: number;
    };
}

export class DexDataQuery {
    private cache: NodeCache;
    private client;

    constructor() {
        this.cache = new NodeCache({ stdTTL: 300 }); // 5 minute cache
        this.client = createClient({
            url: "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3-base",
            exchanges: [cacheExchange, fetchExchange],
        });
    }

    async getHighFeePools(
        chainId: number,
        minLiquidity: number,
        minVolume: number,
        minFeeAPR: number,
        token0?: string,
        token1?: string
    ): Promise<PoolData[]> {
        const cacheKey = `high-fee-pools-${minLiquidity}-${minVolume}-${minFeeAPR}-${token0}-${token1}`;
        const cached = this.cache.get<PoolData[]>(cacheKey);
        if (cached) return cached;

        const response = await this.client
            .query(HIGH_FEE_POOLS_QUERY, {
                minLiquidity,
                minVolume,
                minFeeAPR,
                token0,
                token1
            })
            .toPromise();

        if (!response.data) {
            throw new Error("Failed to fetch pool data");
        }

        const pools = this.transformPoolData(response.data.pools, chainId);
        this.cache.set(cacheKey, pools);
        return pools;
    }

    async getNewPools(chainId: number): Promise<PoolData[]> {
        const cacheKey = `new-pools-${chainId}`;
        const cached = this.cache.get<PoolData[]>(cacheKey);
        if (cached) return cached;

        const response = await this.client
            .query(NEW_POOLS_QUERY)
            .toPromise();

        if (!response.data) {
            throw new Error("Failed to fetch new pools data");
        }

        const pools = this.transformPoolData(response.data.pools, chainId);
        this.cache.set(cacheKey, pools);
        return pools;
    }

    private transformPoolData(pools: any[], chainId: number): PoolData[] {
        return pools.map(pool => {
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

            // Calculate fee APR: (feesUSD * 365 / volumeUSD) * 100
            const feeAPR = (parseFloat(pool.feesUSD) * 365 / parseFloat(pool.volumeUSD)) * 100;

            return {
                poolAddress: pool.id,
                token0,
                token1,
                fee: parseInt(pool.feeTier),
                liquidity: pool.liquidity,
                volume24h: pool.volumeUSD,
                feeAPR,
                txCount: parseInt(pool.txCount)
            };
        });
    }

    async getPositionsByOwner(chainId: number, owner: string): Promise<Position[]> {
        const query = `
            query getPositions($owner: String!) {
                positions(where: { owner: $owner }) {
                    id
                    owner
                    liquidity
                    depositedToken0
                    depositedToken1
                    withdrawnToken0
                    withdrawnToken1
                    collectedFeesToken0
                    collectedFeesToken1
                    feeGrowthInside0LastX128
                    feeGrowthInside1LastX128
                    token0 {
                        id
                        decimals
                        symbol
                        name
                    }
                    token1 {
                        id
                        decimals
                        symbol
                        name
                    }
                    tickLower {
                        tickIdx
                    }
                    tickUpper {
                        tickIdx
                    }
                }
            }
        `;

        const response = await this.client
            .query(query, { owner })
            .toPromise();

        if (!response.data?.positions) {
            return [];
        }

        return response.data.positions.map((pos: any) => ({
            id: pos.id,
            owner: pos.owner,
            liquidity: BigInt(pos.liquidity),
            token0: {
                address: pos.token0.id,
                decimals: parseInt(pos.token0.decimals),
                symbol: pos.token0.symbol,
                name: pos.token0.name
            },
            token1: {
                address: pos.token1.id,
                decimals: parseInt(pos.token1.decimals),
                symbol: pos.token1.symbol,
                name: pos.token1.name
            },
            depositedToken0: BigInt(pos.depositedToken0),
            depositedToken1: BigInt(pos.depositedToken1),
            withdrawnToken0: BigInt(pos.withdrawnToken0),
            withdrawnToken1: BigInt(pos.withdrawnToken1),
            collectedFeesToken0: BigInt(pos.collectedFeesToken0),
            collectedFeesToken1: BigInt(pos.collectedFeesToken1),
            feeGrowthInside0LastX128: BigInt(pos.feeGrowthInside0LastX128),
            feeGrowthInside1LastX128: BigInt(pos.feeGrowthInside1LastX128),
            tickLower: {
                tickIdx: parseInt(pos.tickLower.tickIdx)
            },
            tickUpper: {
                tickIdx: parseInt(pos.tickUpper.tickIdx)
            }
        }));
    }

    async getPool(chainId: number, token0Address: string, token1Address: string): Promise<any> {
        const query = `
            query getPool($token0: String!, $token1: String!) {
                pools(
                    where: {
                        token0: $token0,
                        token1: $token1
                    },
                    first: 1
                ) {
                    id
                    token0 {
                        id
                        symbol
                        decimals
                        name
                    }
                    token1 {
                        id
                        symbol
                        decimals
                        name
                    }
                    feeTier
                    liquidity
                    sqrtPrice
                    tick
                    token0Price
                    token1Price
                    volumeUSD
                    feesUSD
                }
            }
        `;

        const response = await this.client
            .query(query, { 
                token0: token0Address.toLowerCase(), 
                token1: token1Address.toLowerCase() 
            })
            .toPromise();

        return response.data?.pools[0] || null;
    }

    async getPoolForSwapAndAdd(poolId: string): Promise<any> {
        const query = `
            query getPoolForSwapAndAdd($poolId: String!) {
                pool(id: $poolId) {
                    id
                    token0 {
                        id
                        decimals
                        symbol
                        name
                    }
                    token1 {
                        id
                        decimals
                        symbol
                        name
                    }
                    feeTier
                    liquidity
                    sqrtPrice
                    tick
                    token0Price
                    token1Price
                    volumeUSD
                    feesUSD
                }
            }
        `;

        const response = await this.client
            .query(query, { poolId })
            .toPromise();

        return response.data?.pool || null;
    }
}
