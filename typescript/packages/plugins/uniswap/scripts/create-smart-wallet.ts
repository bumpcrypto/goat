import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.CROSSMINT_STAGING_API_KEY;
const walletAddress = process.env.SIGNER_WALLET_ADDRESS;
const walletSignerSecretKey = process.env.SIGNER_WALLET_SECRET_KEY;

if (!apiKey || !walletAddress || !walletSignerSecretKey) {
	throw new Error("Missing environment variables");
}

const formattedPrivateKey = walletSignerSecretKey.startsWith('0x') 
	? walletSignerSecretKey.slice(2) 
	: walletSignerSecretKey;

async function createWallet(signerPublicKey: `0x${string}`, apiKey: string) {
	const response = await fetch(
		"https://staging.crossmint.com/api/v1-alpha2/wallets",
		{
			method: "POST",
			headers: {
				"X-API-KEY": apiKey,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				type: "evm-smart-wallet",
				config: {
					adminSigner: {
						type: "evm-keypair",
						address: signerPublicKey,
					},
				},
			}),
		},
	);

	const data = await response.json();
	if (!response.ok) {
		throw new Error(`API error: ${JSON.stringify(data)}`);
	}
	return data;
}

(async () => {
	try {
		const response = await createWallet(walletAddress as `0x${string}`, apiKey);
		console.log(`Created wallet: ${response.address}`);
		console.log(`Details: ${JSON.stringify(response, null, 2)}`);
	} catch (error) {
		console.error('Failed to create wallet:', error);
		process.exit(1);
	}
})();