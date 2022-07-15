import { AlchemyProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import {
  EthNetwork,
  generateStarkWallet,
  getConfig,
  serializeSignature,
  sign,
  signRaw,
  UsersApi,
} from '@imtbl/core-sdk';


export default async (network:EthNetwork,privateKey:string,alchemyApiKey:string): Promise<void> => {
  const config = getConfig(network);
  const usersApi = new UsersApi(config.api);
  const provider = new AlchemyProvider(network,alchemyApiKey);
  const user = new Wallet(privateKey).connect(provider)
  let existingUser;
  let newUser;
  try {
    // Fetching existing user
    const getUserRes = await usersApi.getUsers({user:user.address})
    existingUser=getUserRes?.data||{};
  } catch {
    try {
    const userStarkWallet = await generateStarkWallet(user);
     // Get signable details for offchain registration
    const userSignableResult = await usersApi.getSignableRegistrationOffchain({
    getSignableRegistrationRequest: {
      ether_key: user.address,
      stark_key: userStarkWallet.starkPublicKey,

    },
  });
  const { signable_message: userSignableMessage, payload_hash: userPayloadHash } =
  userSignableResult.data;
  // Sign message with L1 credentials 
  const userEthSignature = await signRaw(userSignableMessage, user);
  // Sign hash with L2 credentials
  const userStarkSignature = serializeSignature(
    sign(userStarkWallet.starkKeyPair, userPayloadHash),
  );
  const registerUserRes = await usersApi.registerUser({
    registerUserRequest: {
      eth_signature: userEthSignature,
      ether_key: user.address,
      stark_signature: userStarkSignature,
      stark_key: userStarkWallet.starkPublicKey,
    },
  });
  newUser=registerUserRes?.data||{}
  }  catch (error) {
      throw new Error(JSON.stringify(error, null, 2));
    }
  }
  if (existingUser) {
    console.log('User already exists', user.address);
  } else {
    console.log('User has been created', user.address);
  }
  console.log(JSON.stringify({ newUser, existingUser }, null, 2));

}
