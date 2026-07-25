import { Ledger } from "./managed/midnightmoon/contract/index.js";
import { WitnessContext } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";

export type MidnightMoonPrivateState = {
  readonly secretKey: Uint8Array;
};

export const createMidnightMoonPrivateState = (secretKey: Uint8Array) => ({
  secretKey,
});

export const witnesses = {
  localSecretKey: ({
    privateState,
  }: WitnessContext<Ledger, MidnightMoonPrivateState>): [
    MidnightMoonPrivateState,
    Uint8Array,
  ] => [privateState, privateState.secretKey],
};
