import { EthNetwork, getConfig, OrdersApi } from '@imtbl/core-sdk';
let allOrders = [];
const getOrdersList = async (ordersApi, cursor?: string) => {
  const getOrderParam = { orderBy: 'created_at', cursor };
  const getOrdersRes = await ordersApi.listOrders(getOrderParam);
  const orderListData = getOrdersRes?.data || {};
  allOrders = allOrders.concat(orderListData.result);
  // console.log(
  //   'len',
  //   allOrders.length,
  //   orderListData.result.length,
  //   orderListData.remaining,
  // );
  if (orderListData.remaining) {
    await getOrdersList(ordersApi, orderListData.cursor);
  } else console.log('returning', allOrders.length);
  return allOrders;
};
export default async (
  network: EthNetwork,
  privateKey: string,
  id: string,
): Promise<void> => {
  try {
    const config = getConfig(network);
    const ordersApi = new OrdersApi(config.api);
    if (id) {
      // Fetching order details
      const getOrdersRes = await ordersApi.getOrder({ id });
      const order = getOrdersRes?.data || {};
      console.log('order details', order);
    } else {
      //Fetching all orders
      const orders = await getOrdersList(ordersApi);
      console.log('orders list', orders.length);
    }
  } catch (err) {
    console.log(err);
  }
};
