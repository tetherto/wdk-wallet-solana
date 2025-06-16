import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL
} from '@solana/web3.js'
import {
  Token,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token'
import { HDKey } from 'micro-ed25519-hdkey'
import * as bip39 from 'bip39'
import { createKeyPairSignerFromPrivateKeyBytes } from '@solana/kit'

const RPC_URL = 'http://127.0.0.1:8899'
const BIP_44_SOL_DERIVATION_PATH_PREFIX = "m/44'/501'"

// Initialize wallet from mnemonic
async function initialize (seedPhrase, index = 0) {
  const seed = bip39.mnemonicToSeedSync(seedPhrase)
  const hd = HDKey.fromMasterSeed(seed.toString('hex'))
  const fullPath = `${BIP_44_SOL_DERIVATION_PATH_PREFIX}/${index}'/0'`
  const child = hd.derive(fullPath)

  const signer = await createKeyPairSignerFromPrivateKeyBytes(new Uint8Array(child.privateKey))
  return {
    privateKey: child.privateKey,
    publicKey: child.publicKey,
    path: fullPath,
    feePayer: signer
  }
}

// Create 64-byte secret key for Keypair.fromSecretKey
function getKeypairFromPrivateKey (privateKey, publicKey) {
  const secretKey = new Uint8Array(64)
  secretKey.set(new Uint8Array(privateKey), 0)
  secretKey.set(new Uint8Array(publicKey).slice(1), 32) // remove version byte
  return Keypair.fromSecretKey(secretKey)
}

// Create Mint using Token class
async function createNewMint (connection, payer, mintAuthority, decimals) {
  const mint = await Token.createMint(
    connection,
    payer,
    mintAuthority,
    null,
    decimals,
    TOKEN_PROGRAM_ID
  )
  return mint
}

// Get/Create ATA
async function getOrCreateATA (connection, token, owner) {
  return await token.getOrCreateAssociatedAccountInfo(owner)
}

// Mint Tokens
async function mintTokens (token, destination, authority, amount) {
  await token.mintTo(destination.address, authority, [], amount)
}

// // Transfer Tokens
// async function transferTokens(token, source, destination, owner, amount) {
//   await token.transfer(source, destination, owner, [], amount)
// }

// Get Balance
// async function getTokenBalance(connection, tokenAccount) {
//   const info = await connection.getTokenAccountBalance(tokenAccount)
//   return Number(info.value.amount) / Math.pow(10, info.value.decimals)
// }

// Top-level function
export async function createTestToken (seedPhrase) {
  try {
    const connection = new Connection(RPC_URL, 'confirmed')
    const { privateKey, publicKey } = await initialize(seedPhrase)
    const keypair = getKeypairFromPrivateKey(privateKey, publicKey)

    const recentBlockhash = await connection.getLatestBlockhash()
    const airdropSignature = await connection.requestAirdrop(keypair.publicKey, LAMPORTS_PER_SOL)
    await connection.confirmTransaction({
      blockhash: recentBlockhash.blockhash,
      lastValidBlockHeight: recentBlockhash.lastValidBlockHeight,
      signature: airdropSignature
    })

    const decimals = 2
    const mint = await createNewMint(connection, keypair, keypair.publicKey, decimals)
    console.log('Mint:', mint.publicKey.toBase58())

    const tokenAccount = await getOrCreateATA(connection, mint, keypair.publicKey)
    console.log('Token Account:', tokenAccount.address.toBase58())

    // Mint 100 tokens (100 * 10^decimals = 10000)
    await mintTokens(mint, tokenAccount, keypair.publicKey, 100 * Math.pow(10, decimals))
    console.log('Minted tokens')

    // const secondAccount = await initialize(seedPhrase, 1)

    // const destPubkey = new PublicKey(secondAccount.publicKey)
    // console.log('Second Account Public Key:', destPubkey.toBase58())

    // const destinationTokenAccount = await getOrCreateATA(connection, mint, destPubkey)
    // console.log('Destination Token Account:', destinationTokenAccount.address.toBase58())

    // //Transfer 12 tokens (12 * 10^decimals)
    // await transferTokens(mint, tokenAccount.address, destinationTokenAccount.address, keypair.publicKey, 12 * Math.pow(10, decimals))
    // console.log('Transferred tokens')

    // const balance = await getTokenBalance(connection, tokenAccount.address)
    // console.log('Sender Token Balance:', balance)

    // const destBalance = await getTokenBalance(connection, destinationTokenAccount.address)
    // console.log('Destination Token Balance:', destBalance)

    return mint.publicKey.toBase58()
  } catch (err) {
    console.error(err)
  }
}

export async function sendCoinToIndexAccount (seedPhrase, index) {
  try {
    const connection = new Connection(RPC_URL, 'confirmed')
    const { privateKey, publicKey } = await initialize(seedPhrase, index)
    const keypair = getKeypairFromPrivateKey(privateKey, publicKey)

    const recentBlockhash = await connection.getLatestBlockhash()
    const airdropSignature = await connection.requestAirdrop(keypair.publicKey, LAMPORTS_PER_SOL)
    await connection.confirmTransaction({
      blockhash: recentBlockhash.blockhash,
      lastValidBlockHeight: recentBlockhash.lastValidBlockHeight,
      signature: airdropSignature
    })
    return keypair.publicKey.toBase58()
  } catch (err) {
    console.error(err)
  }
}

export async function confirmTestTransaction (signature) {
  try {
    const connection = new Connection(RPC_URL, 'confirmed')

    const recentBlockhash = await connection.getLatestBlockhash()
    await connection.confirmTransaction({
      blockhash: recentBlockhash.blockhash,
      lastValidBlockHeight: recentBlockhash.lastValidBlockHeight,
      signature
    })
    return true
  } catch (err) {
    console.error(err)
    return false
  }
}

// createTestToken("uncover learn cheese meat fire tired enact melt heart million soda zebra", "BksCCQkPwNBc4Ku32ESe7k9p6aUxxUYnwRr7LPJh3JA3");
