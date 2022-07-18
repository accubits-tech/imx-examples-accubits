import { Signer } from '@ethersproject/abstract-signer';
import { BigNumber } from '@ethersproject/bignumber';
import { AlchemyProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import {
  AssetsApi,
  BalancesApi,
  Config,
  CreateTransferResponseV1,
  EthNetwork,
  generateStarkWallet,
  getConfig,
  StarkWallet,
  TokenType,
  TransfersApi,
  UnsignedTransferRequest,
  Workflows
} from '@imtbl/core-sdk';
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import yargs from 'yargs';

dotenv.config({ path: './.env.ropsten' });

const PROVIDER_KEY = process.env.PROVIDER_KEY || '';
const STARK_CONTRACT_ADDRESS = process.env.STARK_CONTRACT_ADDRESS;
const REGISTRATION_CONTRACT_ADDRESS = process.env.REGISTRATION_CONTRACT_ADDRESS;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '';
const BUYER_PRIVATE_KEY = process.env.BUYER_PRIVATE_KEY || '';
const SELLER_PRIVATE_KEY = process.env.SELLER_PRIVATE_KEY || '';
const MINTER_PRIVATE_KEY = process.env.MINTER_PRIVATE_KEY || '';

const provider = new ethers.providers.InfuraProvider('ropsten', PROVIDER_KEY);
const IMX_API_ADDRESS = 'https://api.ropsten.x.immutable.com/v1';

/**
 * Pseudo restricted random number generated used for the client token id during minting.
 * @returns pseudo restricted random number.
 */
function random() {
  const min = 1;
  const max = 1000000000;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Obtain the IMX balance of the wallet.
 * @param user Web3 wallet address registered on IMX
 * @returns Wallet balance in Wei
 */
async function getBalance(config: Config, user: string): Promise<string> {
  const balancesApi = new BalancesApi(config.api);
  const balanceApiResponse = await balancesApi.getBalance({
    owner: user,
    address: 'eth',
  });
  return balanceApiResponse?.data.balance || '';
}

/**
 * Buyer pays the seller the nominated amount in Wei. The payment
 * is by way of a transfer of the ETH token type from the buyer
 * to the seller.
 * @param config config instance created using getConfig from core-sdk
 * @param  workflows Workflows instance from core-sdk
 * @param  buyer buyers Web3 wallet
 * @param  sellerAddress sellers Web3 wallet address
 * @param amount amount in Wei
 * @returns Transfer result which for all intents and purposes we ignore in this demo to illustrate
 * how to check if the transfer is successful without a transaction id.
 */
async function pay(
  config: Config,
  workflows: Workflows,
  buyer: Wallet,
  buyerStarkWallet: StarkWallet,
  sellerAddress: string,
  amount: string,
): Promise<CreateTransferResponseV1> {
  console.log(
    `Buyer ${buyer.address} is sending ${amount} to seller ${sellerAddress}`,
  );
  const transferReqParm: UnsignedTransferRequest = {
    amount: amount,
    receiver: sellerAddress,
    sender: buyer.address,
    token: {
      type: TokenType.ETH,
      data: {
        decimals: 18,
      },
    },
  };
  return await workflows.transfer(buyer, buyerStarkWallet, transferReqParm);
}

/**
 * Return the most recent transfer result between buyer and seller.
 * @param config config instance created using getConfig from core-sdk
 * @param buyerAddress buyers Web3 wallet address
 * @param seller sellers Web3 wallet
 * @returns Most recent transfer between buyer and seller.
 */
async function getMostRecentTransfer(
  config: Config,
  buyerAddress: string,
  seller: Wallet,
): Promise<any | null> {
  const transfersApi = new TransfersApi(config.api);
  const transfers = await transfersApi.listTransfers({
    user: buyerAddress.toLowerCase(),
    receiver: seller.address.toLowerCase(),
    pageSize: 1,
  });
  return transfers?.data?.result[0] || null;
  // for (let transfer of transfers.result) {
  //   return transfer;
  // }
}

/**
 * Validates a transfer between a buyer and seller. So checks the transfer to ensure the direction
 * of the transfer is from buyer to seller for the agreed amount. The variance is a time unit used
 * to ensure that the transfer took place in a particular time window. This is used in place of the
 * Transaction id which isn't available when using link.transfer.
 * @param transfer transfer transaction
 * @param buyerAddress buyer's Web3 wallet address
 * @param seller seller's Web3 wallet address
 * @param amount amount paid in Wei
 * @param variance time variance in seconds
 * @returns true if the payment is the expected one else false.
 */
function validatePayment(
  transfer: any,
  buyerAddress: string,
  sellerAddress: string,
  amount: string,
  variance: Number,
): boolean {
  function timeDiff(transferDate: Date): Number {
    const now = new Date();
    return (now.getTime() - transferDate.getTime()) / 1000;
  }
  const foundPossibleMatchingPayment =
    transfer.user.toLowerCase() === buyerAddress.toLowerCase() &&
    transfer.receiver.toLowerCase() === sellerAddress.toLowerCase() &&
    transfer.token.type === TokenType.ETH &&
    transfer.token.data.quantity.toString() === amount;
  return (
    foundPossibleMatchingPayment &&
    timeDiff(new Date(transfer.timestamp || 0)) < variance
  );
}

/**
 * Transfers an ERC721 token from a seller to a buyer.
 * @param  workflows Workflows instance from core-sdk
 * @param buyerAddress buyer's Web3 wallet address
 * @param seller seller's Web3 wallet
 * @param sellerStarkWallet seller's starkWallet
 * @param tokenId client token id of minted token
 * @returns result of transfer.
 */
async function transferToken(
  workflows: Workflows,
  buyerAddress: string,
  seller: Wallet,
  sellerStarkWallet: StarkWallet,
  tokenId: string,
): Promise<CreateTransferResponseV1> {
  console.log(
    `Seller ${seller.address} is sending token ${tokenId} to buyer ${buyerAddress}`,
  );
  const transferReqParm: UnsignedTransferRequest = {
    amount: BigNumber.from('1').toString(),
    receiver: buyerAddress.toLowerCase(),
    sender: seller.address,
    token: {
      type: TokenType.ERC721,
      data: {
        token_id: tokenId,
        token_address: CONTRACT_ADDRESS,
      },
    },
  };
  return await workflows.transfer(seller, sellerStarkWallet, transferReqParm);
}

/**
 * Returns the user's inventory.
 * @param user user Web3 wallet address
 * @returns buyers inventory.
 */

async function getUserInventory(config: Config, user: string) {
  const assetsApi = new AssetsApi(config.api);
  const listAssetsResponse = await assetsApi.listAssets({
    user: user,
  });
  return listAssetsResponse.data;
}

/**
 * Mint a token to the seller wallet. This is a pre-purchase minting flow.
 * @param  workflows Workflows instance from core-sdk
 * @param  minter Signer object of minter
 * @param  recipient recipient's Web3 wallet address
 * @param  contractAddress address of contract registered with immutableX
 */
async function mint(
  workflows: Workflows,
  minter: Signer,
  recipient: string,
  contractAddress: string,
): Promise<string> {
  const mintResponse = await workflows.mint(minter, {
    contract_address: contractAddress,
    users: [
      {
        user: recipient,
        tokens: [
          {
            id: random().toString(10),
            blueprint: 'none',
          },
        ],
      },
    ],
  });

  return mintResponse.results[0].token_id;
}

/**
 * Displays the balances of the 2 wallets.
 * @param config config instance created using getConfig from core-sdk
 * @param buyer buyer wallet
 * @param seller seller wallet
 */
async function showWalletBalances(
  config: Config,
  buyer: Wallet,
  seller: Wallet,
): Promise<void> {
  let sellerBalance = await getBalance(config, seller.address);
  let buyerBalance = await getBalance(config, buyer.address);
  console.log(
    `Seller Balance ${ethers.utils.formatEther(
      sellerBalance,
    )}, and buyer balance ${ethers.utils.formatEther(buyerBalance)}`,
  );
}

async function main(
  minterPrivateKey: string,
  network: EthNetwork,
): Promise<void> {
  // Configure Core SDK Workflow class
  const config = getConfig(network);
  const workflows = new Workflows(config);
  // Get signer - as per core-sdk
  const provider = new AlchemyProvider(network, process.env.ALCHEMY_API_KEY);
  const minter = new Wallet(minterPrivateKey).connect(provider);
  const seller = new Wallet(SELLER_PRIVATE_KEY).connect(provider);
  const buyer = new Wallet(BUYER_PRIVATE_KEY).connect(provider);
  const price = '1000000000000';

  const buyerStarkWallet = await generateStarkWallet(buyer);
  const sellerStarkWallet = await generateStarkWallet(seller);
  // 1. Start by showing the buyer and sellers IMX wallet balances.
  await showWalletBalances(config, buyer, seller);

  // 2. This example uses a pre-purchase mint flow. So let's mint
  // a token to the seller.
  const tokenId = await mint(
    workflows,
    minter,
    seller.address,
    CONTRACT_ADDRESS,
  );
  console.log(`Token ${tokenId} minted to seller. Now let's pay for it.`);
  console.log('wait ');
  await new Promise(f => setTimeout(f, 3000));
  console.log('wait complete');
  // 3. Buyer pays a nominated amount. Up to the implementer to keep
  // track of the respective token.
  await pay(config, workflows, buyer, buyerStarkWallet, seller.address, price);
  console.log("Payment made. Now let's validate the payment.");
  await new Promise(f => setTimeout(f, 3000));
  // 4. Check to see if the seller received the money
  const mostRecentTransfer = await getMostRecentTransfer(
    config,
    buyer.address,
    seller,
  );
  if (mostRecentTransfer) {
    const paymentReceived = validatePayment(
      mostRecentTransfer,
      buyer.address,
      seller.address,
      price,
      10,
    );
    console.log(`Was payment received: ${paymentReceived}`);
    await new Promise(f => setTimeout(f, 3000));
    if (paymentReceived) {
      // 5. Payment was received, so let's transfer the token to the buyer
      await transferToken(
        workflows,
        buyer.address,
        seller,
        sellerStarkWallet,
        tokenId,
      );
      console.log("Token transfered. Now let's check the user inventory.");
      await new Promise(f => setTimeout(f, 5000));

      // 6. Check the buyers inventory to see if they received the token
      const buyerInventory = await getUserInventory(config, buyer.address);
      for (let item of buyerInventory.result) {
        if ((item as any).token_id === tokenId) {
          console.log('Buyer received item');
        }
      }
    }
  } else {
    throw 'Transfer failed';
  }

  // 7. Finally lets show the balances again, and we should see the respective amount
  // moved from the buyers wallet to the sellers.
  await showWalletBalances(config, buyer, seller);
}
const argv = yargs(process.argv.slice(2))
  .usage('Usage: -k <PRIVATE_KEY> --network <NETWORK>')
  .options({
    k: { describe: 'wallet private key', type: 'string', demandOption: true },
    network: {
      describe: 'network. ropsten or mainnet',
      type: 'string',
      demandOption: true,
    },
  })
  .parseSync();
main(argv.k, argv.network as EthNetwork).catch(err => {
  console.error(err);
});
