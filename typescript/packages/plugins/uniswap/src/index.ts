import type { Chain, EVMWalletClient, Plugin } from "@goat-sdk/core";
import { getTools } from "./tools";

export function uniswap(): Plugin<EVMWalletClient> {
    return {
        name: "Uniswap",
        supportsChain: (chain: Chain) => chain.type === "evm",
        supportsSmartWallets: () => true,
        getTools: async (chain: Chain) => {
            const network = chain;

            if (!network.id) {
                throw new Error("Network ID is required");
            }

            return getTools();
        },
    };
}
