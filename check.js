import WalletAccountSolana from './src/wallet-account-solana.js'
import WalletManager from './src/wallet-manager-solana.js'

// const VALID_CONFIG = { rpcUrl: 'http://localhost:8899', wsUrl: 'ws://localhost:8900' } // Use solana-test-validator RPC

const VALID_CONFIG = { rpcUrl: 'https://api.mainnet-beta.solana.com' } // Use solana-test-validator RPC

const main = async () => {
  const wallet = await WalletAccountSolana.create('cook voyage document eight skate token alien guide drink uncle term abuse',
    "0'/0/0", VALID_CONFIG
  )

  const manager = new WalletManager('cook voyage document eight skate token alien guide drink uncle term abuse', VALID_CONFIG)
  // wallet.getAddress().then((address) => {
  //     console.log("Wallet address:", address);
  // }).catch((error) => {
  //     console.error("Error getting address:", error);
  // });

  // wallet.sign("Hello, Solana!").then((signature) => {
  //     console.log("Message signature:", signature);
  // }).catch((error) => {
  //     console.error("Error signing message:", error);
  // });

  // wallet.verify("Hello, Solana!", 'd5103d97b5a795452b96f59d60240c0253fed7fc2bf078412b163b61f900a28e281db5eeae6600c30f5d141f73ad0eb20c9c3b2ca30892676e2b8f74ab2f8906').then((signature) => {
  //     console.log("Message signature:", signature);
  // }).catch((error) => {
  //     console.error("Error signing message:", error);
  // });

  const account = await manager.getAccount(0)
  console.log('Account address:', await account.getAddress())

  await account.getTransactionReceipt('5D517Q8FrU2chRUtmssRmXsrjSZEiyk6HajBKiPqZfakCKkZifGJiJKMTumsrRACnD3N7mVM2Kpk1KFciNB14oE1')
  // account.getTokenBalance('5yHBqbRhR2abg5YMFrJPPnE6yB7UD4igYhgkqgSXGLi3').then((balance) => {
  //   console.log('Token balance:', balance)
  // }).catch((error) => {
  //   console.error('Error getting token balance:', error)
  // })
  // const data = {
  //   recipient: '6m69wRwfLiKxgfvfcTuHs7dxfL4jCjBWdc9dQWUTcn19',
  //   token: 'CCN9jSNzajwWsXsYTw6ez5VhaRqRwEV6osM8dgQrDErT',
  //   amount: 100
  // }

  // account.transfer(data).then((signature) => {
  //   console.log('Transfer signature:', signature)
  // }).catch((error) => {
  //   console.error('Error transferring tokens:', error)
  // })

  // account.sign("Hello, Solana!").then((signature) => {
  //     console.log("Message signature:", signature);
  // }).catch((error) => {
  //     console.error("Error signing message:", error);
  // });
}

main().then(() => {
  console.log('Wallet created successfully')
}).catch((error) => {
  console.error('Error creating wallet:', error)
})
