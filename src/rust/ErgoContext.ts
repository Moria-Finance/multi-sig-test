import {
  BlockHeaders,
  ErgoStateContext,
  PreHeader,
} from 'ergo-lib-wasm-nodejs';
import { BlockHeader } from '../models/node.types';
import { NodeAPI } from '../node-api/api';

export class ErgoContext {
  constructor(public readonly nodeApi: NodeAPI) {}

  public async getStateContext(): Promise<ErgoStateContext> {
    const currentHeight = await this.nodeApi.getHeight();

    if (!currentHeight) {
      throw new Error('issue current height');
    }

    const blockHeaders = (
      await this.nodeApi.getBlockByHeight(currentHeight - 9, currentHeight)
    ).reverse();

    return this.getErgoStateContext(blockHeaders);
  }

  private async getErgoStateContext(
    blockHeaders: BlockHeader[],
  ): Promise<ErgoStateContext> {
    const explorerHeaders = blockHeaders.slice(0, 10);
    const block_headers = BlockHeaders.from_json(explorerHeaders);
    const pre_header = PreHeader.from_block_header(block_headers.get(0));
    return new ErgoStateContext(pre_header, block_headers);
  }
}
