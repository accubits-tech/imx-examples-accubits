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
  Workflows,
  TokenType,
  TokenDeposit,
  StarkWallet,
  GetSignableOrderRequest,
  GetSignableTradeRequest,
} from '@imtbl/core-sdk';
import { AlchemyProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import { Signer } from '@ethersproject/abstract-signer';

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

  return mintResponse.results[0].token_id;
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

async function depositEth(
  config: Config,
  workflows: Workflows,
  user: Signer,
  amount: string,
) {
  const token: TokenDeposit = {
    type: TokenType.ETH,
    amount: amount,
  };

  const depositResponse = await workflows.deposit(user, token);
  console.log('depositResponse');
  console.log(depositResponse);
  return depositResponse;
}

/**
 * Creates a sell order for a given NFT
 */
async function sellNFT(
  config: Config,
  workflows: Workflows,
  seller: Wallet,
  starkWallet: StarkWallet,
  contractAddress: string,
  tokenId: string,
  sale_amount: string,
) {
  const createOrderParams: GetSignableOrderRequest = {
    amount_buy: ethers.BigNumber.from(sale_amount).toString(),
    amount_sell: ethers.BigNumber.from('1').toString() ,
    token_buy: {
      type: ETHTokenType.ETH,
      data: {
        decimals: 18,
      },
    },
    token_sell: {
      type: ERC721TokenType.ERC721,
      data: {
        token_address: contractAddress,
        token_id: tokenId,
      },
    },
    user: seller.address,
  };
  const createOrderResponse = await workflows.createOrder(
    seller,
    starkWallet,
    createOrderParams,
  );

  // const params: ImmutableMethodParams.ImmutableGetSignableOrderParamsTS = {
  //   user: user,
  //   tokenSell: {
  //     type: ERC721TokenType.ERC721,
  //     data: {
  //       tokenAddress: contract_address,
  //       tokenId: token_id,
  //     },
  //   },
  //   amountSell: ethers.BigNumber.from('1'),
  //   tokenBuy: {
  //     type: ETHTokenType.ETH,
  //     data: {
  //       decimals: 18,
  //     },
  //   },
  //   amountBuy: ethers.BigNumber.from(sale_amount),
  // };
  console.log('createOrderResponse');
  console.log(createOrderResponse);

  return createOrderResponse;
}

/**
 * Creates a buy order (trade) for a given sell order
 */
async function buyNFT(
  config: Config,
  workflows: Workflows,
  buyer: Wallet,
  starkWallet: StarkWallet,
  order_id: number,
) {
  const createTradeParams: GetSignableTradeRequest = {
    user: buyer.address,
    order_id: order_id,
  };
  const createTradeResponse = await workflows.createTrade(
    buyer,
    starkWallet,
    createTradeParams,
  );
  // const params: ImmutableMethodParams.ImmutableGetSignableTradeParamsTS = {
  //   orderId: order_id,
  //   user: user,
  //   tokenBuy: {
  //     type: ERC721TokenType.ERC721,
  //     data: {
  //       tokenAddress: contract_address,
  //       tokenId: token_id,
  //     },
  //   },
  //   amountBuy: ethers.BigNumber.from('1'),
  //   tokenSell: {
  //     type: ETHTokenType.ETH,
  //     data: {
  //       decimals: 18,
  //     },
  //   },
  //   amountSell: ethers.BigNumber.from('10000000000000000'),
  // };
  return createTradeResponse;
}

async function main(minterPrivateKey: string, network: EthNetwork) {
  try {
    // Configure Core SDK Workflow class
    const config = getConfig(network);
    const workflows = new Workflows(config);
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
    const usersApi = new UsersApi(config.api);

    // Get signable details for offchain registration
    const buyerSignableResult = await usersApi.getSignableRegistrationOffchain({
      getSignableRegistrationRequest: {
        ether_key: buyer.address,
        stark_key: buyerStarkWallet.starkPublicKey,
      },
    });
    const sellerSignableResult = await usersApi.getSignableRegistrationOffchain(
      {
        getSignableRegistrationRequest: {
          ether_key: seller.address,
          stark_key: sellerStarkWallet.starkPublicKey,
        },
      },
    );
    const {
      signable_message: buyerSignableMessage,
      payload_hash: buyerPayloadHash,
    } = buyerSignableResult.data;
    const {
      signable_message: sellerSignableMessage,
      payload_hash: sellerPayloadHash,
    } = sellerSignableResult.data;
    // Sign message with L1 credentials
    const buyerEthSignature = await signRaw(buyerSignableMessage, buyer);
    const sellerEthSignature = await signRaw(sellerSignableMessage, seller);

    // Sign hash with L2 credentials
    const buyerStarkSignature = serializeSignature(
      sign(buyerStarkWallet.starkKeyPair, buyerPayloadHash),
    );
    const sellerStarkSignature = serializeSignature(
      sign(sellerStarkWallet.starkKeyPair, sellerPayloadHash),
    );
    // Send request for user registratin offchain
    const buyerRegisterResponse = await usersApi.registerUser({
      registerUserRequest: {
        eth_signature: buyerEthSignature,
        ether_key: buyer.address,
        stark_signature: buyerStarkSignature,
        stark_key: buyerStarkWallet.starkPublicKey,
      },
    });
    console.log('buyer registered');
    const userRegisterResponse = await usersApi.registerUser({
      registerUserRequest: {
        eth_signature: sellerEthSignature,
        ether_key: seller.address,
        stark_signature: sellerStarkSignature,
        stark_key: sellerStarkWallet.starkPublicKey,
      },
    });
    console.log('seller registered');
    // Transfer eth from your wallet to the buyer wallet on ropsten network
    //    new ethers.Wallet(walletPrivateKey).connect(provider);
    console.log('Sending 0.05 eth from', minter.address, 'to', buyer.address);
    // (
    //   await minter.sendTransaction({
    //     to: buyer.address,
    //     value: ethers.utils.parseEther('0.05'),
    //   })
    // ).wait();
      console.log("Eth sent to buyer")
    // Deposit eth into buyer wallet
    const sale_amount ='1' //ethers.utils.parseEther('0.01').toString();
    // console.log(
    //   'Deposit transaction: ',
    //   await depositEth(config, workflows, buyer, sale_amount),
    // );
    console.log(
      'Buyer ETH balance: ',
      await getUserBalance(config, buyer.address),
    );

    // Mint the nft to the seller wallet
    const contract_address = '0xf420aA4c2BFBCd0203901Dd7F207224f6eA803fD'; //process.env.COLLECTION_CONTRACT_ADDRESS || ''<YOUR_CONTRACT_ADDRESS>- Contract registered by Immutable

    const minted_token_id = await mint(
      config,
      workflows,
      minter,
      seller.address,
      contract_address,
    );
    console.log(`Token minted: ${minted_token_id}`);
     //Give API time to register the new mint
  await new Promise(f => setTimeout(f, 3000));
    console.log(
      'Buyer Inventory',seller.address,
      (await getUserInventory(config, buyer.address)).result,
    );
    console.log(
      'Seller Inventory',
      (await getUserInventory(config, seller.address)).result,
    );
    // List the nft for sale
    const order_result = await sellNFT(
      config,
      workflows,
      seller,
      sellerStarkWallet,
      contract_address,
      minted_token_id,
      sale_amount,
    );
    console.log('Created sell order with id:', order_result.order_id);

    // Buy the nft listed for sale (create trade)
    const trade_result = await buyNFT(
      config,
      workflows,
      seller,
      buyerStarkWallet,
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
  } catch (err) {
    console.log('Trade failed as a whole.');
    console.log(err);
  }
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
