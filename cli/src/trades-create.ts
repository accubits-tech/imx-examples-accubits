import { AlchemyProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import {
  CollectionsApi,
  CollectionsApiCreateCollectionRequest,
  EthNetwork,
  getConfig,
  signRaw,
  MetadataApi,
  MetadataApiAddMetadataSchemaToCollectionRequest,
  MetadataSchemaRequestTypeEnum,
  Workflows,
  GetSignableTradeRequest,
  generateStarkWallet
} from '@imtbl/core-sdk';

function random(): number {
  const min = 1;
  const max = 1000000000;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
export default async (privateKey:string, alchemyApiKey:string, orderId:number ): Promise<void> => {
  try {
    const ETH_NETWORK= process.env.ETH_NETWORK||"ropsten";
    console.log("trades create",privateKey,alchemyApiKey, orderId, ETH_NETWORK)
  const config = getConfig(ETH_NETWORK as EthNetwork);
  const provider = new AlchemyProvider(ETH_NETWORK, "");
  const signer = new Wallet(privateKey).connect(provider)
  const starkWallet = await generateStarkWallet(signer);
  const workflows = new Workflows(config);
  const createTradeParams: GetSignableTradeRequest = {
    user: signer.address,
    order_id: orderId,
  };
  const tradesResponse = await workflows.createTrade(signer, starkWallet, createTradeParams);
  console.log('Trade completed:');
  console.log(tradesResponse);
  } catch (err){
    console.log(err)
   
  }
}
