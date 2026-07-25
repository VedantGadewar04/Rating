import { type MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import { type FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { Contract, Witnesses, MidnightMoonPrivateState } from '../../midnight-moon-contract/src/index';

export const midnightMoonPrivateStateKey = 'midnightMoonPrivateState';
export type PrivateStateId = typeof midnightMoonPrivateStateKey;

export type PrivateStates = {
  readonly midnightMoonPrivateState: MidnightMoonPrivateState;
};

export type MidnightMoonContract = Contract<MidnightMoonPrivateState, Witnesses<MidnightMoonPrivateState>>;

export type MidnightMoonCircuitKeys = Exclude<keyof MidnightMoonContract['impureCircuits'], number | symbol>;

export type MidnightMoonProviders = MidnightProviders<MidnightMoonCircuitKeys, PrivateStateId, MidnightMoonPrivateState>;

export type DeployedMidnightMoonContract = FoundContract<MidnightMoonContract>;

export type MidnightMoonDerivedState = {
  readonly claimedSectors: Record<string, boolean>;
  readonly commitments: Record<string, string>;
};

// Aliases for compatibility with scaffold modules:
export { midnightMoonPrivateStateKey as bboardPrivateStateKey };
export type { MidnightMoonPrivateState as BBoardPrivateState };
export type { MidnightMoonContract as BBoardContract };
export type { MidnightMoonProviders as BBoardProviders };
export type { DeployedMidnightMoonContract as DeployedBBoardContract };
export type { MidnightMoonDerivedState as BBoardDerivedState };
export type BBoardCircuitKeys = MidnightMoonCircuitKeys;
