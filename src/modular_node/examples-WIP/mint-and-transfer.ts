import { ethers } from 'ethers';
import { ImmutableXClient, ImmutableXWallet, sign } from '@imtbl/imx-sdk';
// import {
//   ERC721TokenType,
//   ImmutableMethodResults,
//   MintableERC721TokenType,
// } from '@imtbl/imx-sdk';
import { AlchemyProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import {
  EthNetwork,
  generateStarkWallet,
  getConfig,
  MintsApi,
  MintsApiMintTokensRequest,
  serializeSignature,
  signRaw,
  TokenType,
  UsersApi,
  Workflows,
} from '@imtbl/core-sdk';
import yargs from 'yargs';

function random(): number {
  const min = 1;
  const max = 1000000000;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function getUserInventory(client: ImmutableXClient, user: string) {
  return client.getAssets({
    user: user,
  });
}

async function main(minterPrivateKey: string, network: EthNetwork) {
  // Get signer - as per core-sdk
  const provider = new AlchemyProvider(network, process.env.ALCHEMY_API_KEY);
  const minter = new Wallet(minterPrivateKey).connect(provider);
  const admin = Wallet.createRandom().connect(provider);
  const user = Wallet.createRandom().connect(provider);
  console.log('Minter', minter.address, minter.publicKey, minter.privateKey);
  console.log('Admin', admin.address, admin.publicKey, admin.privateKey);
  console.log('User', user.address, user.publicKey, user.privateKey);
  const minterStarkWallet = await generateStarkWallet(minter);
  const adminStarkWallet = await generateStarkWallet(admin);
  const userStarkWallet = await generateStarkWallet(user);
  console.log('minterStarkWallet');
  //crete signatures
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const minterEthSignature = await signRaw(timestamp, minter);
  const adminEthSignature = await signRaw(timestamp, admin);
  const userEthSignature = await signRaw(timestamp, user);
  const adminStarkSignature = serializeSignature(
    sign(adminStarkWallet.starkKeyPair, 'msg'), // what is to be passed in msg
  );
  const userStarkSignature = serializeSignature(
    sign(userStarkWallet.starkKeyPair, 'msg'),
  );

  const config = getConfig(network);
  const usersApi = new UsersApi(config.api);
  await usersApi.registerUser({
    registerUserRequest: {
      eth_signature: adminEthSignature,
      ether_key: admin.address,
      stark_key: adminStarkWallet.starkPublicKey,
      stark_signature: adminStarkSignature,
    },
  });
  console.log('admin registered');
  await usersApi.registerUser({
    registerUserRequest: {
      eth_signature: userEthSignature,
      ether_key: user.address,
      stark_key: userStarkWallet.starkPublicKey,
      stark_signature: userStarkSignature,
    },
  });

  // Mint the token to the "user"
  const contract_address = '0xf420aA4c2BFBCd0203901Dd7F207224f6eA803fD'; //<DA_CONTRACT_ADDRESS_CHANGE_ME>- Contract registered by Immutable
  const workflows = new Workflows(config);

  const mintsApi = new MintsApi(config.api);
  const mintTokenRequestParam: MintsApiMintTokensRequest = {
    mintTokensRequestV2: [
      {
        auth_signature: minterEthSignature,
        contract_address: contract_address,
        users: [
          {
            user: await user.address,
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
  const mintResponse = await mintsApi.mintTokens(mintTokenRequestParam);
  const mintResponseData = mintResponse?.data || {};
  //mint using workflow
  //   const mintResponse = await workflows.mint(minter, {
  //     contract_address: contract_address,
  //     users: [
  //       {
  //         user: user.address,
  //         tokens: [
  //           {
  //             id: '1',
  //             blueprint: 'test blueprint',
  //           },
  //         ],
  //       },
  //     ],
  //   });
  const mintedTokenId = mintResponseData.results[0].token_id;
  const mintedTokenAddress = mintResponseData.results[0].contract_address;
  console.log(`Token minted: ${mintedTokenId}`);
  //check later if req
  //   console.log(
  //     'Admin Inventory',
  //     await getUserInventory(adminClient, admin.address),
  //   );
  //   console.log(
  //     'User Inventory',
  //     await getUserInventory(userClient, user.address),
  //   );

  // Transfer the token to the administrator
  const transferResponse = await workflows.transfer(minter, minterStarkWallet, {
    amount: '0.1',
    receiver: admin.address,
    sender: user.address,
    token: {
      type: TokenType.ERC721,
      data: {
        tokenId: mintedTokenId,
        tokenAddress: mintedTokenAddress,
      },
    },
  });
  console.log(`Transfer Complete`);
  //   console.log(
  //     'Admin Inventory',
  //     await getUserInventory(adminClient, admin.address),
  //   );
  //   console.log(
  //     'User Inventory',
  //     await getUserInventory(userClient, user.address),
  //   );
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
    console.log('Main function catch');
    console.error(err);
    process.exit(1);
  });
