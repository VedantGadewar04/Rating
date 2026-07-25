import { MidnightMoonSimulator } from "./midnightmoon-simulator.js";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, it, expect } from "vitest";
import { randomBytes } from "./utils.js";

setNetworkId("undeployed");

describe("Midnight Moon smart contract", () => {
  it("properly initializes ledger state and private state", () => {
    const key = randomBytes(32);
    const simulator = new MidnightMoonSimulator(key);
    const initialLedger = simulator.getLedger();
    expect(initialLedger.claimed_sectors.isEmpty()).toBe(true);
    expect(initialLedger.commitments.isEmpty()).toBe(true);
    expect(simulator.getPrivateState()).toEqual({ secretKey: key });
  });

  it("lets you claim a sector", () => {
    const key = randomBytes(32);
    const simulator = new MidnightMoonSimulator(key);
    const sectorId = randomBytes(32);
    
    simulator.claimSector(sectorId, key);
    
    const ledgerState = simulator.getLedger();
    expect(ledgerState.claimed_sectors.lookup(sectorId)).toBe(true);
    expect(ledgerState.commitments.lookup(sectorId)).toBeDefined();
  });

  it("lets you release a sector", () => {
    const key = randomBytes(32);
    const simulator = new MidnightMoonSimulator(key);
    const sectorId = randomBytes(32);
    
    simulator.claimSector(sectorId, key);
    expect(simulator.getLedger().claimed_sectors.lookup(sectorId)).toBe(true);
    
    simulator.releaseSector(sectorId, key);
    expect(simulator.getLedger().claimed_sectors.lookup(sectorId)).toBe(false);
  });
});
