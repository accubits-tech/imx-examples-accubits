import {getConfig, MintsApi, Mint, EthNetwork } from '@imtbl/core-sdk';

interface MintResponse {
  transaction_id: number,
  status: string,
  user: string,
  token: { type: string, data: [Object] },
  timestamp: string
}

/**
 * Return the details of a specific token mint on IMX.
 * 
 * @param mintID - unique mint identifier.
 * @returns 
 */
export async function getMint(mintID: number): Promise<Mint> {
  const network= process.env.ETH_NETWORK
  const config = getConfig(network as EthNetwork);
  const mintsApi = new MintsApi(config.api);
  const response = await mintsApi.getMint({id:mintID.toString()});
  console.log(response)
  return response.data||{};
}