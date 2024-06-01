import { Network } from '@fleet-sdk/core';
import { ErgoBox, ReducedTransaction } from 'ergo-lib-wasm-nodejs';
import { BackendWallet } from '../rust/BackendWallet';
import { hex } from '@fleet-sdk/crypto';
import { readFile } from 'fs/promises';
import { NodeAPI } from '../node-api/api';
import { commit } from '../multisig/commitment';

const mnemonic2 =
  'swim gym asset pipe improve dismiss eagle federal december play habit culture innocent sleep exist';
const mnemonicPw = '';

let params;
let file;

try {
  file = await readFile('params.json', 'utf8');
  params = JSON.parse(file);
} catch (error) {
  console.log(error);
}

const { nodeUrl } = params;

const node = new NodeAPI(nodeUrl);

const data = {
  commitments: [['ArLgf4HY611QJfgIcK6ltBsKpvlSpgr12yUEV8q5t2MA', '']],
  secrets: [['', '']],
  signed: [],
  simulated: [],
};

const reducedTxHexString =
  'a402016c7fe9866aa0d9abe3bf774878b32d6235c686650fff54c4fb3cdfe4d86e2d7d0000000003a082a8dc030008cd02aa9ef05d5a178d53bd34be0730c958f82155307e7e2e2a436f60a5414dbcaf04a3a7480000e091431005040004000e36100204a00b08cd0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798ea02d192a39a8cc7a701730073011001020402d19683030193a38cc7b2a57300000193c2b2a57301007473027303830108cdeeac93b1a57304a3a7480000e0c2f4e9851d1003040408cd02aa9ef05d5a178d53bd34be0730c958f82155307e7e2e2a436f60a5414dbcaf0408cd03ef05f4324f39ddeb57e21c88e5c9d3ed2653af30aeec65b70f836ce259a69a2098730083020873017302a3a74800009602cd02aa9ef05d5a178d53bd34be0730c958f82155307e7e2e2a436f60a5414dbcaf04cd03ef05f4324f39ddeb57e21c88e5c9d3ed2653af30aeec65b70f836ce259a69a200000';

const reducedTransaction = ReducedTransaction.sigma_parse_bytes(
  hex.decode(reducedTxHexString),
);

const inputIds = reducedTransaction
  .unsigned_tx()
  .to_js_eip12()
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  .inputs.map((input) => input.boxId);

console.log(inputIds);

const inputs = await node.getUtxos(inputIds);

const wasmInputs = inputs!.map((input) =>
  ErgoBox.from_json(JSON.stringify(input)),
);

const wallet = new BackendWallet(mnemonic2, mnemonicPw, Network.Testnet); // Phone

const commitmentResult = await commit(
  reducedTransaction,
  wasmInputs,
  data,
  wallet.getWallet(0),
  Network.Testnet,
);

console.log(commitmentResult);
