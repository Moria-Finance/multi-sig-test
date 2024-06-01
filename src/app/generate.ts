import * as ecc from 'tiny-secp256k1';
import { BIP32Factory } from 'bip32';
import { ErgoAddress } from '@fleet-sdk/core';
import { Network } from '@fleet-sdk/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NetworkPrefix } from 'ergo-lib-wasm-nodejs';

// SUPABASE: Initialize supabase client.
const supabase_url = process.env.SUPABASE_LINK as string
const supabase_service_key = process.env.SUPABASE_SERVICE_KEY as string
console.log(supabase_url, supabase_service_key)
const supabase: SupabaseClient = createClient(supabase_url, supabase_service_key)

const bip32 = BIP32Factory(ecc);

// const getBase58ExtendedPublicKey = (extended_public_key: string) => {
//   if (isValidExtendedPublicKeyBase58(extended_public_key))
//     return extended_public_key;
//   const fromBase64 = getExtendedPublicKeyBase64OrHexToBase58(
//       extended_public_key,
//       'base64',
//   );
//   if (fromBase64) return fromBase64;
//   const fromHex = getExtendedPublicKeyBase64OrHexToBase58(
//       extended_public_key,
//       'hex',
//   );
//   if (fromHex) return fromHex;
//   return getExtendedPublicKeyFromEip0003(extended_public_key);
// };

const uInt8Vlq = (value: number) => {
  const res = [];
  while (value > 0) {
    if ((value & ~0x7f) === 0) {
      res.push(value);
      break;
    } else {
      res.push((value & 0x7f) | 0x80);
      value = value >> 7;
    }
  }
  return Buffer.from(Uint8Array.from(res)).toString('hex');
};

const int8Vlq = (value: number) => {
  const sign = value > 0 ? 0 : 1;
  value = (value << 1) + sign;
  return uInt8Vlq(value);
};

const iterateIndexes = (length: number) => {
  return {
    forEach: (callback: (index: number) => unknown) => {
      for (let index = 0; index < length; index++) {
        callback(index);
      }
    },
  };
};

const generateMultiSigV1AddressFromPublicKeys = (
  publicKeys: Array<string>,
  minSign: number,
  prefix: Network,
) => {
  let ergoTree = '10' + uInt8Vlq(publicKeys.length + 1);
  ergoTree += '04' + int8Vlq(minSign);
  publicKeys.sort().forEach((item) => (ergoTree += '08cd' + item));
  ergoTree += '987300';
  ergoTree += `83${uInt8Vlq(publicKeys.length)}08`; // add coll operation
  iterateIndexes(publicKeys.length).forEach(
    (index: number) => (ergoTree += '73' + uInt8Vlq(index + 1)),
  );

  return ErgoAddress.fromErgoTree(ergoTree).toString(prefix);
};

const xpubs = [
  'xpub6FQV2qbwPeW24osq6AyejYhpmyWkTuewoienVJDFC2u9EBv4doucz6eK6w7a21A6wmWk8qPFn3WjYPfcTBVNNFJdkm13y3J1uJyEDypa9Bb',
  'xpub6E1HSNjA3Ji7EJqErXJ7uPmK6irB9ma3kCrRnpgqqFM3fJQ88HYe86722cEnJQ6ZqQbY6y8F6wX4pWes1yzYGSVgpMVxWwRNzeYeByotFZ3',
];

const publicKeys = xpubs.map((item) => {
  const item_b58 = item;
  if (item_b58) {
    const pub = bip32.fromBase58(item_b58);
    const derived1 = pub.derive(0);
    return derived1.publicKey.toString('hex');
  }
  throw Error('invalid pubkey');
});

const network = (process.env.NETWORK === "mainnet") ? Network.Mainnet : Network.Testnet
const keys = publicKeys.map((key) => [key])
const addresses = publicKeys.map((key) => ErgoAddress.fromPublicKey(key, network).toString(network))
const zips = addresses.map((address, index, array) => { 
  return { address: address , pub_keys: keys[index] } 
})
console.log("addresses: ", addresses)
const msig = generateMultiSigV1AddressFromPublicKeys(publicKeys, 2, 0);
const msig_name = "moria_test_wallet_" + Date.now()
const msig_size = 2
const msig_threshold = 2
const msig_creator = addresses[0]

const generateEmptyCommitData = (ring_size: number) => {

  return {
    commitments: [Array(ring_size).fill('')],
    secrets: [Array(ring_size).fill('')],
    signed: [],
    simulated: [],
  };

}

// SUPABASE: Insert multisig wallet info into the db.

// 1. add channel
const channel_name = msig_name + '_' + Date.now()
const channel = supabase.channel(channel_name)

const channel_data = await supabase
  .from('msig_channel')
  .insert({
  name: channel_name,
  creator: msig_creator,
  members: [msig_creator]
  })
  .select()

if (channel_data.data) {
  console.log("channel_data: ", channel_data.data)
} else {
  console.log("channel_error: ", channel_data.error)
}

// 2. add msig data
// get channel
const channel_id = await supabase
  .from('msig_channel')
  .select('id')
  .eq('name', channel_name)

if (channel_id.data) {
  const msig_data = await supabase
  .from('msig_wallet')
  .insert({
    name: msig_name,
    ring_size: msig_size,
    ring_threshold: msig_threshold,
    empty_commit_data: generateEmptyCommitData(msig_size),
    msig_address: msig,
    creator: msig_creator,
    channel: channel_id.data[0].id,
    signers: zips
  })
  .select()
  
  if (msig_data.data) {
    console.log("multisig_data: ", msig_data.data)
  } else {
    console.log("multisig_error: ", msig_data.error)
  }

} else {
  console.log("failed to get channel id: ", channel_id.error)
}


// SUPABASE: Add confirmed user for testing
// const addUser = async (address: string) => {

//   try {

//     await supabase
//       .from('confirmed_users')
//       .insert({
//         address: addresses[0],
//         metadata: { status: "test_user" }
//       })

//   } catch (error) {
//     console.log(error)
//   }

// }
