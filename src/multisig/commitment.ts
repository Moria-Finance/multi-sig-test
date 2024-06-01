import {
  Address,
  HintsBag,
  ReducedTransaction,
  Transaction,
  TransactionHintsBag,
  UnsignedTransaction,
  Wallet,
  ErgoBox,
} from 'ergo-lib-wasm-nodejs';
import { Network } from '@fleet-sdk/core';
import { encrypt } from '../utils/enc';

export interface MultiSigData {
  commitments: Array<Array<string>>;
  secrets: Array<Array<string>>;
  signed: Array<string>;
  simulated: Array<string>;
  partial?: Transaction;
}

export const commit = async (
  tx: ReducedTransaction,
  boxes: Array<ErgoBox>,
  data: MultiSigData,
  prover: Wallet,
  network: Network,
): Promise<MultiSigData> => {
  const myCommitments = await generateCommitments(prover, tx);
  const unsigned = tx.unsigned_tx();
  const known = await hintBagToArray(
    unsigned,
    boxes,
    myCommitments.public,
    network,
  );
  const own = await hintBagToArray(
    unsigned,
    boxes,
    myCommitments.private,
    network,
    'mypw',
  );
  const newCommitments = overridePublicCommitments(data.commitments, known);
  const newPrivateCommitments = overridePublicCommitments(data.secrets, own);

  return {
    commitments: newCommitments.commitments,
    secrets: newPrivateCommitments.commitments,
    signed: data.signed,
    simulated: data.simulated,
  };
};

const generateCommitments = async (wallet: Wallet, tx: ReducedTransaction) => {
  const commitment = wallet.generate_commitments_for_reduced_transaction(tx);
  return extractCommitments(commitment, tx.unsigned_tx().inputs().len());
};

const extractCommitments = (
  commitment: TransactionHintsBag,
  inputLength: number,
) => {
  const tx_known = TransactionHintsBag.empty();
  const tx_own = TransactionHintsBag.empty();
  for (let index = 0; index < inputLength; index++) {
    const input_commitments = commitment.all_hints_for_input(index);
    const input_known = HintsBag.empty();
    if (input_commitments.len() > 0) {
      input_known.add_commitment(input_commitments.get(0));
      tx_known.add_hints_for_input(index, input_known);
    }
    const input_own = HintsBag.empty();
    if (input_commitments.len() > 1) {
      input_own.add_commitment(input_commitments.get(1));
      tx_own.add_hints_for_input(index, input_own);
    }
  }
  return {
    public: tx_known,
    private: tx_own,
  };
};

const hintBagToArray = async (
  tx: UnsignedTransaction | Transaction,
  boxes: Array<ErgoBox>,
  commitment: TransactionHintsBag,
  network: Network,
  password?: string,
) => {
  const inputPKs = await getInputPks(tx, boxes, network);
  return commitmentToByte(commitment, inputPKs, password);
};

const commitmentToByte = (
  commitment: TransactionHintsBag,
  inputPublicKeys: Array<Array<string>>,
  password?: string,
): Array<Array<string>> => {
  const json = commitment.to_json()['publicHints'];
  return inputPublicKeys.map((rowPublicKeys, index) => {
    const hints = json[`${index}`] || [];
    const rowCommitments = rowPublicKeys.map(() => '');
    hints.forEach(
      (item: { pubkey: { h: string }; a: string; secret: string }) => {
        const pubIndex = rowPublicKeys.indexOf(item.pubkey.h);
        if (pubIndex >= 0)
          rowCommitments[pubIndex] =
            password !== undefined
              ? encrypt(Buffer.from(item.secret, 'hex'), password)
              : Buffer.from(item.a, 'hex').toString('base64');
      },
    );
    return rowCommitments;
  });
};

const getInputPks = async (
  tx: UnsignedTransaction | Transaction,
  boxes: Array<ErgoBox>,
  network: Network,
): Promise<Array<Array<string>>> => {
  // const pks: { [address: string]: string[] } = { multisigAddr: ['pubKey', 'pubkey'] };
  const pks: { [address: string]: string[] } = {
    gG26HKJqFfxo7wEyBmjX7BYZURh3pojtMdxhuf3jcVR5QdUgR2rxLMxQqDnVCL77Q3YL5KncqftcD8JaAjcdQ45tRgZDQruFF9aihKaeT3bnFAVWSnvog5c58:
      [
        '02aa9ef05d5a178d53bd34be0730c958f82155307e7e2e2a436f60a5414dbcaf04',
        '03ef05f4324f39ddeb57e21c88e5c9d3ed2653af30aeec65b70f836ce259a69a20',
      ],
  };
  const inputMap = await getInputMap(boxes, network);
  const inputs = tx.inputs();
  return createEmptyArrayWithIndex(inputs.len())
    .map((index) => inputs.get(index))
    .map((box) => inputMap[box.box_id().to_str()])
    .map((address) => pks[address] || []);
};

const getInputMap = async (
  boxes: Array<ErgoBox>,
  networkType: Network,
): Promise<{ [boxId: string]: string }> => {
  const res: { [boxId: string]: string } = {};
  createEmptyArrayWithIndex(boxes.length).forEach((index) => {
    const box = boxes[index];
    res[box.box_id().to_str()] = Address.recreate_from_ergo_tree(
      box.ergo_tree(),
    ).to_base58(networkType);
  });
  return res;
};

const createEmptyArrayWithIndex = (length: number): Array<number> => {
  const res: Array<number> = [];
  for (let index = 0; index < length; index++) {
    res.push(index);
  }
  return res;
};

const overridePublicCommitments = (
  baseCommitments: Array<Array<string>>,
  override: Array<Array<string>>,
): { commitments: Array<Array<string>>; changed: boolean } => {
  if (baseCommitments.length !== override.length) {
    return { commitments: [...override], changed: true };
  }
  let changed = false;
  const commitments = baseCommitments.map((inputCommitments, index) => {
    const overrideRow = override[index];
    return inputCommitments.map((commitment, index) => {
      if (overrideRow[index] !== commitment && overrideRow[index] !== '') {
        changed = true;
        return overrideRow[index];
      }
      return overrideRow[index] ? overrideRow[index] : commitment;
    });
  });
  return {
    commitments: commitments,
    changed: changed,
  };
};
