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
import { SupabaseClient, createClient } from '@supabase/supabase-js';

// SUPABASE: Initialize supabase client.
const supabase_url = process.env.SUPABASE_LINK as string
const supabase_service_key = process.env.SUPABASE_SERVICE_KEY as string
console.log(supabase_url, supabase_service_key)
const supabase: SupabaseClient = createClient(supabase_url, supabase_service_key)

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

// SUPABASE: Get msig wallet for commitment
// In production, get channel based on msig_channel_msig_user join table (i.e. check what channels user belongs to, then subscribe them to it.)
const msig_channel_id = 'moria_test_channel_1717286701644'
const msig_data = await supabase
  .from('msig_wallet')
  .select()
  .eq('channel', msig_channel_id)
if (msig_data.error) throw msig_data.error
console.log(msig_data.data)

const address = msig_data.data[0].msig_address

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

const data = msig_data.data[0].empty_commit_data

const wallet = new BackendWallet(mnemonic, mnemonicPw, Network.Testnet); // PC

const pks: { [address: string]: string[] } = {
  [msig_data.data[0].msig_address]: msig_data.data[0].signers.map((signer: { address: string, pub_keys: string[] }) => signer.pub_keys[0])
};

const commitmentResult = await commit(
  reducedTransaction,
  [wasmInputs],
  data,
  wallet.getWallet(0),
  Network.Testnet,
  pks,
);

const commit_removed_secrets = {

  signed: commitmentResult.signed,
  secrets: data.secrets,
  simulated: commitmentResult.simulated,
  commitments: commitmentResult.commitments

}

const reducedTxBytes = hex.encode(reducedTransaction.sigma_serialize_bytes());

console.log(reducedTxBytes);
console.log(commitmentResult);

// SUPABASE: Store unsigned transaction
const unsigned_tx = await supabase 
  .from('msig_unsigned_tx')
  .insert({
    commit_status: "STARTED",
    sign_status: "PENDING",
    commit_data: commit_removed_secrets,
    creator: msig_data.data[0].creator, // does not have to be this person.
    msig_wallet: msig_data.data[0].id,
    reduced_tx_hex: reducedTxBytes,
    unsigned_tx: tx,
    signature_data: null
  })
  .select()

if (unsigned_tx.error) throw unsigned_tx.error
console.log(unsigned_tx.data)

// SUPABASE: Store user secrets
const user_secrets = await supabase
  .from('msig_user_commit_msig_unsigned_tx')
  .insert({
    msig_user: unsigned_tx.data[0].creator,
    msig_unsigned_tx: unsigned_tx.data[0].id,
    commit_secrets: commitmentResult.secrets
  })
  .select()

if (user_secrets.error) throw user_secrets.error
console.log(user_secrets.data)
