import yargs from 'yargs';
import {
  getConfig,
  EthNetwork,
  MetadataApi,
  MetadataApiAddMetadataSchemaToCollectionRequest,
  AddMetadataSchemaToCollectionRequest,
  MetadataSchemaRequestTypeEnum,
  signRaw
} from '@imtbl/core-sdk';
import {getSigner} from "../utils/client"
async function main(
  ownerPrivateKey: string,
  tokenAddress: string,
  schema: AddMetadataSchemaToCollectionRequest,
  network: string,
): Promise<void> {
  const config = getConfig(network as EthNetwork);
  const metadataApi = new MetadataApi(config.api);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signer = await getSigner(network, ownerPrivateKey);
  const signature = await signRaw(timestamp, signer); // IMX-Signature
  const reqObj: MetadataApiAddMetadataSchemaToCollectionRequest = {
    address: tokenAddress,
    addMetadataSchemaToCollectionRequest: schema,
    iMXSignature: signature,
    iMXTimestamp: timestamp,
  };
  const response = await metadataApi.addMetadataSchemaToCollection(reqObj);
  console.log(response);
}

const argv = yargs(process.argv.slice(2))
  .usage(
    'Usage: -k <PRIVATE_KEY> -s <SMART_CONTRACT_ADDRESS> --network <NETWORK>',
  )
  .options({
    k: { describe: 'wallet private key', type: 'string', demandOption: true },
    s: {
      describe: 'smart contract address',
      type: 'string',
      demandOption: true,
    },
    network: {
      describe: 'network. ropsten or mainnet',
      type: 'string',
      demandOption: true,
    },
  })
  .parseSync();

/**
 * Edit your values here
 */
const schema: AddMetadataSchemaToCollectionRequest = {
  contract_address: 'EXAMPLE_ADDRESS',
  metadata: [
    {
      name: 'EXAMPLE_BOOLEAN',
      type: MetadataSchemaRequestTypeEnum.Boolean,
      filterable: true,
    },
    // ..add rest of schema here
  ],
};

main(argv.k, argv.s, schema, argv.network)
  .then(() => console.log('Metadata schema updated'))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
