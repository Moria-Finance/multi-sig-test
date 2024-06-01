import {
  Address,
  ErgoBox,
  ErgoBoxes,
  ErgoStateContext,
  extract_hints,
  Propositions,
  ReducedTransaction,
  Transaction,
  TransactionHintsBag,
  UnsignedTransaction,
  Wallet,
} from 'ergo-lib-wasm-nodejs';
import { decrypt } from 'dotenv';

export interface HintType {
  hint: string;
  secret?: string;
  pubkey: {
    op: string;
    h: string;
  };
  type: string;
  a: string;
  position: string;
}

export interface TxHintType {
  [key: string]: Array<HintType>;
}

export interface TransactionHintBagType {
  publicHints: TxHintType;
  secretHints: TxHintType;
}

const extractAndAddSignedHints = async (
  simulated: Array<string>,
  signed: Array<string>,
  currentHints: TransactionHintsBag,
  tx: ReducedTransaction,
  state_context: ErgoStateContext,
  partial?: Transaction,
  boxes: Array<ErgoBox> = [],
) => {
  const simulatedPropositions = arrayToProposition(simulated);
  const realPropositions = arrayToProposition(signed);
  if (partial) {
    const ergoBoxes = ErgoBoxes.empty();
    boxes.forEach((box) => ergoBoxes.add(box));
    const hints = extract_hints(
      partial,
      state_context,
      ergoBoxes,
      // TODO handle data inputs
      ErgoBoxes.empty(),
      realPropositions,
      simulatedPropositions,
    );
    Array(tx.unsigned_tx().inputs().len())
      .fill('')
      .forEach((_item, index) => {
        const inputHints = hints.all_hints_for_input(index);
        currentHints.add_hints_for_input(index, inputHints);
      });
  }
};

const generateHintBagJson = (
  publicKey: string,
  commitment: string,
  index: number,
  secret: string,
  password?: string,
): HintType => {
  const res: HintType = {
    hint: secret ? 'cmtWithSecret' : 'cmtReal',
    pubkey: {
      op: '205',
      h: publicKey,
    },
    type: 'dlog',
    a: Buffer.from(commitment, 'base64').toString('hex').toLowerCase(),
    position: `0-${index}`,
  };
  if (secret && password) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    res['secret'] = decrypt(secret, password).toString('hex');
  }
  return res;
};

const addMyHints = (
  commitments: Array<Array<string>>,
  secrets: Array<Array<string>>,
  publicKeys: Array<Array<string>>,
  myPKs: Array<string>,
  password: string,
) => {
  const myHints: TransactionHintBagType = {
    secretHints: {},
    publicHints: {},
  };
  commitments.forEach((row, rowIndex) => {
    if (
      !Object.prototype.hasOwnProperty.call(myHints.publicHints, `${rowIndex}`)
    ) {
      myHints.publicHints[`${rowIndex}`] = [];
      myHints.secretHints[`${rowIndex}`] = [];
    }
    row.forEach((commit, commitIndex) => {
      const secret = secrets[rowIndex][commitIndex];
      if (secret !== '') {
        const committerPK = publicKeys[rowIndex][commitIndex];
        if (myPKs.includes(committerPK)) {
          myHints.publicHints[`${rowIndex}`].push(
            generateHintBagJson(committerPK, commit, commitIndex, ''),
          );
          myHints.publicHints[`${rowIndex}`].push(
            generateHintBagJson(
              committerPK,
              commit,
              commitIndex,
              secret,
              password,
            ),
          );
        }
      }
    });
  });
  return TransactionHintsBag.from_json(JSON.stringify(myHints));
};

export interface AddressActionRow {
  address: string;
  completed: boolean;
}

export const sign = async (
  wallet: { addresses: Array<{ address: string }> },
  signer: { addresses: Array<{ address: string }> },
  simulated: Array<string>,
  commitments: Array<Array<string>>,
  secrets: Array<Array<string>>,
  committed: Array<AddressActionRow>,
  signed: Array<AddressActionRow>,
  addresses: Array<{ address: string; pubKeys: string[] }>,
  tx: ReducedTransaction,
  boxes: Array<ErgoBox>,
  password: string,
  state_context: ErgoStateContext,
  prover: Wallet,
  oldPartial?: Transaction,
): Promise<{
  partial: Transaction;
  signed: Array<string>;
  simulated: Array<string>;
  currentTime: number;
}> => {
  // generate simulated list
  const simulatedAddress = simulated.length
    ? simulated
    : committed.filter((item) => !item.completed).map((item) => item.address);

  // generate signed
  const signedAddresses = signed
    .filter((item) => item.completed == true)
    .map((item) => item.address);
  const signedPKs = addresses
    .filter((item) => signedAddresses.includes(item.address))
    .reduce((a, b) => [...a, ...b.pubKeys], [] as Array<string>);
  const myPKs = addresses
    .filter((item) => item.address == signer.addresses[0].address)
    .reduce((a, b) => [...a, ...b.pubKeys], [] as Array<string>);
  const unsigned = tx.unsigned_tx();
  const inputPKs = getInputPKs(wallet, addresses, unsigned, boxes);
  const myHints = addMyHints(commitments, secrets, inputPKs, myPKs, password);
  const usedCommitments = removeSignedCommitments(
    commitments,
    inputPKs,
    myPKs,
    signedPKs,
  );
  const publicHintBag = getHintBags(inputPKs, usedCommitments);
  if (signedPKs && signedPKs.length > 0) {
    const simulatedPKs = addresses
      .filter((item) => simulatedAddress.includes(item.address))
      .reduce((a, b) => [...a, ...b.pubKeys], [] as Array<string>);
    await extractAndAddSignedHints(
      simulatedPKs,
      signedPKs,
      publicHintBag,
      tx,
      state_context,
      oldPartial,
      boxes,
    );
  }
  Array(unsigned.inputs().len())
    .fill('')
    .forEach((_item, index) => {
      const myInputHints = myHints.all_hints_for_input(index);
      publicHintBag.add_hints_for_input(index, myInputHints);
    });

  const partial = prover.sign_reduced_transaction_multi(tx, publicHintBag);
  const lastSigned = [...signedAddresses, signer.addresses[0].address].sort();
  const currentTime = Date.now();

  return {
    signed: lastSigned,
    simulated: simulatedAddress,
    partial,
    currentTime,
  };
};

export const arrayToProposition = (input: Array<string>): Propositions => {
  const output = new Propositions();
  input.forEach((pk) => {
    const proposition = Uint8Array.from(Buffer.from('cd' + pk, 'hex'));
    output.add_proposition_from_byte(proposition);
  });
  return output;
};

const getInputPKs = (
  wallet: { addresses: Array<{ address: string }> },
  addresses: Array<{ pubKeys: string[] }>,
  tx: UnsignedTransaction,
  txBoxes: Array<ErgoBox>,
) => {
  const boxes = getTxBoxes(tx, txBoxes);
  const ergoTrees = wallet.addresses.map((item) =>
    Address.from_base58(item.address).to_ergo_tree().to_base16_bytes(),
  );
  return boxes
    .map((box) => box.ergo_tree().to_base16_bytes())
    .map((ergoTree) => ergoTrees.indexOf(ergoTree))
    .map((index) =>
      addresses.map((item) => (index === -1 ? '' : item.pubKeys[index])),
    )
    .map((row) => row.sort());
};

const getTxBoxes = (tx: UnsignedTransaction, boxes: Array<ErgoBox>) => {
  const res: Array<ErgoBox> = [];
  const inputs = tx.inputs();
  for (let index = 0; index < inputs.len(); index++) {
    const filtered = boxes.filter(
      (box) => box.box_id().to_str() === inputs.get(index).box_id().to_str(),
    );
    if (filtered.length === 0) throw Error('invalid boxes');
    res.push(filtered[0]);
  }
  return res;
};

const removeSignedCommitments = (
  commitments: Array<Array<string>>,
  inputPKs: Array<Array<string>>,
  myPKs: Array<string>,
  signedPKs: Array<string>,
) => {
  return commitments.map((commitmentRow, rowIndex) => {
    const rowPks = inputPKs[rowIndex];
    return commitmentRow.map((commitment, pkIndex) => {
      const pk = rowPks[pkIndex];
      if (signedPKs.indexOf(pk) >= 0 || myPKs.indexOf(pk) >= 0) {
        return '';
      }
      return commitment;
    });
  });
};

const getHintBags = (
  publicKeys: Array<Array<string>>,
  commitments: Array<Array<string>>,
): TransactionHintsBag => {
  const publicJson: { [key: string]: Array<HintType> } = {};
  const secretJson: { [key: string]: Array<HintType> } = {};
  publicKeys.forEach((inputPublicKeys, index) => {
    const inputCommitments = commitments[index];
    inputPublicKeys.forEach((inputPublicKey, pkIndex) => {
      if (inputCommitments[pkIndex]) {
        const commitment = generateHintBagJson(
          inputPublicKey,
          inputCommitments[pkIndex],
          pkIndex,
          '',
        );
        if (publicJson[`${index}`]) {
          publicJson[`${index}`].push(commitment);
        } else {
          publicJson[`${index}`] = [commitment];
        }
      }
    });
    secretJson[`${index}`] = [];
  });
  const resJson = { secretHints: secretJson, publicHints: publicJson };
  return TransactionHintsBag.from_json(JSON.stringify(resJson));
};
