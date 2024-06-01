interface PowSolutions {
  pk: string;
  w: string;
  n: string;
  d: number;
}

export interface BlockHeader {
  extensionId: string;
  difficulty: string;
  votes: string;
  timestamp: number;
  size: number;
  stateRoot: string;
  height: number;
  nBits: number;
  version: number;
  id: string;
  adProofsRoot: string;
  transactionsRoot: string;
  extensionHash: string;
  powSolutions: PowSolutions;
  adProofsId: string;
  transactionsId: string;
  parentId: string;
}

export interface Box {
  boxId: string;
  value: bigint;
  ergoTree: string;
  assets: Array<{ tokenId: string; amount: bigint }>;
  creationHeight: number;
  additionalRegisters: {
    R4?: string;
    R5?: string;
    R6?: string;
    R7?: string;
    R8?: string;
    R9?: string;
  };
  transactionId: string;
  index: number;
}
