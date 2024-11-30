import type { Chain, EVMWalletClient, Plugin } from "@goat-sdk/core";
import { z } from "zod";
import { isChainSupportedByFaucet } from "./chains";

export const topUpBalanceParametersSchema = z.object({
    wallet: z.string().optional(),
    amount: z.number().min(1).max(100),
});

export function faucetFactory(apiKey: string) {
    return function faucet(): Plugin<EVMWalletClient> {
        return {
            name: "Crossmint Faucet",
            supportsChain: (chain: Chain) => {
                if (chain.type !== "evm") {
                    return false;
                }

                if (!chain.id) {
                    return false;
                }

                return isChainSupportedByFaucet(chain.id);
            },
            supportsSmartWallets: () => true,
            getTools: async () => {
                return [
                    {
                        name: "top_up_usdc",
                        description: "This {{tool}} tops up your USDC balance",
                        parameters: topUpBalanceParametersSchema,
                        method: async (
                            walletClient: EVMWalletClient,
                            parameters: z.infer<
                                typeof topUpBalanceParametersSchema
                            >
                        ) => {
                            const wallet =
                                parameters.wallet ?? walletClient.getAddress();

                            const resolvedWalletAddress =
                                await walletClient.resolveAddress(wallet);

                            const network = walletClient.getChain();

                            if (!network.id) {
                                throw new Error("Network ID is required");
                            }

                            const chain = getTestnetChainNameById(network.id);

                            if (!chain) {
                                throw new Error(
                                    `Failed to top up balance: Unsupported chain ${network}`
                                );
                            }

                            const options = {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    "X-API-KEY": apiKey,
                                },
                                body: JSON.stringify({
                                    amount: parameters.amount,
                                    currency: "usdc",
                                    chain,
                                }),
                            };

                            const response = await fetch(
                                `https://staging.crossmint.com/api/v1-alpha2/wallets/${resolvedWalletAddress}/balances`,
                                options
                            );

                            if (response.ok) {
                                return "Balance topped up successfully";
                            }

                            throw new Error(
                                `Failed to top up balance: ${await response.text()}`
                            );
                        },
                    },
                ];
            },
        };
    };
}

export function getTestnetChainNameById(chainId: number): string | null {
    const testnetChainIdMap: Record<number, string> = {
        421614: "arbitrum-sepolia",
        84532: "base-sepolia",
        11155111: "ethereum-sepolia",
        11155420: "optimism-sepolia",
        999999999: "zora-sepolia",
    };

    return testnetChainIdMap[chainId] || null;
}