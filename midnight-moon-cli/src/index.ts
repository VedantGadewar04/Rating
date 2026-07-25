// Midnight Moon DApp CLI Driver
// Refactoring C:\Users\Vedant\OneDrive\Desktop\midnight moon\bboard-cli\src\index.ts

import { createInterface, type Interface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { WebSocket } from 'ws';
import {
  BBoardAPI,
  type BBoardPrivateState,
  type BBoardDerivedState,
  bboardPrivateStateKey,
  type BBoardProviders,
  type DeployedBBoardContract,
  type PrivateStateId,
} from '../../midnight-moon-api/src/index.js';
import { type WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { ledger, type Ledger } from '../../midnight-moon-contract/src/managed/midnightmoon/contract/index.js';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { type Logger } from 'pino';
import { type Config, StandaloneConfig } from './config.js';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { assertIsContractAddress, toHex } from '@midnight-ntwrk/midnight-js-utils';
import { TestEnvironment } from '@midnight-ntwrk/testkit-js';
import { MidnightWalletProvider } from './midnight-wallet-provider.js';
import { randomBytes } from '../../midnight-moon-api/src/utils/index.js';
import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { syncWallet, waitForUnshieldedFunds } from './wallet-utils.js';
import { generateDust } from './generate-dust.js';

// @ts-expect-error: It's needed to enable WebSocket usage through apollo
globalThis.WebSocket = WebSocket;

export const getBBoardLedgerState = async (
  providers: BBoardProviders,
  contractAddress: ContractAddress,
): Promise<Ledger | null> => {
  assertIsContractAddress(contractAddress);
  const contractState = await providers.publicDataProvider.queryContractState(contractAddress);
  return contractState != null ? ledger(contractState.data) : null;
};

const DEPLOY_OR_JOIN_QUESTION = `
You can do one of the following:
  1. Deploy a new Midnight Moon contract
  2. Join an existing Midnight Moon contract
  3. Exit
Which would you like to do? `;

const deployOrJoin = async (providers: BBoardProviders, rli: Interface, logger: Logger): Promise<BBoardAPI | null> => {
  let api: BBoardAPI | null = null;
  while (true) {
    const choice = await rli.question(DEPLOY_OR_JOIN_QUESTION);
    switch (choice) {
      case '1':
        api = await BBoardAPI.deploy(providers, logger);
        logger.info(`Deployed contract at address: ${api.deployedContractAddress}`);
        return api;
      case '2':
        api = await BBoardAPI.join(providers, await rli.question('What is the contract address (in hex)? '), logger);
        logger.info(`Joined contract at address: ${api.deployedContractAddress}`);
        return api;
      case '3':
        logger.info('Exiting...');
        return null;
      default:
        logger.error(`Invalid choice: ${choice}`);
    }
  }
};

const displayLedgerState = async (
  providers: BBoardProviders,
  deployedBBoardContract: DeployedBBoardContract,
  logger: Logger,
): Promise<void> => {
  const contractAddress = deployedBBoardContract.deployTxData.public.contractAddress;
  const ledgerState = await getBBoardLedgerState(providers, contractAddress);
  if (ledgerState === null) {
    logger.info(`There is no contract deployed at ${contractAddress}`);
  } else {
    logger.info(`--- Lunar Sectors Claims ---`);
    logger.info(`Total Claimed Sectors: ${ledgerState.claimed_sectors.size().toString()}`);
    // Print all claims in the map
    for (const [key, value] of ledgerState.claimed_sectors) {
      if (value) {
        const commVal = ledgerState.commitments.lookup(key);
        logger.info(`  Sector coordinate: ${toHex(key)} -> Claimed (Commitment: ${toHex(commVal)})`);
      }
    }
    logger.info(`----------------------------`);
  }
};

const displayPrivateState = async (providers: BBoardProviders, logger: Logger): Promise<void> => {
  const privateState = await providers.privateStateProvider.get(bboardPrivateStateKey);
  if (privateState === null) {
    logger.info(`There is no existing private state`);
  } else {
    logger.info(`Current private secret key is: ${toHex(privateState.secretKey)}`);
  }
};

const displayDerivedState = (ledgerState: BBoardDerivedState | undefined, logger: Logger) => {
  if (ledgerState === undefined) {
    logger.info(`No Midnight Moon state currently available`);
  } else {
    logger.info(`--- Derived Client State ---`);
    logger.info(`Claimed Sectors (local cache):`);
    for (const [key, value] of Object.entries(ledgerState.claimedSectors)) {
      if (value) {
        logger.info(`  Sector ID: ${key} (Commitment: ${ledgerState.commitments[key]})`);
      }
    }
    logger.info(`----------------------------`);
  }
};

const MAIN_LOOP_QUESTION = `
You can do one of the following:
  1. Claim a lunar sector
  2. Release a claimed sector
  3. Display current ledger state (public map)
  4. Display current private state (secret key)
  5. Display current derived state (known by client)
  6. Exit
Which would you like to do? `;

const mainLoop = async (providers: BBoardProviders, rli: Interface, logger: Logger): Promise<void> => {
  const bboardApi = await deployOrJoin(providers, rli, logger);
  if (bboardApi === null) {
    return;
  }
  let currentState: BBoardDerivedState | undefined;
  const stateObserver = {
    next: (state: BBoardDerivedState) => (currentState = state),
  };
  const subscription = bboardApi.state$.subscribe(stateObserver);
  try {
    while (true) {
      const choice = await rli.question(MAIN_LOOP_QUESTION);
      try {
        switch (choice) {
          case '1': {
            const sectorId = await rli.question(`What is the sector coordinate (in hex, 32 bytes)? `);
            const secret = await rli.question(`What is the sector owner secret key (in hex, 32 bytes)? `);
            await bboardApi.claimSector(sectorId, secret);
            break;
          }
          case '2': {
            const sectorId = await rli.question(`What is the sector coordinate to release (in hex, 32 bytes)? `);
            const secret = await rli.question(`Enter the sector owner secret key (in hex, 32 bytes) to authorize: `);
            await bboardApi.releaseSector(sectorId, secret);
            break;
          }
          case '3':
            await displayLedgerState(providers, bboardApi.deployedContract, logger);
            break;
          case '4':
            await displayPrivateState(providers, logger);
            break;
          case '5':
            displayDerivedState(currentState, logger);
            break;
          case '6':
            logger.info('Exiting...');
            return;
          default:
            logger.error(`Invalid choice: ${choice}`);
        }
      } catch (e) {
        logError(logger, e);
        logger.info('Returning to main menu...');
      }
    }
  } finally {
    subscription.unsubscribe();
  }
};

const GENESIS_MINT_WALLET_SEED = '0000000000000000000000000000000000000000000000000000000000000001';

const WALLET_LOOP_QUESTION = `
You can do one of the following:
  1. Build a fresh wallet
  2. Build wallet from a seed
  3. Exit
Which would you like to do? `;

const buildWallet = async (config: Config, rli: Interface, logger: Logger): Promise<string | undefined> => {
  if (config instanceof StandaloneConfig) {
    return GENESIS_MINT_WALLET_SEED;
  }
  while (true) {
    const choice = await rli.question(WALLET_LOOP_QUESTION);
    switch (choice) {
      case '1':
        return toHex(randomBytes(32));
      case '2':
        return await rli.question('Enter your wallet seed: ');
      case '3':
        logger.info('Exiting...');
        return undefined;
      default:
        logger.error(`Invalid choice: ${choice}`);
    }
  }
};

export const run = async (config: Config, testEnv: TestEnvironment, logger: Logger): Promise<void> => {
  const rli = createInterface({ input, output, terminal: true });
  const providersToBeStopped: MidnightWalletProvider[] = [];
  try {
    const envConfiguration = await testEnv.start();
    logger.info(`Environment started with configuration: ${JSON.stringify(envConfiguration)}`);
    const seed = await buildWallet(config, rli, logger);
    if (seed === undefined) {
      return;
    }
    const walletProvider = await MidnightWalletProvider.build(logger, envConfiguration, seed);
    providersToBeStopped.push(walletProvider);
    const walletFacade: WalletFacade = walletProvider.wallet;

    await walletProvider.start();

    const unshieldedState = await waitForUnshieldedFunds(logger, walletFacade, envConfiguration, unshieldedToken());
    const nightBalance = unshieldedState.balances[unshieldedToken().raw];
    if (nightBalance === undefined) {
      logger.info('No funds received, exiting...');
      return;
    }
    logger.info(`Your NIGHT wallet balance is: ${nightBalance}`);

    if (config.generateDust) {
      const dustGeneration = await generateDust(logger, seed, unshieldedState, walletFacade);
      if (dustGeneration) {
        logger.info(`Submitted dust generation registration transaction: ${dustGeneration}`);
        await syncWallet(logger, walletFacade);
      }
    }

    const zkConfigProvider = new NodeZkConfigProvider<'claim_sector' | 'release_sector'>(config.zkConfigPath);
    const providers: BBoardProviders = {
      privateStateProvider: levelPrivateStateProvider<PrivateStateId, BBoardPrivateState>({
        privateStateStoreName: config.privateStateStoreName,
        signingKeyStoreName: `${config.privateStateStoreName}-signing-keys`,
        privateStoragePasswordProvider: () => {
          return 'Bboard-Test-2026!';
        },
        accountId: seed,
      }),
      publicDataProvider: indexerPublicDataProvider(envConfiguration.indexer, envConfiguration.indexerWS),
      zkConfigProvider: zkConfigProvider,
      proofProvider: httpClientProofProvider(envConfiguration.proofServer, zkConfigProvider),
      walletProvider: walletProvider,
      midnightProvider: walletProvider,
    };
    await mainLoop(providers, rli, logger);
  } catch (e) {
    logError(logger, e);
    logger.info('Exiting...');
  } finally {
    try {
      rli.close();
      rli.removeAllListeners();
    } catch (e) {
      logError(logger, e);
    } finally {
      try {
        for (const wallet of providersToBeStopped) {
          logger.info('Stopping wallet...');
          await wallet.stop();
        }
        if (testEnv) {
          logger.info('Stopping test environment...');
          await testEnv.shutdown();
        }
      } catch (e) {
        logError(logger, e);
      }
    }
  }
};

function logError(logger: Logger, e: unknown) {
  if (e instanceof Error) {
    logger.error(`Found error '${e.message}'`);
    logger.debug(`${e.stack}`);
  } else {
    logger.error(`Found error (unknown type)`);
  }
}
