import { getInputBoxes } from '../utils/input-selecter';
import { ExplorerAPI } from '../explorer-api/api';
import { Network, OutputBuilder } from '@fleet-sdk/core';
import { TransactionHelper } from '../utils/transaction-helper';
import { NodeAPI } from '../node-api/api';
import { readFile } from 'fs/promises';
import { ErgoBox } from 'ergo-lib-wasm-nodejs';
import { getReducedTransaction } from '../rust/ReducedTransaction';
import { ErgoContext } from '../rust/ErgoContext';
import { BackendWallet } from '../rust/BackendWallet';
import { hex } from '@fleet-sdk/crypto';
import { commit } from '../multisig/commitment';

const mnemonic =
  'rapid cupboard parrot young diagram animal execute couch remind enlist crash duck draft shoulder fashion';
const mnemonicPw = '';

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
  address,
);

const ergoContext = new ErgoContext(node);
const ctx = await ergoContext.getStateContext();

const reducedTransaction = getReducedTransaction(tx, ctx);

const wasmInputs = ErgoBox.from_json(JSON.stringify(tx.inputs[0]));

const data = {
  commitments: [['', '']],
  secrets: [['', '']],
  signed: [],
  simulated: [],
};

const wallet = new BackendWallet(mnemonic, mnemonicPw, Network.Testnet); // PC

const commitmentResult = await commit(
  reducedTransaction,
  [wasmInputs],
  data,
  wallet.getWallet(0),
  Network.Testnet,
);

const reducedTxBytes = hex.encode(reducedTransaction.sigma_serialize_bytes());

console.log(reducedTxBytes);
console.log(commitmentResult);
