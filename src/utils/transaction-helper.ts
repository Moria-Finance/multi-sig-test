import { BackendWallet } from '../rust/BackendWallet';
import {
  Amount,
  Box,
  CollectionLike,
  Network,
  OutputBuilder,
  TransactionBuilder,
} from '@fleet-sdk/core';
import { NodeAPI } from '../node-api/api';
import {
  EIP12UnsignedTransaction,
  OneOrMore,
  SignedTransaction,
} from '@fleet-sdk/common';

export class TransactionHelper {
  public readonly backendWallet: BackendWallet;
  private readonly nodeApi: NodeAPI;
  private readonly walletIndex: number;
  constructor(
    nodeApi: NodeAPI,
    walletMnemonic: string,
    walletPassword?: string,
    walletIndex?: number,
    network?: Network,
  ) {
    this.nodeApi = nodeApi;
    this.backendWallet = new BackendWallet(
      walletMnemonic,
      walletPassword,
      network,
    );
    this.walletIndex = walletIndex ? walletIndex : 0;
  }

  public async buildTransaction(
    inputs: OneOrMore<Box<Amount>> | CollectionLike<Box<Amount>>,
    outputs: OneOrMore<OutputBuilder>,
    nanoErgMinerFee: bigint = BigInt(100000),
    changeAddress?: string,
  ): Promise<EIP12UnsignedTransaction> {
    const blockHeight = await this.nodeApi.getHeight();

    if (!blockHeight) {
      throw new Error('issue getting block height');
    }

    return new TransactionBuilder(blockHeight)
      .from(inputs)
      .to(outputs)
      .sendChangeTo(
        changeAddress
          ? changeAddress
          : this.backendWallet.getAddress(this.walletIndex),
      )
      .payFee(nanoErgMinerFee)
      .build()
      .toEIP12Object();
  }

  public async signTransaction(
    unsignedTransaction: EIP12UnsignedTransaction,
  ): Promise<SignedTransaction> {
    const currentHeight = await this.nodeApi.getHeight();

    if (!currentHeight) {
      throw new Error('issue current height');
    }

    const blockHeaders = (
      await this.nodeApi.getBlockByHeight(currentHeight - 9, currentHeight)
    ).reverse();

    if (blockHeaders.length === 0) {
      throw new Error('issue getting block headers');
    }

    return this.backendWallet.signTransaction(
      unsignedTransaction,
      blockHeaders,
      this.walletIndex,
    );
  }
}
