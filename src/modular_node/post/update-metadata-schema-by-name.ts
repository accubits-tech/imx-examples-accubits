#!/usr/bin/env node
import {
  MetadataTypes,
  UpdateMetadataSchemaByNameParams,
} from '@imtbl/imx-sdk';
import yargs from 'yargs';
import { updateMetadataSchemaByName } from '../utils/postHelpers/update-metadata-schema-by-name';
import {
  getConfig,
  EthNetwork,
  MetadataApi,
  MetadataApiAddMetadataSchemaToCollectionRequest,
  MetadataSchemaRequestTypeEnum,
  signRaw,
  MetadataApiUpdateMetadataSchemaByNameRequest,
  MetadataSchemaRequest,
} from '@imtbl/core-sdk';
import { getSigner } from 'modular_node/utils/client';

async function main(
  ownerPrivateKey: string,
  tokenAddress: string,
  name: string,
  schema: MetadataSchemaRequest,
  network: string,
): Promise<void> {
  const config = getConfig(network as EthNetwork);
  const metadataApi = new MetadataApi(config.api);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signer = await getSigner(network, ownerPrivateKey);
  const signature = await signRaw(timestamp, signer); // IMX-Signature
  const reqObj: MetadataApiUpdateMetadataSchemaByNameRequest = {
    address: tokenAddress,
    name: name,
    metadataSchemaRequest: schema,
    iMXSignature: signature,
    iMXTimestamp: timestamp,
  };
  const response = await metadataApi.updateMetadataSchemaByName(reqObj);
  console.log(response);
}

const argv = yargs(process.argv.slice(2))
  .usage(
    'Usage: -k <PRIVATE_KEY> -s <SMART_CONTRACT_ADDRESS> -n <NAME> --network <NETWORK>',
  )
  .options({
    k: { describe: 'wallet private key', type: 'string', demandOption: true },
    s: {
      describe: 'smart contract address',
      type: 'string',
      demandOption: true,
    },
    n: {
      describe: 'name of metadata schema',
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
const schema: MetadataSchemaRequest = {
  name: 'EXAMPLE_BOOLEAN_UPDATED',
  type: MetadataTypes.Boolean,
  filterable: true,
  // ..add rest of schema here
};

main(argv.k, argv.s, argv.n, schema, argv.network)
  .then(() => console.log('Metadata schema updated'))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
