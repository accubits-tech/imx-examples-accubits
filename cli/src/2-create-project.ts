import { AlchemyProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import {
  EthNetwork,
  getConfig,
  ProjectsApi,
  ProjectsApiCreateProjectRequest,
  signRaw,
} from '@imtbl/core-sdk';

export default async (
  network: EthNetwork,
  privateKey: string,
  alchemyApiKey: string,
  projectName: string,
  companyName: string,
  contactEmail: string,
): Promise<void> => {
  try {
    const config = getConfig(network);
    const provider = new AlchemyProvider(network, alchemyApiKey);
    const user = new Wallet(privateKey).connect(provider);
    //generate authorisation headers
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = await signRaw(timestamp, user);
    //Create a new project
    const projectsApi = new ProjectsApi(config.api);
    const createProjectParams: ProjectsApiCreateProjectRequest = {
      createProjectRequest: {
        name: projectName,
        company_name: companyName,
        contact_email: contactEmail,
      },
      iMXSignature: signature,
      iMXTimestamp: timestamp,
    };
    const createProjectRes = await projectsApi.createProject(
      createProjectParams,
    );
    const project = createProjectRes?.data;
    console.log('Created project', project);
  } catch (err) {
    console.log(err);
  }
};
