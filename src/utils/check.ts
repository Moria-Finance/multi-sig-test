import { NodeAPI } from '../node-api/api';
import { ExplorerAPI } from '../explorer-api/api';
import logger from '../logger/logger';

export function checkEnv(result: any): boolean {
  if (result.error) {
    logger.error('Could not find .env file, exiting application.');
    return false;
  }

  const envVariables = ['MNEMONIC', 'MNEMONIC_PW', 'ADDRESS_INDEX'];

  for (const env of envVariables) {
    if (
      process.env[env] === undefined ||
      (process.env[env] === '' && env !== 'MNEMONIC_PW')
    ) {
      logger.error(
        `Required environment variable ${env} is not defined, exiting application.`,
      );
      return false;
    }
  }

  return true;
}

export async function checkApi(
  nodeUrl: string,
  explorerApiUrl: string,
): Promise<boolean> {
  const nodeApi = new NodeAPI(nodeUrl);
  const explorerApi = new ExplorerAPI(explorerApiUrl);

  try {
    const nodeNetwork = await nodeApi.getNetwork();
    const nodeHeight = await nodeApi.getHeight();
    if (!nodeNetwork || !nodeHeight) {
      logger.error(`Error connecting to node at URL ${nodeUrl}`);
      return false;
    }

    const explorerState = await explorerApi.getNetworkState();
    if (!explorerState) {
      logger.error(`Error connecting to explorer at URL ${explorerApiUrl}`);
      return false;
    }

    if (Math.abs(explorerState.height - nodeHeight) > 2) {
      logger.error(
        `Explorer at ${explorerApiUrl} and node at ${nodeUrl} are not on the same network or significantly out of sync`,
      );
      return false;
    }

    logger.info(
      `Connected to ${nodeNetwork} at height ${nodeHeight} (Node URL: ${nodeUrl}, Explorer URL: ${explorerApiUrl})`,
    );
  } catch (error) {
    logger.error(`Error connecting to node or explorer: ${error}`);
    return false;
  }

  return true;
}
