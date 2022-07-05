/*
 Note: this script is only meant to serve as an example of the trading flow. Due to the nature of on-chain
 transactions, it may not work by itself.
 
 Prerequisite: wallet with test eth on ropsten network
 
 Trading flow:
 - register two wallets on Immutable X
 - mint nft to wallet 2
 - create sell order from wallet 2 for the minted nft
 - buy nft using wallet 1 (create trade)
 
 Interaction with the API under the hood:
 - sell order -> createOrder calls get /signable-order-details then signs it to create a sell order
 - buy order -> createTrade calls get /signable-order-details for a matching opposite buy order for 
                the given sell order, then signs and submits to the /trades endpoint
 */

import { ethers } from 'ethers';
import {
  ImmutableXClient,
  ImmutableXWallet,
  serializeSignature,
  sign,
} from '@imtbl/imx-sdk';
import {
  ERC721TokenType,
  MintableERC721TokenType,
  ImmutableMethodParams,
  ETHTokenType,
} from '@imtbl/imx-sdk';
import { getClient } from '../utils/client';
import yargs from 'yargs';
import {
  EthNetwork,
  generateStarkWallet,
  getConfig,
  signRaw,
  UsersApi,
  DepositsApi,
  BalancesApi,
  MintsApi,
  MintsApiMintTokensRequest,
  Config,
  AssetsApi,
  OrdersApi,
} from '@imtbl/core-sdk';
import { AlchemyProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';

/**
 * Registers a user on Immutable X
 */
// async function registerUser(client: ImmutableXClient, wallet: ethers.Wallet)
//     : Promise<string> {
//     const starkKey = await new ImmutableXWallet(wallet).controller.account('starkex', 'immutablex', '1');
//     return client.register({
//         etherKey: wallet.address,
//         starkPublicKey: starkKey,
//     });
// }

/**
 * Mint a token to the given user.
 */
async function mint(
  config: Config,
  mintTokenRequestParam: MintsApiMintTokensRequest,
): Promise<string> {
  const mintsApi = new MintsApi(config.api);

  const mintResponse = await mintsApi.mintTokens(mintTokenRequestParam);
  const mintResponseData = mintResponse?.data || {};

  //   const result = await client.mint({
  //     mints: [
  //       {
  //         etherKey: recipient.toLowerCase(),
  //         tokens: [
  //           {
  //             type: MintableERC721TokenType.MINTABLE_ERC721,
  //             data: {
  //               id: random().toString(10),
  //               blueprint: '100,100,10',
  //               tokenAddress: token_address.toLowerCase(),
  //             },
  //           },
  //         ],
  //         nonce: random().toString(10),
  //         authSignature: '',
  //       },
  //     ],
  //   });
  return mintResponseData.results[0].token_id;
}

function random(): number {
  const min = 1;
  const max = 1000000000;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function getUserInventory(config: Config, user: string) {
  const assetsApi = new AssetsApi(config.api);
  const listAssetsResponse = await assetsApi.listAssets({
    user: user,
  });
  return listAssetsResponse.data;
}

async function getUserBalance(config: Config, user: string) {
  const balancesApi = new BalancesApi(config.api);
  const balanceApiResponse = await balancesApi.getBalance({
    owner: user,
    address: 'eth',
  });
  return balanceApiResponse?.data || {};
}

async function depositEth(client: Wallet, user: string, amount: string) {
  const token = {
    type: ETHTokenType.ETH,
    data: {
      decimals: 18,
    },
  };
  const quantity = ethers.BigNumber.from(amount);
  return client.deposit({
    user: user,
    token: token,
    quantity: quantity,
  });
}

/**
 * Creates a sell order for a given NFT
 */
async function sellNFT(
    config: Config,
  user: string,
  contract_address: string,
  token_id: string,
  sale_amount: string,
) {
  const params: ImmutableMethodParams.ImmutableGetSignableOrderParamsTS = {
    user: user,
    tokenSell: {
      type: ERC721TokenType.ERC721,
      data: {
        tokenAddress: contract_address,
        tokenId: token_id,
      },
    },
    amountSell: ethers.BigNumber.from('1'),
    tokenBuy: {
      type: ETHTokenType.ETH,
      data: {
        decimals: 18,
      },
    },
    amountBuy: ethers.BigNumber.from(sale_amount),
  };

  {
    /**
     * Amount to buy
     * @type {string}
     * @memberof CreateOrderRequest
     */
    'amount_buy': ethers.BigNumber.from(sale_amount);
    /**
     * Amount to sell
     * @type {string}
     * @memberof CreateOrderRequest
     */
    'amount_sell': ethers.BigNumber.from('1');
    /**
     * ID of the asset to buy
     * @type {string}
     * @memberof CreateOrderRequest
     */
    'asset_id_buy': token_id;
    /**
     * ID of the asset to sell
     * @type {string}
     * @memberof CreateOrderRequest
     */
    'asset_id_sell': string;
    /**
     * Expiration timestamp for this order
     * @type {number}
     * @memberof CreateOrderRequest
     */
    'expiration_timestamp': number;
    /**
     * Fee information
     * @type {Array<FeeEntry>}
     * @memberof CreateOrderRequest
     */
    'fees'?: Array<FeeEntry>;
    /**
     * Whether to include fees in order
     * @type {boolean}
     * @memberof CreateOrderRequest
     */
    'include_fees'?: boolean;
    /**
     * Nonce of the order
     * @type {number}
     * @memberof CreateOrderRequest
     */
    'nonce': number;
    /**
     * Public stark key of the user creating order
     * @type {string}
     * @memberof CreateOrderRequest
     */
    'stark_key': string;
    /**
     * Payload signature
     * @type {string}
     * @memberof CreateOrderRequest
     */
    'stark_signature': string;
    /**
     * ID of the vault into which the bought asset will be placed
     * @type {number}
     * @memberof CreateOrderRequest
     */
    'vault_id_buy': number;
    /**
     * ID of the vault to sell from
     * @type {number}
     * @memberof CreateOrderRequest
     */
    'vault_id_sell': number;
}

  const ordersApi = new OrdersApi(config.api);
  const balanceApiResponse = await ordersApi.createOrder({
    /**
     * create an order
     * @type {CreateOrderRequest}
     * @memberof OrdersApiCreateOrder
     */
    createOrderRequest: params;
});
  return client.createOrder(params);
}

/**
 * Creates a buy order (trade) for a given sell order
 */
async function buyNFT(
  client: ImmutableXClient,
  user: string,
  contract_address: string,
  token_id: string,
  order_id: number,
) {
  const params: ImmutableMethodParams.ImmutableGetSignableTradeParamsTS = {
    orderId: order_id,
    user: user,
    tokenBuy: {
      type: ERC721TokenType.ERC721,
      data: {
        tokenAddress: contract_address,
        tokenId: token_id,
      },
    },
    amountBuy: ethers.BigNumber.from('1'),
    tokenSell: {
      type: ETHTokenType.ETH,
      data: {
        decimals: 18,
      },
    },
    amountSell: ethers.BigNumber.from('10000000000000000'),
  };
  return client.createTrade(params);
}

async function main(minterPrivateKey: string, network: EthNetwork) {
  // Get signer - as per core-sdk
  const provider = new AlchemyProvider(network, process.env.ALCHEMY_API_KEY);
  const minter = new Wallet(minterPrivateKey).connect(provider);
  const buyer = Wallet.createRandom().connect(provider);
  const seller = Wallet.createRandom().connect(provider);

  console.log('Minter', minter.address, minter.privateKey);
  console.log('Buyer', buyer.address, buyer.privateKey);
  console.log('Seller', seller.address, seller.privateKey);

  //   const minterClient = await getClient(minter);
  //   const buyerClient = await getClient(buyer);
  //   const sellerClient = await getClient(seller);

  const minterStarkWallet = await generateStarkWallet(minter);
  const buyerStarkWallet = await generateStarkWallet(buyer);
  const sellerStarkWallet = await generateStarkWallet(seller);
  console.log('minterStarkWallet');
  //crete signatures
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const minterEthSignature = await signRaw(timestamp, minter);
  const buyerEthSignature = await signRaw(timestamp, buyer);
  const sellerEthSignature = await signRaw(timestamp, seller);
  const buyerStarkSignature = serializeSignature(
    sign(buyerStarkWallet.starkKeyPair, 'msg'), // what is to be passed in msg
  );
  const sellerStarkSignature = serializeSignature(
    sign(sellerStarkWallet.starkKeyPair, 'msg'),
  );

  const config = getConfig(network);
  const usersApi = new UsersApi(config.api);

  // Register buyer and seller wallets on Immutable X
  await usersApi.registerUser({
    registerUserRequest: {
      eth_signature: buyerEthSignature,
      ether_key: buyer.address,
      stark_key: buyerStarkWallet.starkPublicKey,
      stark_signature: buyerStarkSignature,
    },
  });
  await usersApi.registerUser({
    registerUserRequest: {
      eth_signature: sellerEthSignature,
      ether_key: seller.address,
      stark_key: sellerStarkWallet.starkPublicKey,
      stark_signature: sellerStarkSignature,
    },
  });
  // Transfer eth from your wallet to the buyer wallet on ropsten network
  const walletPrivateKey = '<PK_WALLET_WITH_TEST_ETH>';
  const wallet = new Wallet(walletPrivateKey).connect(provider);
  //    new ethers.Wallet(walletPrivateKey).connect(provider);
  console.log('Sending 0.05 eth from', wallet.address, 'to', buyer.address);
  (
    await wallet.sendTransaction({
      to: buyer.address,
      value: ethers.utils.parseEther('0.05'),
    })
  ).wait();

  // Deposit eth into buyer wallet
  const depositsApi = new DepositsApi(config.api);
  const sale_amount = ethers.utils.parseEther('0.01').toString();
  console.log(
    'Deposit transaction: ',
    await depositEth(buyer, buyer.address, sale_amount),
  );
  console.log(
    'Buyer ETH balance: ',
    await getUserBalance(config, buyer.address),
  );

  // Mint the nft to the seller wallet
  const contract_address = process.env.COLLECTION_CONTRACT_ADDRESS || ''; //<YOUR_CONTRACT_ADDRESS>- Contract registered by Immutable
  const mintTokenRequestParam: MintsApiMintTokensRequest = {
    mintTokensRequestV2: [
      {
        auth_signature: minterEthSignature,
        contract_address: contract_address,
        users: [
          {
            user: await seller.address,
            tokens: [
              {
                id: '1',
                blueprint: 'test blueprint',
              },
            ],
          },
        ],
      },
    ],
  };
  const minted_token_id = await mint(config, mintTokenRequestParam);
  console.log(`Token minted: ${minted_token_id}`);
  console.log(
    'Buyer Inventory',
    (await getUserInventory(config, buyer.address)).result,
  );
  console.log(
    'Seller Inventory',
    (await getUserInventory(config, seller.address)).result,
  );

  // List the nft for sale
  const order_result = await sellNFT(
    sellerClient,
    seller.address,
    token_address,
    minted_token_id,
    sale_amount,
  );
  console.log('Created sell order with id:', order_result.order_id);

  // Buy the nft listed for sale (create trade)
  const trade_result = await buyNFT(
    buyerClient,
    buyer.address,
    token_address,
    minted_token_id,
    order_result.order_id,
  );
  console.log(
    'Created trade with id: ',
    trade_result.trade_id,
    'status: ',
    trade_result.status,
  );

  console.log(`Transaction Complete`);
  console.log(
    'Buyer Inventory',
    await getUserInventory(config, buyer.address),
  );
  console.log(
    'Seller Inventory',
    await getUserInventory(config, seller.address),
  );
  console.log(
    'Buyer ETH balance: ',
    await getUserBalance(config, buyer.address),
  );
  console.log(
    'Seller ETH balance: ',
    await getUserBalance(config, buyer.address),
  );
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
main(argv.k, argv.network as EthNetwork)
  .then(() => console.log('Main function call complete'))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
