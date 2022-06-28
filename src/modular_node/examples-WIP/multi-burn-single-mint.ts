import { Wallet } from 'ethers';

import yargs from 'yargs';
import {
  getConfig,
  EthNetwork,
  Workflows,
  generateStarkWallet,
  UnsignedBurnRequest,
  TokenType,
  MintsApi,
  Mint,
  MintsApiMintTokensRequest,
} from '@imtbl/core-sdk';
import { AlchemyProvider } from '@ethersproject/providers';

async function main(ownerPrivateKey: string, network: EthNetwork) {
  console.log('multi-burn-single-mint main');
  try {
    // Configure Core SDK Workflow class
    const config = getConfig(network);
    const workflows = new Workflows(config);

    // Get signer - as per core-sdk
    const provider = new AlchemyProvider(network, process.env.ALCHEMY_API_KEY);
    const signer = new Wallet(ownerPrivateKey).connect(provider);
    const { starkWallet } = await generateWallets(provider);
    console.log('burnRequestParam');
    const burnRequestParam: UnsignedBurnRequest = {
      amount: '1',
      sender: '0xdd8C03c3a9e886De275e003cd3ed2a8E24ca87ca',
      token: {
        type: TokenType.ERC721,
        data: {
          tokenId: '381',
          tokenAddress: '0x19e81d345a3bb5194458b2df8ff49960c336b413',
        },
      },
    };
    console.log(burnRequestParam);
    console.log(signer);
    console.log(starkWallet);

    const burnResponse = await workflows.burn(
      signer,
      starkWallet,
      burnRequestParam,
    );
    console.log('burnResponse');
    console.log(burnResponse);
    //Give API time to register the burn
    await new Promise(f => setTimeout(f, 3000));

    //Fetch the burn
    const getBurnResponse = await workflows.getBurn({
      id: burnResponse?.transfer_id?.toString(),
    });
    const getBurnResponseData = getBurnResponse.data || {};
    //See if the fetched burn is successful, otherwise don't mint
    if (getBurnResponseData.status == 'success') {
      console.log(
        'Burn was successful, tx_id: ',
        getBurnResponseData.transaction_id,
      );

      //Attempt to mint an asset on the back of the burn
      const mintsApi = new MintsApi(config.api);
      const mintTokenRequestParam: MintsApiMintTokensRequest = {
        mintTokensRequestV2: [
          {
            auth_signature: 'string',
            contract_address: '0x19e81d345a3bb5194458b2df8ff49960c336b413',
            users: [
              {
                user: '',
                tokens: [
                  {
                    id: '2506',
                    blueprint: 'none',
                  },
                ],
              },
            ],
          },
        ],
      };
      const mintResponse = await mintsApi.mintTokens(mintTokenRequestParam);
      const mintResponseData = mintResponse?.data || {};
      //Give API time to register the new mint
      await new Promise(f => setTimeout(f, 3000));

      //Fetch the mint
      const mintFetch = await mintsApi.getMint({
        id: mintResponseData.results[0].tx_id.toString(),
      });
      const mintFetchData: Mint = mintFetch?.data || {};

      //If the mint is fetched and successful then mint
      if (mintFetchData.status == 'success') {
        console.log(
          'Mint was successful, tx_id: ' + mintFetchData.transaction_id,
        );
      } else {
        console.log('Mint was unsuccessful');
      }
    } else {
      console.log('Burn was unsuccessful.');
    }
    console.log('Burn and mint as a whole was successful.');
  } catch (err) {
    console.log('Burn and mint failed as a whole failed.');
    console.log(err);
  }
}
// generate your own stark wallet
const generateWallets = async (provider: AlchemyProvider) => {
  // L1 credentials
  const wallet = Wallet.createRandom().connect(provider);

  // L2 credentials
  // Obtain stark key pair associated with this user
  const starkWallet = await generateStarkWallet(wallet); // this is sdk helper function

  return {
    wallet,
    starkWallet,
  };
};
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

main(argv.k, argv.network as EthNetwork);
