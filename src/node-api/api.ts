import axios from 'axios';
import { BlockHeader, Box } from '../models/node.types';
import logger from '../logger/logger';
import { Params } from '../types/explorer.types';

export class NodeAPI {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    axios.defaults.headers.common['Accept-Encoding'] = 'gzip';
  }
  public async submitTransaction(
    transaction: any,
  ): Promise<{ id: string } | string | undefined> {
    const url = `${this.baseUrl}/transactions`;
    try {
      const response = await axios.post(url, transaction);
      logger.debug(response.data);
      return { id: response.data };
    } catch (error) {
      logger.error(error);
      if ((error as any).response && (error as any).response.data) {
        const info = (error as any).response.data;
        if (info.detail) {
          if (
            info.detail === 'Double spending attempt' ||
            info.detail.startsWith(
              'Malformed transaction: Every input of the transaction',
            ) ||
            info.detail.endsWith('it is already in the mempool') ||
            info.detail.startsWith('Ask timed out')
          ) {
            logger.debug(`ignorable node error: ${info.detail}`);
            return 'retry';
          }
        }
        return undefined;
      }
      return undefined;
    }
  }

  public async getHeight(): Promise<number | undefined> {
    const url = `${this.baseUrl}/info`;
    try {
      return (await axios.get(url)).data.maxPeerHeight;
    } catch (error) {
      logger.error(error);
      return undefined;
    }
  }

  public async getNetwork(): Promise<string | undefined> {
    const url = `${this.baseUrl}/info`;
    try {
      return (await axios.get(url)).data.network;
    } catch (error) {
      logger.error(error);
      return undefined;
    }
  }

  public async getParameters(): Promise<Params | undefined> {
    const url = `${this.baseUrl}/info`;
    try {
      return (await axios.get(url)).data.parameters;
    } catch (error) {
      logger.error(error);
      return undefined;
    }
  }

  public async getBlockByHeight(
    startHeightInclusive: number,
    endHeightInclusive?: number,
  ): Promise<BlockHeader[]> {
    let url: string;
    if (!endHeightInclusive) {
      url = `${this.baseUrl}/blocks/chainSlice?fromHeight=${startHeightInclusive}&toHeight=${startHeightInclusive}`;
    } else {
      if (endHeightInclusive < startHeightInclusive) {
        logger.error('end height smaller than start height');
        return [];
      }

      url = `${this.baseUrl}/blocks/chainSlice?fromHeight=${startHeightInclusive - 1}&toHeight=${endHeightInclusive}`;
    }
    try {
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      logger.error(error);
      return [];
    }
  }

  public async getUtxos(boxIds: string[]): Promise<Box[] | undefined> {
    const url = `${this.baseUrl}/utxo/withPool/byIds`;
    try {
      return (await axios.post(url, boxIds)).data;
    } catch (error) {
      logger.error(error);
      return undefined;
    }
  }
}
