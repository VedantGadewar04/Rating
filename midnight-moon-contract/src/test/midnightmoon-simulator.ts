import {
  type CircuitContext,
  QueryContext,
  sampleContractAddress,
  createConstructorContext,
  CostModel,
} from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  type Ledger,
  ledger,
} from "../managed/midnightmoon/contract/index.js";
import { type MidnightMoonPrivateState, witnesses } from "../witnesses.js";

/**
 * Serves as a testbed to exercise the contract in tests
 */
export class MidnightMoonSimulator {
  readonly contract: Contract<MidnightMoonPrivateState>;
  circuitContext: CircuitContext<MidnightMoonPrivateState>;

  constructor(secretKey: Uint8Array) {
    this.contract = new Contract<MidnightMoonPrivateState>(witnesses as any);
    const {
      currentPrivateState,
      currentContractState,
      currentZswapLocalState,
    } = this.contract.initialState(
      createConstructorContext({ secretKey }, "0".repeat(64)),
    );
    this.circuitContext = {
      currentPrivateState,
      currentZswapLocalState,
      costModel: CostModel.initialCostModel(),
      currentQueryContext: new QueryContext(
        currentContractState.data,
        sampleContractAddress(),
      ),
    };
  }

  public switchUser(secretKey: Uint8Array) {
    this.circuitContext.currentPrivateState = {
      secretKey,
    };
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public getPrivateState(): MidnightMoonPrivateState {
    return this.circuitContext.currentPrivateState;
  }

  public claimSector(sectorId: Uint8Array, secret: Uint8Array): Ledger {
    this.circuitContext = this.contract.impureCircuits.claim_sector(
      this.circuitContext,
      sectorId,
      secret,
    ).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public releaseSector(sectorId: Uint8Array, secret: Uint8Array): Ledger {
    this.circuitContext = this.contract.impureCircuits.release_sector(
      this.circuitContext,
      sectorId,
      secret,
    ).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }
}
