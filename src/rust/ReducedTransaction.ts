import { EIP12UnsignedTransaction } from '@fleet-sdk/common';
import {
  ErgoBoxes,
  ErgoStateContext,
  ReducedTransaction,
  UnsignedTransaction,
} from 'ergo-lib-wasm-nodejs';

export function getReducedTransaction(
  fleetUnsignedTx: EIP12UnsignedTransaction,
  stateCtx: ErgoStateContext,
): ReducedTransaction {
  const unsignedTx = UnsignedTransaction.from_json(
    JSON.stringify(fleetUnsignedTx),
  );

  const wasmInputs = ErgoBoxes.from_boxes_json(fleetUnsignedTx.inputs);
  const wasmDataInputs = ErgoBoxes.from_boxes_json(fleetUnsignedTx.dataInputs);
  return ReducedTransaction.from_unsigned_tx(
    unsignedTx,
    wasmInputs,
    wasmDataInputs,
    stateCtx,
  );
}
