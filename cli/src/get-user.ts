import { AlchemyProvider } from '@ethersproject/providers';
import {
  EthNetwork,
  getConfig,
  UsersApi,
} from '@imtbl/core-sdk';

export default async (network:EthNetwork,address:string): Promise<void> => {
  try {
  const config = getConfig(network);
  const usersApi = new UsersApi(config.api);
  let existingUser;
    // Fetching user
    const getUserRes = await usersApi.getUsers({user:address})
    existingUser=getUserRes?.data||{};
    console.log("user details",existingUser)
  } catch (err){
    console.log(err)
   
  }
}
