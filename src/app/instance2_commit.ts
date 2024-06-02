import { Network } from '@fleet-sdk/core';
import { ErgoBox, ReducedTransaction } from 'ergo-lib-wasm-nodejs';
import { BackendWallet } from '../rust/BackendWallet';
import { hex } from '@fleet-sdk/crypto';
import { readFile } from 'fs/promises';
import { NodeAPI } from '../node-api/api';
import { commit } from '../multisig/commitment';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

// SUPABASE: Initialize supabase client.
const supabase_url = process.env.SUPABASE_LINK as string
const supabase_service_key = process.env.SUPABASE_SERVICE_KEY as string
console.log(supabase_url, supabase_service_key)
const supabase: SupabaseClient = createClient(supabase_url, supabase_service_key)

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

// Supabase: Get a channel this user belongs to.
const second_user = '3WzNDoTs6sJBaBHXwMAXEGz8gFrHMcy6Y4GszD1evZgELZ6QvbRc'
const channel_user = await supabase
  .from('msig_channel_msig_user')
  .select('channel')
  .eq('member', second_user)

if (channel_user.error) throw channel_user.error
console.log("channels user belongs to: ", channel_user.data)

// select a channel
const channel_id = channel_user.data.pop()?.channel

// get wallet from channel
const msig_wallet = await supabase
  .from('msig_wallet')
  .select()
  .eq('channel', channel_id)

if (msig_wallet.error) throw msig_wallet.error
console.log("wallet from the channel the user belongs to: ", msig_wallet.data)

// get unsigned transactions from wallet, if any exist
const unsigned_txs = await supabase
  .from('msig_unsigned_tx')
  .select()
  .eq('msig_wallet', msig_wallet.data[0].id)

if (unsigned_txs.error) throw unsigned_txs.error
console.log("unsigned transaction in the msig wallet: ", unsigned_txs.data)

// select an unsigned tx
const unsigned_tx = unsigned_txs.data.pop()

const data = unsigned_tx.commit_data

const reducedTxHexString = unsigned_tx.reduced_tx_hex
const reducedTransaction = ReducedTransaction.sigma_parse_bytes(
  hex.decode(reducedTxHexString),
);

const inputs = unsigned_tx.unsigned_tx.inputs

const wasmInputs = inputs!.map((input: any) =>
  ErgoBox.from_json(JSON.stringify(input)),
);

const wallet = new BackendWallet(mnemonic2, mnemonicPw, Network.Testnet); // Phone

const pks: { [address: string]: string[] } = {
  [msig_wallet.data[0].msig_address]: msig_wallet.data[0].signers.map((signer: { address: string, pub_keys: string[] }) => signer.pub_keys[0])
};


const commitmentResult = await commit(
  reducedTransaction,
  wasmInputs,
  data,
  wallet.getWallet(0),
  Network.Testnet,
  pks,
);

console.log(commitmentResult);

const commit_removed_secrets = {

  signed: commitmentResult.signed,
  secrets: data.secrets,
  simulated: commitmentResult.simulated,
  commitments: commitmentResult.commitments

}

const getCommitStatus = (commit: any, wallet: any) => {

  const threshold = wallet.ring_threshold
  const size = wallet.ring_size
  const committed = commit.commitments[0].filter((commit: string) => commit.length > 0).length
  
  if (threshold == committed) {
    return "THRESHOLD_REACHED"
  } else if (threshold < committed) {
    return "THRESHOLD_EXCEEDED"
  } else if (size == committed) {
    return "RING_COMPLETE"
  } else {
    return "STARTED"
  }

}

const update_unsigned_tx = await supabase 
  .from('msig_unsigned_tx')
  .update({
    commit_status: getCommitStatus(commit_removed_secrets, msig_wallet.data[0]),
    commit_data: commit_removed_secrets
  })
  .eq('id', unsigned_tx.id)
  .select()

if (update_unsigned_tx.error) throw update_unsigned_tx.error
console.log("updated unsigned_tx data: ", update_unsigned_tx.data)

// SUPABASE: Store user secrets
const user_secrets = await supabase
  .from('msig_user_commit_msig_unsigned_tx')
  .insert({
    msig_user: second_user,
    msig_unsigned_tx: unsigned_tx.id,
    commit_secrets: commitmentResult.secrets
  })
  .select()

if (user_secrets.error) throw user_secrets.error
console.log("user secrets: ", user_secrets.data)
