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
  signRaw,
} from '@imtbl/core-sdk';
import { AlchemyProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';

function random(): number {
  const min = 1;
  const max = 1000000000;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
async function main(ownerPrivateKey: string, network: EthNetwork) {
  console.log('multi-burn-single-mint main');
  try {
    // Configure Core SDK Workflow class
    const config = getConfig(network);
    const workflows = new Workflows(config);
    // Get signer - as per core-sdk
    const provider = new AlchemyProvider(network,"DvukuyBzEK-JyP6zp1NVeNVYLJCrzjp_"); // process.env.ALCHEMY_API_KEY
    const signer = new Wallet(ownerPrivateKey).connect(provider);
    // generate your own stark wallet
    const starkWallet = await generateStarkWallet(signer);
    //generate authorisation headers
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = await signRaw(timestamp, signer);

    console.log('burnRequestParam');
    const burnRequestParam: UnsignedBurnRequest = {
      amount: '1',
      sender: '0xb064ddf8a93ae2867773188eb3c79ea3a22874ff', //process.env.WALLET_ADDRESS || '',
      token: {
        type:TokenType.ERC721,
        data: {
          token_id: '66',
          token_address: '0xf420aa4c2bfbcd0203901dd7f207224f6ea803fd',
        },
      },
    };
    console.log(burnRequestParam);
    console.log(signer);
    console.log(starkWallet.starkKeyPair);

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
    console.log("getBurnResponse")
    console.log(getBurnResponse)
    const getBurnResponseData = getBurnResponse.data || {};

    // See if the fetched burn is successful, otherwise don't mint
    if (getBurnResponseData.status == 'success') {
      console.log(
        'Burn was successful, tx_id: ',
        getBurnResponseData.transaction_id,
      );

      //Attempt to mint an asset on the back of the burn
      const mintsApi = new MintsApi(config.api);
      const mintResponse = await workflows.mint(signer, {
        contract_address: "0xf420aA4c2BFBCd0203901Dd7F207224f6eA803fD",
        users: [
          {
            user: signer.address,
            tokens: [
              {
                id:random().toString(10),
                blueprint: 'none',
              },
            ],
          },
        ],
      });
    console.log('Mint response:');
    console.log(mintResponse);
      //Give API time to register the new mint
      await new Promise(f => setTimeout(f, 3000));

      //Fetch the mint
      const mintFetch = await mintsApi.getMint({
        id: mintResponse.results[0].tx_id.toString(),
      });
      const mintFetchData: any = mintFetch?.data || {}; //As per data type in core-sdk it should be Mint obj but getting array -To be checked
      console.log("mintFetchData")
      console.log(mintFetchData);
      //If the mint is fetched and successful then mint
      if (mintFetchData[0].status == 'success') {
        console.log(
          'Mint was successful, tx_id: ' + mintFetchData[0].transaction_id,
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
