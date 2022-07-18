import { AlchemyProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import {
  BaseSigner,
  EthNetwork,
  generateStarkWallet,
  getConfig,
  GetSignableTradeRequest,
  Workflows,
} from '@imtbl/core-sdk';

export default async (
  network: EthNetwork,
  privateKey: string,
  alchemyApiKey: string,
  orderId: number,
): Promise<void> => {
  try {
    const config = getConfig(network);
    const provider = new AlchemyProvider(network, alchemyApiKey);
    const signer = new Wallet(privateKey).connect(provider);
    const starkWallet = await generateStarkWallet(signer);
    const workflows = new Workflows(config);
    const createTradeParams: GetSignableTradeRequest = {
      user: signer.address,
      order_id: +orderId,
    };
    const tradesResponse = await workflows.createTradeWithSigner(
      signer,
      new BaseSigner(starkWallet.starkKeyPair),
      createTradeParams,
    );
    console.log('Trade completed:');
    console.log(tradesResponse);
  } catch (err) {
    console.log(err);
  }
};
