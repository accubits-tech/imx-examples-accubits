import { AlchemyProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import { EthNetwork, getConfig, Workflows } from '@imtbl/core-sdk';

function random(): number {
  const min = 1;
  const max = 1000000000;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
export default async (
  network: EthNetwork,
  privateKey: string,
  alchemyApiKey: string,
  contractAddress: string,
  blueprint: string,
): Promise<void> => {
  try {
    console.log(
      'mints create',
      network,
      privateKey,
      alchemyApiKey,
      contractAddress,
      blueprint,
    );
    const config = getConfig(network);
    const provider = new AlchemyProvider(network, '');
    const signer = new Wallet(privateKey).connect(provider);

    const workflows = new Workflows(config);
    const mintResponse = await workflows.mint(signer, {
      contract_address: contractAddress,
      users: [
        {
          user: signer.address,
          tokens: [
            {
              id: random().toString(10),
              blueprint: blueprint,
            },
          ],
        },
      ],
    });
    console.log('Mint completed:');
    console.log(mintResponse);
  } catch (err) {
    console.log(err);
  }
};
