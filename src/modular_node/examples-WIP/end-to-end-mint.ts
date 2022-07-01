import { compileContract } from '../utils/L1Helpers/compile-contract';
import yargs from 'yargs';
import { AlchemyProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import {
  EthNetwork,
  getConfig,
  ProjectsApi,
  CollectionsApi,
  signRaw,
  MintsApi,
  MintsApiMintTokensRequest,
  Mint,
  CollectionsApiCreateCollectionRequest,
} from '@imtbl/core-sdk';

async function main(ownerPrivateKey: string, network: EthNetwork) {
  //Compile the contract
  //compileContract();

  //Deploy the contract with the below parameters. 5m gas limit and 60gwei gas price seems to work fine for the NFT contracts.
  //Make sure you have enough ropsten ETH on this address. Check out https://imxfaucet.xyz/ to get some.
  //TODO: add error handling for the user not having enough funds in wallet
  // const deployedContract = await deployContract(ownerPrivateKey, 'Asset', 'Contract Name', 'SYMBOL', network, '5000000', '60000000000');
  // console.log('Deployed contract address: ' + deployedContract.address)
  // console.log('Now we wait 3 minutes while the contract deploys...')

  // //Give the new contract time to deploy, 3 minutes should be sufficient
  // await new Promise(f => setTimeout(f, 180000));

  //Create signer
  const provider = new AlchemyProvider(network, process.env.ALCHEMY_API_KEY);
  const signer = new Wallet(ownerPrivateKey).connect(provider);

  const config = getConfig(network);

  //generate authorisation headers
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = await signRaw(timestamp, signer);

  //Create a new project
  const projectsApi = new ProjectsApi(config.api);
  const createProjectRes = await projectsApi.createProject({
    createProjectRequest: {
      name: 'test project',
      company_name: 'test company',
      contact_email: 'dane@immutable.com',
    },
    iMXSignature: signature,
    iMXTimestamp: timestamp,
  });
  const project = createProjectRes?.data || {};
  console.log('Created project with id:', project.id);
  console.log("wallet address", process.env.WALLET_ADDRESS)
  //Create collection with the deployed contract and project id
  const collectionsApi = new CollectionsApi(config.api);
  const createCollectionParams:CollectionsApiCreateCollectionRequest={
    iMXSignature: signature,
    iMXTimestamp: timestamp,
    createCollectionRequest: {
      'contract_address': "0xf420aA4c2BFBCd0203901Dd7F207224f6eA803fD",
      'name': 'test collection',
      'owner_public_key':"0xb064ddf8a93ae2867773188eb3c79ea3a22874ff",
  }
}
  const createCollectionRes = await collectionsApi.createCollection(createCollectionParams);
  const collection = createCollectionRes?.data || {};
  console.log('Created collection with address:', collection.address);

  //Mint an asset
  const mintsApi = new MintsApi(config.api);
  const mintTokenRequestParam: MintsApiMintTokensRequest = {
    mintTokensRequestV2: [
      {
        auth_signature: signature,
        contract_address: collection.address,
        users: [
          {
            user: await signer.address,
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
  console.log('Mint response:');
  console.log(mintResponseData.results);

  //Give API time to register the new mint
  await new Promise(f => setTimeout(f, 3000));

  //Fetch mint
  const mintFetch = await mintsApi.getMint({
    id: mintResponseData.results[0].tx_id.toString(),
  });
  const mintFetchData: Mint = mintFetch?.data || {};
  console.log(mintFetchData);
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
  .then(() => console.log('Success'))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
