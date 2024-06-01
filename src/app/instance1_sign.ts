import { Network } from '@fleet-sdk/core';
import { NodeAPI } from '../node-api/api';
import { readFile } from 'fs/promises';
import { ErgoBox, ReducedTransaction } from 'ergo-lib-wasm-nodejs';
import { ErgoContext } from '../rust/ErgoContext';
import { BackendWallet } from '../rust/BackendWallet';
import { hex } from '@fleet-sdk/crypto';
import { sign } from '../multisig/multisign';

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

const { nodeUrl } = params;

const node = new NodeAPI(nodeUrl);

const wallet = new BackendWallet(mnemonic, mnemonicPw, Network.Testnet); // PC

const commitmentResult = {
  commitments: [
    [
      'ArLgf4HY611QJfgIcK6ltBsKpvlSpgr12yUEV8q5t2MA',
      'A7/TPo/Ebg3rfpghpRYZPDPiltWPKXQmuHXW5cLv71Xv',
    ],
  ],
  secrets: [
    [
      'U2FsdGVkX1+L3yk8oUWkMofCy+H2tO4Zr/PuQSxQDJz2XHe+3z9wWhDybVPy1Yop5U///z93xAbh0MdewSh8uv+iDOapC/9efa4UiMsRMGGZkaVkMq20VtOVz0g/O4Xh',
      '',
      //'U2FsdGVkX1885KTby1coTxJ3d6mqQeZz9CtvKwWUyycOenv1kevoTtWUyY3Z1Fu5zhh+1a3+YKTjTHdEqKskboR7V2jITsVQPKGI1A3qrm21PFtc0GWoXR4QLXS59V6v',
    ],
  ],
  signed: [],
  simulated: [],
};

const customWallet = {
  id: 2,
  name: 'Test Multisig',
  networkType: 'Test Net',
  type: 'MULTI_SIG',
  balance: '998998900000',
  tokens: [],
  addresses: [
    {
      address:
        'gG26HKJqFfxo7wEyBmjX7BYZURh3pojtMdxhuf3jcVR5QdUgR2rxLMxQqDnVCL77Q3YL5KncqftcD8JaAjcdQ45tRgZDQruFF9aihKaeT3bnFAVWSnvog5c58',
      walletId: 2,
      balance: '998998900000',
      name: 'Main Address',
      tokens: [],
      idx: 0,
      path: "m/44'/429'/0'/0/0",
      proceedHeight: 1184454,
      id: 2,
    },
  ],
  xPub: 'xpub6FQV2qbwPeW24osq6AyejYhpmyWkTuewoienVJDFC2u9EBv4doucz6eK6w7a21A6wmWk8qPFn3WjYPfcTBVNNFJdkm13y3J1uJyEDypa9Bb',
  requiredSign: 2,
  seed: '',
  version: 1,
};

const signer = {
  // PC signer
  addresses: [
    {
      address: '3WwuMNsdLxX1PetQAggX2mnbfJW4CDXuyScqak8UHwv1MSLKRZKr',
    },
  ],
};

const commited = [
  {
    address: '3WwuMNsdLxX1PetQAggX2mnbfJW4CDXuyScqak8UHwv1MSLKRZKr',
    completed: true,
  },
  {
    address: '3WzNDoTs6sJBaBHXwMAXEGz8gFrHMcy6Y4GszD1evZgELZ6QvbRc',
    completed: true,
  },
];

const signed = [
  {
    address: '3WwuMNsdLxX1PetQAggX2mnbfJW4CDXuyScqak8UHwv1MSLKRZKr',
    completed: false,
  },
  {
    address: '3WzNDoTs6sJBaBHXwMAXEGz8gFrHMcy6Y4GszD1evZgELZ6QvbRc',
    completed: false,
  },
];

const addresses = [
  {
    address: '3WwuMNsdLxX1PetQAggX2mnbfJW4CDXuyScqak8UHwv1MSLKRZKr',
    xPub: 'xpub6FQV2qbwPeW24osq6AyejYhpmyWkTuewoienVJDFC2u9EBv4doucz6eK6w7a21A6wmWk8qPFn3WjYPfcTBVNNFJdkm13y3J1uJyEDypa9Bb',
    pubKeys: [
      '02aa9ef05d5a178d53bd34be0730c958f82155307e7e2e2a436f60a5414dbcaf04',
    ],
  },
  {
    address: '3WzNDoTs6sJBaBHXwMAXEGz8gFrHMcy6Y4GszD1evZgELZ6QvbRc',
    xPub: 'xpub6E1HSNjA3Ji7EJqErXJ7uPmK6irB9ma3kCrRnpgqqFM3fJQ88HYe86722cEnJQ6ZqQbY6y8F6wX4pWes1yzYGSVgpMVxWwRNzeYeByotFZ3',
    pubKeys: [
      '03ef05f4324f39ddeb57e21c88e5c9d3ed2653af30aeec65b70f836ce259a69a20',
    ],
  },
];

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

const ergoContext = new ErgoContext(node);
const ctx = await ergoContext.getStateContext();

// # 1 When PC commits, you get secret ["secret", ""]
// # 2 When the phone commits, you get secret ["", "secret"]

const signResult = await sign(
  customWallet,
  signer, // PC is doing signing
  commitmentResult.simulated, // []
  commitmentResult.commitments, // both commitments are present
  commitmentResult.secrets, // this has to be PC secret
  commited,
  signed,
  addresses,
  reducedTransaction,
  wasmInputs,
  'mypw',
  ctx,
  wallet.getWallet(0),
);

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
signResult.partial = hex.encode(signResult.partial.sigma_serialize_bytes());

console.log(JSON.stringify(signResult));
