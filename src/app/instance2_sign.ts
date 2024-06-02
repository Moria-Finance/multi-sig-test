import { Network } from '@fleet-sdk/core';
import { NodeAPI } from '../node-api/api';
import { readFile } from 'fs/promises';
import { ErgoBox, ReducedTransaction, Transaction } from 'ergo-lib-wasm-nodejs';
import { ErgoContext } from '../rust/ErgoContext';
import { BackendWallet } from '../rust/BackendWallet';
import { hex } from '@fleet-sdk/crypto';
import { sign } from '../multisig/multisign';
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

const wallet = new BackendWallet(mnemonic2, mnemonicPw, Network.Testnet); // PC

const user_address = "3WzNDoTs6sJBaBHXwMAXEGz8gFrHMcy6Y4GszD1evZgELZ6QvbRc"
const channel_user = await supabase
  .from('msig_channel_msig_user')
  .select('channel')
  .eq('member', user_address)

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

// get user secrets from unsigned tx
const user_secrets = await supabase
  .from('msig_user_commit_msig_unsigned_tx')
  .select('commit_secrets')
  .eq('msig_unsigned_tx', unsigned_tx.id)
  .eq('msig_user', user_address)

if (user_secrets.error) throw user_secrets.error
console.log("the user secrets: ", user_secrets.data)

let data = unsigned_tx.commit_data
data.secrets = user_secrets.data[0].commit_secrets
console.log("commit with secrets: ", data)

const customWallet = {
  addresses: [
    {
      address: msig_wallet.data[0].msig_address
    },
  ],
};

const signer2 = {
  // PC signer
  addresses: [
    {
      address: '3WzNDoTs6sJBaBHXwMAXEGz8gFrHMcy6Y4GszD1evZgELZ6QvbRc',
    },
  ],
};

const getCommitted = async (unsigned_tx: any, msig_wallet: any) => {

  const signers = msig_wallet.signers
  const committed = await supabase
    .from('msig_user_commit_msig_unsigned_tx')
    .select('msig_user')
    .eq('msig_unsigned_tx', unsigned_tx.id)
  if (committed.error) throw committed.error
  console.log(committed.data)

  return signers.map((signer: any) => {

    const has_commit = committed.data.includes(signer.address)

    return {
      address: signer.address,
      completed: has_commit
    }

  })

}

const getSigned = async (unsigned_tx: any, msig_wallet: any) => {

  const signers = msig_wallet.signers
  const signed = await supabase
    .from('msig_user_sign_msig_unsigned_tx')
    .select('msig_user')
    .eq('msig_unsigned_tx', unsigned_tx.id)
  if (signed.error) throw signed.error
  console.log(signed.data)

  return signers.map((signer: any) => {

    const has_signature = signed.data.includes(signer.address)

    return {
      address: signer.address,
      completed: has_signature
    }

  })

}

const committed = await getCommitted(unsigned_tx, msig_wallet.data[0])

const signed2 = await getSigned(unsigned_tx, msig_wallet.data[0])

const addresses = msig_wallet.data[0].signers

const reducedTxHexString = unsigned_tx.reduced_tx_hex

const reducedTransaction = ReducedTransaction.sigma_parse_bytes(
  hex.decode(reducedTxHexString),
);


const inputs = unsigned_tx.unsigned_tx.inputs

const wasmInputs = inputs!.map((input: any) =>
  ErgoBox.from_json(JSON.stringify(input)),
);

const ergoContext = new ErgoContext(node);
const ctx = await ergoContext.getStateContext();

const getOldPartial = (unsigned_tx: any) => {
  const signatureData = unsigned_tx.signature_data
  if (signatureData) {
    return Transaction.sigma_parse_bytes(hex.decode(signatureData.partial))
  } else {
    return undefined
  }
}

const signResult = await sign(
  customWallet,
  signer2,
  data.simulated, // []
  data.commitments, // both commitments are present
  data.secrets, // this has to be PC secret
  committed,
  signed2,
  addresses,
  reducedTransaction,
  wasmInputs,
  'mypw',
  ctx,
  wallet.getWallet(0),
  getOldPartial(unsigned_tx),
);

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
signResult.partial = hex.encode(signResult.partial.sigma_serialize_bytes());
console.log(JSON.stringify(signResult));

const getSignStatus = (signature: any, wallet: any) => {

  const threshold = wallet.msig_threshold
  const size = wallet.msig_size
  const signed = signature.signed.length
  
  if (threshold == signed) {
    return "THRESHOLD_REACHED"
  } else if (threshold > signed) {
    return "THRESHOLD_EXCEEDED"
  } else if (size == signed) {
    return "RING_COMPLETE"
  } else {
    return "STARTED"
  }

}

const update_unsigned_tx = await supabase 
  .from('msig_unsigned_tx')
  .update({
    sign_status: getSignStatus(signResult, msig_wallet.data[0]),
    signature_data: signResult
  })
  .eq('id', unsigned_tx.id)
  .select()

if (update_unsigned_tx.error) throw update_unsigned_tx.error
console.log("updated unsigned_tx data: ", update_unsigned_tx.data)

// SUPABASE: Store user secrets
const user_signature = await supabase
  .from('msig_user_sign_msig_unsigned_tx')
  .insert({
    msig_user: user_address,
    msig_unsigned_tx: unsigned_tx.id,
    user_signature_data: signResult
  })
  .select()

if (user_signature.error) throw user_signature.error
console.log("user secrets: ", user_signature.data)