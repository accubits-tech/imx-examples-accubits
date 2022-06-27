#!/usr/bin/env node
import yargs from 'yargs';
import {getConfig,AssetsApi, ListAssetsResponse, EthNetwork } from '@imtbl/core-sdk';

/**
 * Return the users current asset holding.
 */
async function getUserAssets(address: string, network: EthNetwork): Promise<ListAssetsResponse> {
  // const client = await getClient(network);
  // const response = await client.getAssets({ user: address });
  const config = getConfig(network); 
  const assetsApi = new AssetsApi(config.api);
  const response = await assetsApi.listAssets({user:address});
  console.log(response)
  return response?.data||{}
}

async function main(walletAddress: string, network: EthNetwork): Promise<void> {
  const response = await getUserAssets(walletAddress, network);
  if (response.result.length === 0) {
    console.log('User has no assets.');
  }
  for (const asset of response.result) {
    console.log(`Token Address: ${asset.token_address}, Token ID: ${asset.token_id}, Name: ${asset.name}`);
  }
}

const argv = yargs(process.argv.slice(2))
  .usage('Usage: -a <ADDRESS>')
  .options({ 
  a: { alias: 'address', describe: 'wallet address', type: 'string', demandOption: true },
  network: { describe: 'network. ropsten or mainnet', type: 'string', demandOption: true}})
  .parseSync();

main(argv.a, argv.network as EthNetwork)
  .catch(err => console.error(err));
