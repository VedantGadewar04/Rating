import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";

export * from "./managed/midnightmoon/contract/index.js";
export * from "./witnesses.js";

import * as CompiledMidnightMoonContract from "./managed/midnightmoon/contract/index.js";
import * as Witnesses from "./witnesses.js";

export const CompiledMidnightMoonContractContract = CompiledContract.make<
  CompiledMidnightMoonContract.Contract<Witnesses.MidnightMoonPrivateState>
>("MidnightMoon", CompiledMidnightMoonContract.Contract<Witnesses.MidnightMoonPrivateState>).pipe(
  CompiledContract.withWitnesses(Witnesses.witnesses as never),
  CompiledContract.withCompiledFileAssets("./managed/midnightmoon"),
);
export { CompiledMidnightMoonContractContract as CompiledBBoardContractContract };
export type { MidnightMoonPrivateState as BBoardPrivateState } from "./witnesses.js";
export { createMidnightMoonPrivateState as createBBoardPrivateState } from "./witnesses.js";
