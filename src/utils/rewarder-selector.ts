import { NodeAPI } from '../node-api/api';
// import {getMinerContract} from "./compiler";
import { ErgoAddress, Network } from '@fleet-sdk/core';

export async function getRewardAddresses(
  startHeight: number,
  currentHeight: number,
  rewardInterval: number,
  nodeApi: NodeAPI,
  network: Network = Network.Mainnet,
  blacklist: string[],
): Promise<string[]> {
  const chosenMiners: string[] = [];
  let intervalMiners: string[] = [];

  // fetch blocks within the range and map to their miner addresses
  const blocks = (
    await nodeApi.getBlockByHeight(startHeight, currentHeight)
  ).map((block) => {
    const pubKey = block.powSolutions.pk;
    const address = ErgoAddress.fromPublicKey(pubKey).toString(network);
    const minerAddress = ''; // getMinerContract(address, network);
    return { ...block, address, minerPk: minerAddress };
  });

  blocks.forEach((block, index) => {
    const isBlacklisted = blacklist.some((miner) => miner === block.minerPk);
    if (!isBlacklisted) {
      intervalMiners.push(block.address);
    }

    // check if the current block height is at the end of an interval
    if ((index + 1) % rewardInterval === 0) {
      // choose a random miner from the interval
      const randomIndex = Math.floor(Math.random() * intervalMiners.length);
      chosenMiners.push(intervalMiners[randomIndex]);

      // reset the interval miners for interval
      intervalMiners = [];
    }
  });

  return chosenMiners;
}
