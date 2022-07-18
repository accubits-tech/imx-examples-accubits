import { AlchemyProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import {
  CollectionsApi,
  CollectionsApiCreateCollectionRequest,
  EthNetwork,
  getConfig,
  Mint,
  MintsApi,
  ProjectsApi,
  signRaw,
  Workflows,
} from '@imtbl/core-sdk';
import yargs from 'yargs';

function random(): number {
  const min = 1;
  const max = 1000000000;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
async function main(ownerPrivateKey: string, network: EthNetwork) {
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
  //Create collection with the deployed contract and project id
  const collectionsApi = new CollectionsApi(config.api);
  const createCollectionParams: CollectionsApiCreateCollectionRequest = {
    iMXSignature: signature,
    iMXTimestamp: timestamp,
    createCollectionRequest: {
      contract_address: '0xf420aA4c2BFBCd0203901Dd7F207224f6eA803fD',
      name: 'test collection',
      owner_public_key: '0xb064ddf8a93ae2867773188eb3c79ea3a22874ff',
      project_id: project.id,
    },
  };
  const createCollectionRes = await collectionsApi.createCollection(
    createCollectionParams,
  );
  const collection = createCollectionRes?.data || {};
  console.log('Created collection with address:', collection.address);

  const workflows = new Workflows(config);
  const mintResponse = await workflows.mint(signer, {
    contract_address: '0xf420aA4c2BFBCd0203901Dd7F207224f6eA803fD',
    users: [
      {
        user: signer.address,
        tokens: [
          {
            id: random().toString(10),
            blueprint: 'test blueprint',
          },
        ],
      },
    ],
  });
  console.log('Mint response:');
  console.log(mintResponse);

  //Give API time to register the new mint
  await new Promise(f => setTimeout(f, 3000));

  //Fetch mint
  const mintsApi = new MintsApi(config.api);
  console.log('fetching mint');
  const mintFetch = await mintsApi.getMint({
    id: mintResponse.results[0].tx_id.toString(),
  });
  const mintFetchData: Mint = mintFetch?.data || {};
  console.log(JSON.stringify(mintFetchData));
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
