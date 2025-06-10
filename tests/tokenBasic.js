import {
    Connection,
    PublicKey,
    Keypair,
    LAMPORTS_PER_SOL
} from "@solana/web3.js";
import {
    createMint,
    getOrCreateAssociatedTokenAccount,
    mintTo,
    transfer,
    getAccount,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { HDKey } from "micro-ed25519-hdkey";
import * as bip39 from "bip39";
import { createKeyPairSignerFromPrivateKeyBytes } from "@solana/kit";

const RPC_URL = "http://127.0.0.1:8899";


// 1. Create Mint
async function createNewMint(connection, payer, mintAuthority, decimals, programId = TOKEN_PROGRAM_ID) {
    const mint = await createMint(
        connection,
        payer,
        mintAuthority,
        null, // freeze authority
        decimals,
        undefined,
        undefined,
        programId
    );
    return mint;
}

// 2. Create or Get Associated Token Account
async function getOrCreateATA(connection, payer, mint, owner, programId = TOKEN_PROGRAM_ID) {
    const mintPubkey = new PublicKey(mint);
    const ata = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mintPubkey,
        owner,
        false,
        undefined,
        undefined,
        programId
    );
    return ata;
}

// 3. Mint Tokens
async function mintTokens(connection, payer, mint, destination, authority, amount, programId = TOKEN_PROGRAM_ID) {
    const mintPubkey = new PublicKey(mint);
    const destinationPubkey = new PublicKey(destination);
    return await mintTo(
        connection,
        payer,
        mintPubkey,
        destinationPubkey,
        authority,
        amount,
        [],
        programId
    );
}

// 4. Transfer Tokens
async function transferTokens(connection, payer, source, destination, owner, amount) {
    const sourcePubkey = new PublicKey(source);
    const destinationPubkey = new PublicKey(destination);

    const accountInfo = await getAccount(connection, sourcePubkey);
    const tokenProgramId = accountInfo.programId;
    return await transfer(
        connection,
        payer,
        sourcePubkey,
        destinationPubkey,
        owner,
        amount,
        [],
        tokenProgramId
    );
}

// 5. Get Token Balance
async function getTokenBalance(connection, tokenAccount) {
    const tokenAccountPubkey = new PublicKey(tokenAccount);
    const acc = await getAccount(connection, tokenAccountPubkey);
    return Number(acc.amount) / Math.pow(10, acc.decimals || 0);
}

const BIP_44_SOL_DERIVATION_PATH_PREFIX = "m/44'/501'";

async function initialize(seedPhrase) {
    const seed = bip39.mnemonicToSeedSync(
        seedPhrase
    );
    const hd = HDKey.fromMasterSeed(seed.toString("hex"));
    const fullPath = `${BIP_44_SOL_DERIVATION_PATH_PREFIX}/0'/0'`;


    const child = hd.derive(fullPath);

    const signer = await createKeyPairSignerFromPrivateKeyBytes(
        new Uint8Array(child.privateKey)
    );
    return {
        privateKey: child.privateKey,
        publicKey: child.publicKey,
        path: fullPath,
        feePayer: signer,
    };

}
function getKeypairFromPrivateKey(privateKey, publicKey) {
    // Create a 64-byte secret key
    const secretKey = new Uint8Array(64);
    const privateKeyBytes = new Uint8Array(privateKey);
    const publicKeyBytes = new Uint8Array(publicKey);

    // Remove version byte from public key
    const publicKeyWithoutVersion = publicKeyBytes.slice(1);

    // Copy private key to first 32 bytes
    secretKey.set(privateKeyBytes);
    // Copy public key (without version byte) to last 32 bytes
    secretKey.set(publicKeyWithoutVersion, 32);

    // Create keypair from the 64-byte secret key
    const keypair = Keypair.fromSecretKey(secretKey);

    return keypair;
}


export async function createTestToken(seedPhrase, destination) {
    try {
        const connection = new Connection(RPC_URL, "confirmed");

        const { feePayer, privateKey, publicKey } = await initialize(seedPhrase);
        const keypair = getKeypairFromPrivateKey(privateKey, publicKey);
        const recentBlockhash = await connection.getLatestBlockhash();

        const airdropSignature = await connection.requestAirdrop(
            keypair.publicKey,
            LAMPORTS_PER_SOL
        );
        await connection.confirmTransaction({
            blockhash: recentBlockhash.blockhash,
            lastValidBlockHeight: recentBlockhash.lastValidBlockHeight,
            signature: airdropSignature
        });

        const decimals = 2;
        const mint = await createNewMint(connection, keypair, keypair.publicKey, decimals);
        console.log("Mint:", mint.toBase58());


        const tokenAccount = await getOrCreateATA(connection, keypair, mint, keypair.publicKey);
        console.log("Token Account:", tokenAccount.address.toBase58());



        // Mint 100 tokens (100 * 10^decimals = 10000)
        await mintTokens(connection, keypair, mint, tokenAccount.address, keypair.publicKey, 100 * Math.pow(10, decimals));
        console.log("Minted tokens");

        const destinationTokenAccount = await getOrCreateATA(connection, keypair, mint, new PublicKey(destination));
        console.log("Destination Token Account:", destinationTokenAccount.address.toBase58());

        // Transfer 12 tokens (12 * 10^decimals)
        await transferTokens(connection, keypair, tokenAccount.address, destinationTokenAccount.address, keypair.publicKey, 12 * Math.pow(10, decimals));
        console.log("Transferred tokens");

        const balance = await getTokenBalance(connection, tokenAccount.address);
        console.log("Sender Token Balance:", balance);

        const destBalance = await getTokenBalance(connection, destinationTokenAccount.address);
        console.log("Destination Token Balance:", destBalance);
        return mint.toBase58();
    } catch (err) {
        console.error(err);
    }
}

// createTestToken("uncover learn cheese meat fire tired enact melt heart million soda zebra", "BksCCQkPwNBc4Ku32ESe7k9p6aUxxUYnwRr7LPJh3JA3");