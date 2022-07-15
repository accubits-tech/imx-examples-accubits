import { EthNetwork, getConfig, TradesApi } from '@imtbl/core-sdk';
let allTrades = [];
const getTradesList = async (tradesApi: TradesApi, cursor?: string) => {
  const getTradesRes = await tradesApi.listTrades({
    orderBy: 'created_at',
    cursor,
  });
  const tradesListData = getTradesRes?.data;
  if (tradesListData) {
    allTrades = allTrades.concat(tradesListData.result);
    if (tradesListData.remaining)
      await getTradesList(tradesApi, tradesListData.cursor);
    else console.log('allTrades', allTrades);
    return allTrades;
  }
};
export default async (
  network: EthNetwork,
  privateKey: string,
  id: string,
): Promise<void> => {
  try {
    const config = getConfig(network);
    const tradesApi = new TradesApi(config.api);
    if (id) {
      // Fetching trade details
      const getTradesRes = await tradesApi.getTrade({ id });
      const trade = getTradesRes?.data || {};
      console.log('trade details', trade);
    } else {
      //Fetching all trades
      const trades = await getTradesList(tradesApi);
      console.log('trades list', trades);
    }
  } catch (err) {
    console.log(err);
  }
};
