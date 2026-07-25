import * as MidnightMoon from '../../midnight-moon-contract/src/managed/midnightmoon/contract/index.js';

import { type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { type Logger } from 'pino';
import {
  type MidnightMoonDerivedState,
  type MidnightMoonContract,
  type MidnightMoonProviders,
  type DeployedMidnightMoonContract,
  midnightMoonPrivateStateKey,
} from './common-types.js';
import { CompiledMidnightMoonContractContract } from '../../midnight-moon-contract/src/index.js';
import * as utils from './utils/index.js';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { combineLatest, map, tap, from, type Observable } from 'rxjs';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { MidnightMoonPrivateState, createMidnightMoonPrivateState } from '../../midnight-moon-contract/src/witnesses.js';

// Helper to convert hex string to Uint8Array safely
const fromHex = (hex: string): Uint8Array => {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
};

export interface DeployedMidnightMoonAPI {
  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<MidnightMoonDerivedState>;

  claimSector: (sectorIdHex: string, secretHex: string) => Promise<void>;
  releaseSector: (sectorIdHex: string, secretHex: string) => Promise<void>;
}

export class MidnightMoonAPI implements DeployedMidnightMoonAPI {
  private constructor(
    public readonly deployedContract: DeployedMidnightMoonContract,
    providers: MidnightMoonProviders,
    private readonly logger?: Logger,
  ) {
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress;
    providers.privateStateProvider.setContractAddress(this.deployedContractAddress);
    
    this.state$ = combineLatest([
      providers.publicDataProvider.contractStateObservable(this.deployedContractAddress, { type: 'latest' }).pipe(
        map((contractState) => MidnightMoon.ledger(contractState.data)),
        tap((ledgerState) =>
          logger?.trace({
            ledgerStateChanged: {
              ledgerState: {
                claimed_sectors_size: ledgerState.claimed_sectors.size().toString(),
                commitments_size: ledgerState.commitments.size().toString(),
              },
            },
          }),
        ),
      ),
      from(providers.privateStateProvider.get(midnightMoonPrivateStateKey) as Promise<MidnightMoonPrivateState>),
    ]).pipe(
      map(([ledgerState]) => {
        const claimedSectors: Record<string, boolean> = {};
        const commitments: Record<string, string> = {};

        // Iterate over ledger maps and build pure JS objects
        for (const [key, value] of ledgerState.claimed_sectors) {
          claimedSectors[toHex(key)] = value;
        }

        for (const [key, value] of ledgerState.commitments) {
          commitments[toHex(key)] = toHex(value);
        }

        return {
          claimedSectors,
          commitments,
        };
      })
    );
  }

  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<MidnightMoonDerivedState>;

  async claimSector(sectorIdHex: string, secretHex: string): Promise<void> {
    this.logger?.info(`claiming sector: ${sectorIdHex}`);
    
    const sectorIdBytes = fromHex(sectorIdHex);
    const secretBytes = fromHex(secretHex);

    const txData = await this.deployedContract.callTx.claim_sector(sectorIdBytes, secretBytes);

    this.logger?.trace({
      transactionAdded: {
        circuit: 'claim_sector',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });
  }

  async releaseSector(sectorIdHex: string, secretHex: string): Promise<void> {
    this.logger?.info(`releasing sector: ${sectorIdHex}`);
    
    const sectorIdBytes = fromHex(sectorIdHex);
    const secretBytes = fromHex(secretHex);

    const txData = await this.deployedContract.callTx.release_sector(sectorIdBytes, secretBytes);

    this.logger?.trace({
      transactionAdded: {
        circuit: 'release_sector',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });
  }

  static async deploy(providers: MidnightMoonProviders, logger?: Logger): Promise<MidnightMoonAPI> {
    logger?.info('deployContract');

    const deployedContract = await deployContract(providers, {
      compiledContract: CompiledMidnightMoonContractContract,
      privateStateId: midnightMoonPrivateStateKey,
      initialPrivateState: createMidnightMoonPrivateState(utils.randomBytes(32)),
    });

    logger?.trace({
      contractDeployed: {
        finalizedDeployTxData: deployedContract.deployTxData.public,
      },
    });

    return new MidnightMoonAPI(deployedContract, providers, logger);
  }

  static async join(providers: MidnightMoonProviders, contractAddress: ContractAddress, logger?: Logger): Promise<MidnightMoonAPI> {
    logger?.info({
      joinContract: {
        contractAddress,
      },
    });

    const deployedContract = await findDeployedContract<MidnightMoonContract>(providers, {
      contractAddress,
      compiledContract: CompiledMidnightMoonContractContract,
      privateStateId: midnightMoonPrivateStateKey,
      initialPrivateState: await MidnightMoonAPI.getPrivateState(providers, contractAddress),
    });

    logger?.trace({
      contractJoined: {
        finalizedDeployTxData: deployedContract.deployTxData.public,
      },
    });

    return new MidnightMoonAPI(deployedContract, providers, logger);
  }

  private static async getPrivateState(
    providers: MidnightMoonProviders,
    contractAddress: ContractAddress,
  ): Promise<MidnightMoonPrivateState> {
    providers.privateStateProvider.setContractAddress(contractAddress);
    const existingPrivateState = await providers.privateStateProvider.get(midnightMoonPrivateStateKey);
    return existingPrivateState ?? createMidnightMoonPrivateState(utils.randomBytes(32));
  }
}

// Compatibility exports so that old CLI / UI imports don't fail immediately
export { MidnightMoonAPI as BBoardAPI };
export type { DeployedMidnightMoonAPI as DeployedBBoardAPI };
export * as utils from './utils/index.js';
export * from './common-types.js';
