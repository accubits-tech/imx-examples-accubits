import { AlchemyProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import {
  CollectionsApi,
  CollectionsApiCreateCollectionRequest,
  EthNetwork,
  getConfig,
  signRaw,
} from '@imtbl/core-sdk';

export default async (
  network: EthNetwork,
  privateKey: string,
  alchemyApiKey: string,
  contractAddress: string,
  name: string,
  ownerPublicKey: string,
  projectId: number,
): Promise<void> => {
  try {
    const config = getConfig(network);
    const provider = new AlchemyProvider(network, alchemyApiKey);
    const user = new Wallet(privateKey).connect(provider);
    //generate authorisation headers
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = await signRaw(timestamp, user);
    //Create a new project
    const collectionsApi = new CollectionsApi(config.api);
    const createCollectionParams: CollectionsApiCreateCollectionRequest = {
      createCollectionRequest: {
        contract_address: contractAddress,
        name: name,
        owner_public_key: ownerPublicKey,
        project_id: projectId,
      },
      iMXSignature: signature,
      iMXTimestamp: timestamp,
    };
    const createCollectionRes = await collectionsApi.createCollection(
      createCollectionParams,
    );
    const collection = createCollectionRes?.data;
    console.log('Created collection', collection);
  } catch (err) {
    console.log(err);
  }
};
