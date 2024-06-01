import { compile } from '@fleet-sdk/compiler';
import { Network } from '@fleet-sdk/core';

export function compileContract(
  contract: string,
  network: Network,
  version: string,
  includeSize: boolean,
): string {
  // default v1 options
  let options = {};
  if (version == 'v0') {
    options = { version: 0, includeSize: includeSize };
  }
  const tree = compile(contract, options);
  return tree.toAddress(network).toString(network);
}

export function getMinerContract(
  address: string,
  network: Network = Network.Mainnet,
): string {
  const script = `
    {
        val pk = PK("${address}")
        sigmaProp(HEIGHT >= SELF.creationInfo._1 + 720) && pk
    }
    `;
  return compileContract(script, network, 'v0', false);
}
