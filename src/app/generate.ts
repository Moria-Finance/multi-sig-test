import * as ecc from 'tiny-secp256k1';
import { BIP32Factory } from 'bip32';
import { ErgoAddress } from '@fleet-sdk/core';
import { Network } from '@fleet-sdk/common';

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

const msig = generateMultiSigV1AddressFromPublicKeys(publicKeys, 2, 0);

console.log(msig);
