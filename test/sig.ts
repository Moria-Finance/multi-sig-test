import { readFile, writeFile } from 'fs/promises';
import { ExplorerAPI } from '../src/explorer-api/api';
import { NodeAPI } from '../src/node-api/api';
import { getInputBoxes } from '../src/utils/input-selecter';
import { Network, OutputBuilder } from '@fleet-sdk/core';
import { TransactionHelper } from '../src/utils/transaction-helper';
const {
  BlockchainStateContext,
  ProverBuilder$,
  GroupElement$,
} = require('sigmastate-js/main');

const mnemonic = process.env.MNEMONIC!;
const mnemonicPw = process.env.MNEMONIC_PW!; // generally empty for most people

let params;
let file;

try {
  file = await readFile('params.json', 'utf8');
  params = JSON.parse(file);
} catch (error) {
  console.log(error);
}

const { nodeUrl, explorerApi } = params;

const explorer = new ExplorerAPI(explorerApi);
const node = new NodeAPI(nodeUrl);

const address =
  'gG26HKJqFfxo7wEyBmjX7BYZURh3pojtMdxhuf3jcVR5QdUgR2rxLMxQqDnVCL77Q3YL5KncqftcD8JaAjcdQ45tRgZDQruFF9aihKaeT3bnFAVWSnvog5c58';

const inputs = await getInputBoxes(explorer, address, BigInt('1000000000'));

const output = new OutputBuilder(
  '998900000', // Minimum amount of nanoERGs required for a valid UTxO
  '3WwuMNsdLxX1PetQAggX2mnbfJW4CDXuyScqak8UHwv1MSLKRZKr',
);

const transactionHelper = new TransactionHelper(node, mnemonic, mnemonicPw, 0);

const tx = await transactionHelper.buildTransaction(
  inputs,
  output,
  BigInt('1100000'),
);

const currentHeight = await node.getHeight();

const blockHeaders = (
  await node.getBlockByHeight(currentHeight! - 9, currentHeight)
).reverse();

const sigmaJsHeaders = blockHeaders.slice(0, 10).map((headers) => {
  return {
    id: headers.id,
    version: headers.version,
    parentId: headers.parentId,
    ADProofsRoot: headers.adProofsRoot,
    stateRoot: headers.stateRoot,
    transactionsRoot: headers.transactionsRoot,
    timestamp: headers.timestamp,
    nBits: headers.nBits,
    height: headers.height,
    extensionRoot: headers.extensionHash,
    minerPk: headers.powSolutions.pk,
    powOnetimePk: headers.powSolutions.w,
    powNonce: headers.powSolutions.n,
    powDistance: headers.powSolutions.d,
    votes: headers.votes,
  };
});

const preHeader = { ...sigmaJsHeaders[0] };

preHeader.minerPk = GroupElement$.fromPointHex(preHeader.minerPk);

const ctx = new BlockchainStateContext(
  sigmaJsHeaders,
  sigmaJsHeaders[0].stateRoot,
  preHeader,
);

const parameters = await node.getParameters();

const prover = ProverBuilder$.create(parameters!, Network.Testnet).build();

const bigIntReplacer = (key, value) => {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
};

const jsonString = JSON.stringify(ctx, bigIntReplacer, 2);

// Write the JSON string to a file
try {
  await writeFile('ctx.json', jsonString);
  console.log('Data has been written to output.json');
} catch (error) {
  console.log('Error writing to file:', error);
}

const reducedTx = prover.reduce(ctx, tx, tx.inputs, [], [], 100);

console.log(reducedTx);
