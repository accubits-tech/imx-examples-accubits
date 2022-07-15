import { AlchemyProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import {
  EthNetwork,
  getConfig,
  signRaw,
  MetadataApi,
  MetadataApiAddMetadataSchemaToCollectionRequest,
  MetadataSchemaRequestTypeEnum,
} from '@imtbl/core-sdk';

export default async (
  network: EthNetwork,
  privateKey: string,
  alchemyApiKey: string,
  collectionAddress: string,
  name: string,
  filterable: boolean,
): Promise<void> => {
  try {
    const config = getConfig(network);
    const provider = new AlchemyProvider(network, alchemyApiKey);
    const user = new Wallet(privateKey).connect(provider);
    //generate authorisation headers
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = await signRaw(timestamp, user);
    //Create a new project
    const metadataApi = new MetadataApi(config.api);
    const addMetadataSchemaToCollectionParams: MetadataApiAddMetadataSchemaToCollectionRequest =
      {
        addMetadataSchemaToCollectionRequest: {
          metadata: [
            {
              name: name,
              type: MetadataSchemaRequestTypeEnum.Boolean,
              filterable: filterable,
            },
            // ..add rest of schema here
          ],
        },
        address: collectionAddress,
        iMXSignature: signature,
        iMXTimestamp: timestamp,
      };
    const addMetadataSchemaToCollectionRes =
      await metadataApi.addMetadataSchemaToCollection(
        addMetadataSchemaToCollectionParams,
      );
    const collection = addMetadataSchemaToCollectionRes?.data;
    console.log('Added metadata schema to collection', collection);
  } catch (err) {
    console.log(err);
  }
};
