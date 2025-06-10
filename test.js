import WalletManagerSolana from "./src/wallet-manager-solana.js";

// Use your Solana account seed phrase here
const TEST_SEED_PHRASE =
  "insect isolate number horror youth head soon car matrix business find rebuild";
console.log("Using seed phrase:", TEST_SEED_PHRASE);

// Solana network configuration
const SOLANA_CONFIG = {
  rpcUrl: "https://api.mainnet-beta.solana.com", // Mainnet
  //rpcUrl: "https://api.devnet.solana.com", // Devnet
};

async function runTests() {
  console.log("Starting Solana Wallet Tests...\n");

  try {
    // Test 1: Wallet Manager Creation
    console.log("Test 1: Creating Wallet Manager...");
    const walletManager = new WalletManagerSolana(
      TEST_SEED_PHRASE,
      SOLANA_CONFIG
    );
    console.log("✓ Wallet Manager created successfully\n");

    // Test 2: Get Random Seed Phrase
    console.log("Test 2: Generating Random Seed Phrase...");
    const randomSeed = WalletManagerSolana.getRandomSeedPhrase();
    console.log("Random seed phrase:", randomSeed);
    console.log("✓ Random seed phrase generated successfully\n");

    // Test 3: Validate Seed Phrase
    console.log("Test 3: Validating Seed Phrase...");
    const isValid = WalletManagerSolana.isValidSeedPhrase(TEST_SEED_PHRASE);
    console.log("Seed phrase is valid:", isValid);
    console.log("✓ Seed phrase validation completed\n");

    // Test 4: Get Account
    console.log("Test 4: Getting Account...");
    const account = await walletManager.getAccount(0);
    const address = await account.getAddress();
    console.log(`Account address: ${address}`);
    console.log(`Account private key: ${account.keyPair.privateKey}`);
    console.log("✓ Account retrieved successfully\n");

    // Test 5: Get Account by Path
    console.log("\nTest 5: Get account by path");
    try {
      const accountByPath = await walletManager.getAccountByPath("0'/0'");
      console.log("Address:", await accountByPath.getAddress());
      console.log("✓ Account retrieved successfully bt path\n");
    } catch (error) {
      console.error("Error getting account by path:", error);
    }

    // Test 6: Get Balance
    console.log("Test 6: Getting Account Balance...");
    const balance = await account.getBalance();
    console.log("Balance (lamports):", balance);
    console.log("Balance (SOL):", balance / 1e9);
    console.log("✓ Balance retrieved successfully\n");

    // Test 7: Get Fee Rates
    console.log("Test 7: Getting Fee Rates...");
    const feeRates = await walletManager.getFeeRates();
    console.log("Fee rates:", feeRates);
    console.log("✓ Fee rates retrieved successfully\n");

    // Test 8: Sign Message
    console.log("Test 8: Signing Message...");
    const message = "Hello, Solana!";
    const signature = await account.sign(message);
    console.log("Message:", message);
    console.log("Signature:", signature);
    console.log("✓ Message signed successfully\n");

    // Test 9: Verify Signature
    console.log("Test 9: Verifying Signature...");
    const isValidSignature = await account.verify(message, signature);
    console.log("Signature is valid:", isValidSignature);
    console.log("✓ Signature verification completed\n");

    // Test 10: Quote Transaction
    console.log("Test 10: Quoting Transaction...");
    const txQuote = await account.quoteTransaction({
      to: "87eEcmWQ844tNQjf35iJh3Tx8kxHryEXMHj2VAzELR4x", // Example recipient
      value: 1000000, // 0.001 SOL in lamports
    });
    console.log("Transaction quote (lamports):", txQuote);
    console.log("✓ Transaction quoted successfully\n");

    {/** 
    // Test 11: Send Transaction
    console.log("Test 11: Sending Transaction...");
    const txHash = await account.sendTransaction({
      to: "87eEcmWQ844tNQjf35iJh3Tx8kxHryEXMHj2VAzELR4x", // Example recipient
      value: 1000000, // 0.001 SOL in lamports
      data: "Test transaction", // Optional memo
    });
    console.log("Transaction hash:", txHash);
    console.log("✓ Transaction sent successfully\n");
    */}

    // Test 12: Get Token Balance (if you have any SPL tokens)
    console.log("Test 12: Getting USDT Token Balance...");
    try {
      const tokenBalance = await account.getTokenBalance(
        "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
      ); // USDT token mint mainnet
      console.log("Token balance (raw):", tokenBalance.raw);
      console.log("Token balance (formatted):", tokenBalance.formatted);
      console.log("✓ Token balance retrieved successfully\n");
    } catch (error) {
      console.log(
        "No token account found (this is normal if you don't have any tokens)\n"
      );
    }

    // Test 14: Send Token Transaction
    console.log("Test 14: Sending Token Transaction...");
    try {
      const txHash = await account.sendTokenTransaction({
        to: "87eEcmWQ844tNQjf35iJh3Tx8kxHryEXMHj2VAzELR4x", // Example recipient
        tokenMint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT token mint
        amount: 1, // Minimum amount (0.000001 USDT)
      });
      console.log("Token transaction hash:", txHash);
      console.log("✓ Token transaction sent successfully\n");
    } catch (error) {
      console.log("Error sending token transaction:", error.message, "\n");
    }

    console.log("All tests completed successfully! 🎉");
  } catch (error) {
    console.error("Test failed:", error);
  }
}

// Run the tests
runTests().catch(console.error);
