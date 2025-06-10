// Copyright 2024 Tether Operations Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

"use strict";

import {
  address,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createKeyPairSignerFromPrivateKeyBytes,
  signBytes,
  verifySignature,
  getUtf8Encoder,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  compileTransactionMessage,
  getCompiledTransactionMessageEncoder,
  getBase64Decoder,
  pipe,
  appendTransactionMessageInstructions,
  lamports,
  signTransactionMessageWithSigners,
  getSignatureFromTransaction,
  sendAndConfirmTransactionFactory,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import { getAddMemoInstruction } from "@solana-program/memo";
import * as bip39 from "bip39";
import { HDKey } from "micro-ed25519-hdkey";
import bs58 from "bs58";
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";

/**
 * @typedef {Object} KeyPair
 * @property {string} publicKey - The public key.
 * @property {string} privateKey - The private key.
 */

/**
 * @typedef {Object} SolanaTransaction
 * @property {string} to - The transaction's recipient.
 * @property {number} value - The amount of SOL to send to the recipient (in lamports).
 * @property {string} [data] - The transaction's data in hex format.
 */

/**
 * @typedef {Object} SolanaWalletConfig
 * @property {string} [rpcUrl] - The rpc url of the provider.
 */

const BIP_44_SOL_DERIVATION_PATH_PREFIX = "m/44'/501'";

export default class WalletAccountSolana {
  #account;
  #rpc;
  #rpcSubscriptions;
  #signer;
  #address;
  #seedPhrase;
  #path;
  #config;

  /**
   * Creates a new solana wallet account.
   *
   * @param {string} seedPhrase - The bip-39 mnemonic.
   * @param {string} path - The BIP-44 derivation path (e.g. "0'/0'").
   * @param {SolanaWalletConfig} [config] - The configuration object.
   */
  static async create(seedPhrase, path, config = {}) {
    const instance = new WalletAccountSolana(seedPhrase, path, config);
    await instance.#initialize();
    return instance;
  }

  constructor(seedPhrase, path, config = {}) {

    if (typeof seedPhrase === 'string') {
      if (!bip39.validateMnemonic(seedPhrase)) {
        throw new Error('The seed phrase is invalid.')
      }
      seedPhrase = bip39.mnemonicToSeedSync(seedPhrase)
    }

    this.#seedPhrase = seedPhrase;
    this.#path = path;
    this.#config = config;
  }

  async #initialize() {

    const hd = HDKey.fromMasterSeed(this.#seedPhrase);
    const fullPath = `${BIP_44_SOL_DERIVATION_PATH_PREFIX}/${this.#path}`;

    try {
      const child = hd.derive(fullPath);

      this.#account = {
        privateKey: child.privateKey,
        publicKey: child.publicKey,
        path: fullPath,
      };

      this.#signer = await createKeyPairSignerFromPrivateKeyBytes(
        new Uint8Array(child.privateKey)
      );

      this.#address = this.#signer.address;
    } catch (error) {
      throw error;
    }

    const { rpcUrl, wsUrl } = this.#config;
    if (rpcUrl) {
      this.#rpc = createSolanaRpc(rpcUrl);

    }
    if (wsUrl) {
      this.#rpcSubscriptions = createSolanaRpcSubscriptions(wsUrl);
    }
  }

  /**
   * The derivation path's index of this account.
   *
   * @type {number}
   */
  get index() {
    return parseInt(this.#account.path.split("/").pop());
  }

  /**
   * The derivation path of this account.
   *
   * @type {string}
   */
  get path() {
    return this.#account.path;
  }

  /**
   * The account's key pair.
   *
   * @type {KeyPair}
   */
  get keyPair() {
    return {
      privateKey: Buffer.from(this.#account.privateKey).toString("hex"),
      publicKey: Buffer.from(this.#account.publicKey).toString("hex"),
    };
  }

  /**
   * Returns the account's address.
   *
   * @returns {Promise<string>} The account's address.
   */
  async getAddress() {
    if (!this.#account?.publicKey?.length) {
      throw new Error('The wallet must be initialized to get the address.');
    }
    return this.#address;
  }

  /**
   * Signs a message.
   *
   * @param {string} message - The message to sign.
   * @returns {Promise<string>} The message's signature.
   */
  async sign(message) {
    try {

      if (!this.#account?.privateKey?.length) {
        throw new Error('The wallet must be initialized to sign messages.');
      }
      const privateKeyBytes = new Uint8Array(this.#account.privateKey);

      const keyPair = await createKeyPairSignerFromPrivateKeyBytes(
        privateKeyBytes
      );
      const messageBytes = getUtf8Encoder().encode(message);

      const signedBytes = await signBytes(
        keyPair.keyPair.privateKey,
        messageBytes
      );

      const signature = bs58.encode(signedBytes);
      return signature;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Verifies a message's signature.
   *
   * @param {string} message - The original message.
   * @param {string} signature - The signature to verify.
   * @returns {Promise<boolean>} True if the signature is valid.
   */
  async verify(message, signature) {
    try {
      const messageBytes = getUtf8Encoder().encode(message);
      const signatureBytes = bs58.decode(signature);

      const privateKeyBytes = new Uint8Array(this.#account.privateKey);
      const keyPair = await createKeyPairSignerFromPrivateKeyBytes(
        privateKeyBytes
      );

      const isValid = await verifySignature(
        keyPair.keyPair.publicKey,
        signatureBytes,
        messageBytes
      );

      return isValid;
    } catch (error) {
      return false;
    }
  }

  /**
   * Sends a transaction with arbitrary data.
   *
   * @param {SolanaTransaction} tx - The transaction to send.
   * @returns {Promise<string>} The transaction's hash.
   */
  async sendTransaction(tx) {
    if (!this.#rpc || !this.#rpcSubscriptions) {
      throw new Error(
        "The wallet must be connected to a provider to send transactions."
      );
    }

    try {
      const { to, value, data } = tx;
      const recipient = address(to);

      const { value: latestBlockhash } = await this.#rpc
        .getLatestBlockhash()
        .send();

      const transferInstruction = getTransferSolInstruction({
        source: this.#signer,
        destination: recipient,
        amount: lamports(BigInt(value)),
      });

      const instructions = [transferInstruction];
      if (data) {
        instructions.push(getAddMemoInstruction({ memo: data }));
      }

      const transactionMessage = pipe(
        createTransactionMessage({ version: 0 }),
        (tx) => setTransactionMessageFeePayerSigner(this.#signer, tx),
        (tx) =>
          setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
        (tx) => appendTransactionMessageInstructions(instructions, tx)
      );

      const signedTransaction = await signTransactionMessageWithSigners(
        transactionMessage
      );

      const sendAndConfirm = sendAndConfirmTransactionFactory({
        rpc: this.#rpc,
        rpcSubscriptions: this.#rpcSubscriptions,
      });

      await sendAndConfirm(signedTransaction, {
        commitment: "confirmed",
      });

      const transactionSignature =
        getSignatureFromTransaction(signedTransaction);
      return transactionSignature;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Quotes a transaction.
   *
   * @param {SolanaTransaction} tx - The transaction to quote.
   * @returns {Promise<number>} The transaction's fee (in lamports).
   */
  async quoteTransaction(tx) {
    if (!this.#rpc) {
      throw new Error(
        "The wallet must be connected to a provider to quote transactions."
      );
    }

    try {
      const { to, value, data } = tx;
      const recipient = address(to);

      const { value: latestBlockhash } = await this.#rpc
        .getLatestBlockhash()
        .send();

      const transferInstruction = getTransferSolInstruction({
        source: this.#signer,
        destination: recipient,
        amount: lamports(BigInt(value)),
      });

      const instructions = [transferInstruction];
      if (data) {
        instructions.push(getAddMemoInstruction({ memo: data }));
      }

      const transactionMessage = pipe(
        createTransactionMessage({ version: "legacy" }),
        (m) => setTransactionMessageFeePayerSigner(this.#signer, m),
        (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
        (m) => appendTransactionMessageInstructions(instructions, m)
      );

      const base64EncodedMessage = pipe(
        transactionMessage,
        compileTransactionMessage,
        getCompiledTransactionMessageEncoder().encode,
        getBase64Decoder().decode
      );

      const fee = await this.#rpc.getFeeForMessage(base64EncodedMessage).send();
      return Number(fee.value);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Returns the account's native token balance.
   *
   * @returns {Promise<number>} The native token balance in lamports.
   */
  async getBalance() {
    if (!this.#rpc) {
      throw new Error(
        "The wallet must be connected to a provider to retrieve balances."
      );
    }

    const address = await this.getAddress();
    const response = await this.#rpc.getBalance(address).send();
    const balance = response.value;
    return Number(balance);
  }

  /**
   * Returns the account balance for a specific token.
   *
   * @param {string} tokenAddress - The token mint address.
   * @returns {Promise<number>} The token balance.
   */
  async getTokenBalance(tokenAddress) {
    if (!this.#rpc) {
      throw new Error(
        "The wallet must be connected to a provider to retrieve token balances."
      );
    }

    try {
      const connection = new Connection(this.#config.rpcUrl, "confirmed");
      const tokenMint = new PublicKey(tokenAddress);
      const walletPublicKey = new PublicKey(this.#account.publicKey);

      const tokenAccounts = await connection.getTokenAccountsByOwner(
        walletPublicKey,
        {
          mint: tokenMint,
        }
      );

      const balance = await connection.getTokenAccountBalance(
        tokenAccounts.value[0].pubkey
      );
      return {
        raw: Number(balance.value.amount),
        formatted: balance.value.uiAmount,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Sends a token transaction.
   *
   * @param {Object} params - The transaction parameters.
   * @param {string} params.to - The recipient's address.
   * @param {string} params.tokenMint - The token mint address.
   * @param {number} params.amount - The amount of tokens to send.
   * @returns {Promise<string>} The transaction's hash.
   */
  async sendTokenTransaction({ to, tokenMint, amount }) {
    if (!this.#rpc || !this.#rpcSubscriptions) {
      throw new Error(
        "The wallet must be connected to a provider to send transactions."
      );
    }

    try {
      const connection = new Connection(this.#config.rpcUrl, "confirmed");
      const mint = new PublicKey(tokenMint);
      const recipient = new PublicKey(to);
      const sender = new PublicKey(this.#account.publicKey);

      const programInfo = await connection.getParsedAccountInfo(mint);
      const programId = programInfo?.value?.owner;
      if (!programId) {
        throw new Error("Unable to determine token program ID from mint address.");
      }

      // Create a 64-byte secret key
      const secretKey = new Uint8Array(64);
      const privateKeyBytes = new Uint8Array(this.#account.privateKey);
      const publicKeyBytes = new Uint8Array(this.#account.publicKey);

      // Remove version byte from public key
      const publicKeyWithoutVersion = publicKeyBytes.slice(1);

      // Copy private key to first 32 bytes
      secretKey.set(privateKeyBytes);
      // Copy public key (without version byte) to last 32 bytes
      secretKey.set(publicKeyWithoutVersion, 32);

      // Create keypair from the 64-byte secret key
      const keypair = Keypair.fromSecretKey(secretKey);

      const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        keypair,
        mint,
        sender,
        undefined,
        undefined,
        undefined,
        programId
      );
      let toTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        keypair,
        mint,
        recipient,
        undefined,
        undefined,
        undefined,
        programId
      );


      const transferInstruction = createTransferInstruction(
        fromTokenAccount.address,
        toTokenAccount.address,
        sender,
        amount,
        [],
        programId
      );

      const transaction = new Transaction().add(transferInstruction);

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = sender;

      transaction.sign(keypair);

      const signature = await connection.sendRawTransaction(
        transaction.serialize()
      );

      return signature;
    } catch (error) {
      console.log("Error in sendTokenTransaction:", error.message);
      throw error;
    }
  }
}
