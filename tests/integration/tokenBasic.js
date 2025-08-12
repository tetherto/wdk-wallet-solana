'use strict'

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL
} from '@solana/web3.js'
import {
  Token,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token'
import * as bip39 from 'bip39'
import { createKeyPairSignerFromPrivateKeyBytes } from '@solana/kit'
import nacl from 'tweetnacl'
import HDKey from 'micro-key-producer/slip10.js'

const RPC_URL = 'http://127.0.0.1:8899'
const BIP_44_SOL_DERIVATION_PATH_PREFIX = "m/44'/501'"

// Initialize wallet from mnemonic
async function initialize (seedPhrase, index = 0) {
  const seed = bip39.mnemonicToSeedSync(seedPhrase)
  const hd = HDKey.fromMasterSeed(seed)
  const fullPath = `${BIP_44_SOL_DERIVATION_PATH_PREFIX}/0'/0/${index}` // BIP-44 path for Solana accounts
  const child = hd.derive(fullPath, true)

  const signer = await createKeyPairSignerFromPrivateKeyBytes(new Uint8Array(child.privateKey))
  const keyPair = nacl.sign.keyPair.fromSeed(child.privateKey)
  return {
    privateKey: child.privateKey,
    publicKey: child.publicKey,
    path: fullPath,
    feePayer: signer,
    keyPair
  }
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

// Top-level function
export async function createTestToken (seedPhrase) {
  try {
    const connection = new Connection(RPC_URL, 'confirmed')
    const info = await initialize(seedPhrase)
    const keyPair = Keypair.fromSecretKey(info.keyPair.secretKey)
    const recentBlockhash = await connection.getLatestBlockhash()
    const pubKey = keyPair.publicKey
    const airdropSignature = await connection.requestAirdrop(pubKey, LAMPORTS_PER_SOL)
    await connection.confirmTransaction({
      blockhash: recentBlockhash.blockhash,
      lastValidBlockHeight: recentBlockhash.lastValidBlockHeight,
      signature: airdropSignature
    })

    const decimals = 2
    const mint = await createNewMint(connection, keyPair, pubKey, decimals)

    const tokenAccount = await getOrCreateATA(connection, mint, pubKey)

    // Mint 100 tokens (100 * 10^decimals = 10000)
    await mintTokens(mint, tokenAccount, pubKey, 100 * Math.pow(10, decimals))

    return mint.publicKey.toBase58()
  } catch (err) {
    console.error(err)
  }
}

export async function sendCoinToIndexAccount (seedPhrase, index) {
  try {
    const connection = new Connection(RPC_URL, 'confirmed')
    const info = await initialize(seedPhrase, index)
    const keyPair = Keypair.fromSecretKey(info.keyPair.secretKey)

    const recentBlockhash = await connection.getLatestBlockhash()
    const airdropSignature = await connection.requestAirdrop(keyPair.publicKey, LAMPORTS_PER_SOL)
    await connection.confirmTransaction({
      blockhash: recentBlockhash.blockhash,
      lastValidBlockHeight: recentBlockhash.lastValidBlockHeight,
      signature: airdropSignature
    })
    return keyPair.publicKey.toBase58()
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
export async function getTransaction (hash) {
  try {
    const connection = new Connection(RPC_URL, 'confirmed')
    const tx = await connection.getParsedTransaction(hash, {
      maxSupportedTransactionVersion: 0
    })
    return tx
  } catch (err) {
    console.error(err)
    return null
  }
}
