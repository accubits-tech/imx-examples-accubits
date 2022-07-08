import { ethers } from 'ethers';
import { ImmutableXClient, ImmutableXWallet, sign } from '@imtbl/imx-sdk';
import { AlchemyProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import {
  AssetsApi,
  Config,
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

async function getUserInventory(config: Config, user: string) {
  const assetsApi = new AssetsApi(config.api);
  const listAssetsResponse = await assetsApi.listAssets({
    user: user,
  });
  return listAssetsResponse.data;
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
  // const minterEthSignature = await signRaw(timestamp, minter);
 

  const config = getConfig(network);
  const usersApi = new UsersApi(config.api);
  // Get signable details for offchain registration
  const adminSignableResult = await usersApi.getSignableRegistrationOffchain({
    getSignableRegistrationRequest: {
      ether_key: admin.address,
      stark_key: adminStarkWallet.starkPublicKey,
    },
  });
  const userSignableResult = await usersApi.getSignableRegistrationOffchain({
    getSignableRegistrationRequest: {
      ether_key: user.address,
      stark_key: userStarkWallet.starkPublicKey,
    },
  });
  const { signable_message: adminSignableMessage, payload_hash: adminPayloadHash } =
  adminSignableResult.data;
  const { signable_message: userSignableMessage, payload_hash: userPayloadHash } =
  userSignableResult.data;
  // Sign message with L1 credentials
  const adminEthSignature = await signRaw(adminSignableMessage, admin);
  const userEthSignature = await signRaw(userSignableMessage, user);

  // Sign hash with L2 credentials
  const adminStarkSignature = serializeSignature(
    sign(adminStarkWallet.starkKeyPair, adminPayloadHash),
  );
  const userStarkSignature = serializeSignature(
    sign(userStarkWallet.starkKeyPair, userPayloadHash),
  );
  // Send request for user registratin offchain
  const adminRegisterResponse = await usersApi.registerUser({
    registerUserRequest: {
      eth_signature: adminEthSignature,
      ether_key: admin.address,
      stark_signature: adminStarkSignature,
      stark_key: adminStarkWallet.starkPublicKey,
    },
  });
  console.log("admin registered")
  const userRegisterResponse = await usersApi.registerUser({
    registerUserRequest: {
      eth_signature: userEthSignature,
      ether_key: user.address,
      stark_signature: userStarkSignature,
      stark_key: userStarkWallet.starkPublicKey,
    },
  });
  console.log("user registered")

  // Mint the token to the "user"
  const contract_address = '0xf420aA4c2BFBCd0203901Dd7F207224f6eA803fD'; //<DA_CONTRACT_ADDRESS_CHANGE_ME>- Contract registered by Immutable
  const workflows = new Workflows(config);
  //mint using workflow
    const mintResponse = await workflows.mint(minter, {
      contract_address: contract_address,
      users: [
        {
          user: user.address,
          tokens: [
            {
              id: random().toString(10),
              blueprint: 'test blueprint',
            },
          ],
        },
      ],
    });
  const mintedTokenId = mintResponse.results[0].token_id;
  const mintedTokenAddress = mintResponse.results[0].contract_address;
  console.log(`Token minted: ${mintedTokenId}`);
  //Give API time to register the new mint
  await new Promise(f => setTimeout(f, 3000));
    console.log(
      'Admin Inventory',
      await getUserInventory(config, admin.address),
    );
    console.log(
      'User Inventory',
      await getUserInventory(config, user.address),
    );

  // Transfer the token to the administrator
  console.log("sending transfer")
  const transferResponse = await workflows.transfer(user, userStarkWallet, {
    amount: '1',
    receiver: admin.address,
    sender: user.address,
    token: {
      type: TokenType.ERC721,
      data: {
        token_id: mintedTokenId,
        token_address: mintedTokenAddress,
      },
    },
  });
  console.log(`Transfer Complete`);
  //Give API time to transfer the asset
  await new Promise(f => setTimeout(f, 3000));
    console.log(
      'Admin Inventory',
      await getUserInventory(config, admin.address),
    );
    console.log(
      'User Inventory',
      await getUserInventory(config, user.address),
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
    console.log('Main function catch');
    console.error(err);
    process.exit(1);
  });
