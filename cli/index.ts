require('dotenv').config();
import { program } from 'commander';
import registerUser from './src/1-user-registration';
import getUser from './src/get-user';
import projectCreate from './src/2-create-project';
import collectionCreate from './src/3-create-collection';
import addMetaDataSchema from './src/add-metadata-schema';
import mintsCreate from './src/mints-create';
import ordersGet from './src/orders-get';
import tradesGet from './src/trades-get';
program.version('1.0.0').name('imx');
/*user commands*/
const users = program.command('users');
users
  .command('register')
  .option(
    '-n, --network <string>',
    'network to connect',
    process.env.ETH_NETWORK,
  )
  .requiredOption('-k, --privateKey <string>', 'private key for wallet')
  .requiredOption('-a, --alchemyApiKey <string>', 'alchemy api key')
  .action((options: any) => {
    registerUser(options.network, options.privateKey, options.alchemyApiKey);
  });
users
  .command('get')
  .option(
    '-n, --network <string>',
    'network to connect',
    process.env.ETH_NETWORK,
  )
  .requiredOption('-a, --address <string>', 'wallet address')
  .action((options: any) => {
    getUser(options.network, options.address);
  });
/*Project commands*/
const project = program.command('projects');
project
  .command('create')
  .option(
    '-n, --network <string>',
    'network to connect',
    process.env.ETH_NETWORK,
  )
  .requiredOption('-k, --privateKey <string>', 'private key for wallet')
  .requiredOption('-a, --alchemyApiKey <string>', 'alchemy api key')
  .requiredOption('-p, --projectName <string>', 'name of the project')
  .requiredOption('-c, --companyName <string>', 'name of the company')
  .requiredOption('-e, --contactEmail <string>', 'email of company contact')
  .action((options: any) => {
    projectCreate(
      options.network,
      options.privateKey,
      options.alchemyApiKey,
      options.projectName,
      options.companyName,
      options.contactEmail,
    );
  });
/*collection commands*/
const collection = program.command('collections');
collection
  .command('create')
  .option(
    '-n, --network <string>',
    'network to connect',
    process.env.ETH_NETWORK,
  )
  .requiredOption('-k, --privateKey <string>', 'private key for wallet')
  .requiredOption('-a, --alchemyApiKey <string>', 'alchemy api key')
  .requiredOption(
    '-c, --contractAddress <string>',
    'ethereum address of the ERC721 contract',
  )
  .requiredOption('-n, --name <string>', 'name of the collection')
  .requiredOption(
    '-o, --ownerPublicKey <string>',
    'public key of the owner of the contract',
  )
  .requiredOption('-p, --projectId <string>', "collection's numeric project ID")
  .action((options: any) => {
    collectionCreate(
      options.network,
      options.privateKey,
      options.alchemyApiKey,
      options.contractAddress,
      options.name,
      options.ownerPublicKey,
      +options.projectId,
    );
  });
/*metadata commands*/
const metadata = program.command('metadata');
metadata
  .command('post')
  .option(
    '-n, --network <string>',
    'network to connect',
    process.env.ETH_NETWORK,
  )
  .requiredOption('-k, --privateKey <string>', 'private key for wallet')
  .requiredOption('-a, --alchemyApiKey <string>', 'alchemy api key')
  .requiredOption(
    '-c, --collectionAddress <string>',
    'address of the collection',
  )
  .requiredOption('-m, --name <string>', 'meta data name')
  .requiredOption('-f, --filterable', 'meta data filterable parameter')
  .action((options: any) => {
    addMetaDataSchema(
      options.network,
      options.privateKey,
      options.alchemyApiKey,
      options.collectionAddress,
      options.name,
      options.filterable,
    );
  });
/*mints commands*/
const mints = program.command('mints');
mints
  .command('create')
  .option(
    '-n, --network <string>',
    'network to connect',
    process.env.ETH_NETWORK,
  )
  .requiredOption('-k, --privateKey <string>', 'private key for wallet')
  .requiredOption('-a, --alchemyApiKey <string>', 'alchemy api key')
  .requiredOption(
    '-c, --contractAddress <string>',
    'ethereum address of the ERC721 contract',
  )
  .requiredOption('-b, --blueprint <string>', 'blueprint')
  .action((options: any) => {
    mintsCreate(
      options.network,
      options.privateKey,
      options.alchemyApiKey,
      options.contractAddress,
      options.blueprint,
    );
  });
const orders = program.command('orders');
orders
  .command('get')
  .option(
    '-n, --network <string>',
    'network to connect',
    process.env.ETH_NETWORK,
  )
  .requiredOption('-k, --privateKey <string>', 'private key for wallet')
  .option('--id <string>', 'id of order')
  .action((options: any) => {
    ordersGet(options.network, options.privateKey, options.id);
  });
const trades = program.command('trades');
trades
  .command('get')
  .option(
    '-n, --network <string>',
    'network to connect',
    process.env.ETH_NETWORK,
  )
  .requiredOption('-k, --privateKey <string>', 'private key for wallet')
  .option('--id <string>', 'id of order')
  .action((options: any) => {
    tradesGet(options.network, options.privateKey, options.id);
  });
// trades
//   .command("create")
//   .option("--privateKey <string>", "private key for wallet")
//   .option("--alchemyApiKey <string>", "alchemy api key")
//   .option("--orderId <string>", "id of order")
//   .action((options: any) => {
//     tradesCreate(options.privateKey, options.alchemyApiKey, options.orderId);
//   });
program.parse();
