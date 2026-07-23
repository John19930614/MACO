// Lives in test/ (not src/) because vitest.config.ts only includes test/**.
import { describe, test, expect } from "vitest";
import { rollupStorageArea, rollupBuilding } from "@/lib/nfpa704/rollup";
import { deriveRatingFromHCodes } from "@/lib/nfpa704/deriveRating";
import type { ContainerNfpa } from "@/lib/nfpa704/types";

function container(overrides: Partial<ContainerNfpa>): ContainerNfpa {
  return {
    containerId: "c1",
    chemicalName: "Test Chem",
    storageAreaId: "area-1",
    rating: {
      health: 1,
      flammability: 1,
      instability: 1,
      specialHazards: [],
      isComplete: true,
    },
    source: "sds",
    ...overrides,
  };
}

describe("rollupStorageArea", () => {
  test("takes max per category, not overall max container", () => {
    const containers: ContainerNfpa[] = [
      container({
        containerId: "a",
        rating: { health: 4, flammability: 0, instability: 0, specialHazards: [], isComplete: true },
      }),
      container({
        containerId: "b",
        rating: { health: 0, flammability: 3, instability: 1, specialHazards: [], isComplete: true },
      }),
    ];
    const result = rollupStorageArea("area-1", "Room 101", "bldg-1", containers);
    expect(result.rating.health).toBe(4);
    expect(result.rating.flammability).toBe(3);
    expect(result.rating.instability).toBe(1);
  });

  test("a single small unrelated container does not force the whole area to the max in every category", () => {
    const containers: ContainerNfpa[] = [
      container({ containerId: "small", rating: { health: 4, flammability: 0, instability: 0, specialHazards: [], isComplete: true } }),
      container({ containerId: "other", rating: { health: 1, flammability: 1, instability: 1, specialHazards: [], isComplete: true } }),
    ];
    const result = rollupStorageArea("area-1", "Room 101", "bldg-1", containers);
    expect(result.rating.flammability).toBe(1);
    expect(result.rating.instability).toBe(1);
  });

  test("missing ratings are flagged, not treated as zero", () => {
    const containers: ContainerNfpa[] = [
      container({
        containerId: "unrated",
        source: "unrated",
        rating: { health: null, flammability: null, instability: null, specialHazards: [], isComplete: false },
      }),
    ];
    const result = rollupStorageArea("area-1", "Room 101", "bldg-1", containers);
    expect(result.rating.health).toBeNull();
    expect(result.rating.isComplete).toBe(false);
    expect(result.unratedContainerCount).toBe(1);
  });

  test("a rated container's max is unaffected by a co-located unrated one", () => {
    const containers: ContainerNfpa[] = [
      container({ containerId: "rated", rating: { health: 2, flammability: 3, instability: 1, specialHazards: [], isComplete: true } }),
      container({
        containerId: "unrated",
        source: "unrated",
        rating: { health: null, flammability: null, instability: null, specialHazards: [], isComplete: false },
      }),
    ];
    const result = rollupStorageArea("area-1", "Room 101", "bldg-1", containers);
    expect(result.rating.flammability).toBe(3);
    expect(result.rating.isComplete).toBe(true); // all three categories have a value
    expect(result.unratedContainerCount).toBe(1); // but the unrated one is still counted
  });

  test("special hazards are unioned across containers without duplicates", () => {
    const containers: ContainerNfpa[] = [
      container({ containerId: "a", rating: { health: 1, flammability: 1, instability: 1, specialHazards: ["OX"], isComplete: true } }),
      container({ containerId: "b", rating: { health: 1, flammability: 1, instability: 1, specialHazards: ["W", "OX"], isComplete: true } }),
    ];
    const result = rollupStorageArea("area-1", "Room 101", "bldg-1", containers);
    expect(result.rating.specialHazards.sort()).toEqual(["OX", "W"].sort());
  });

  test("traceability: worstContainerIds points at the driver of each category", () => {
    const containers: ContainerNfpa[] = [
      container({ containerId: "a", rating: { health: 4, flammability: 0, instability: 0, specialHazards: [], isComplete: true } }),
      container({ containerId: "b", rating: { health: 0, flammability: 3, instability: 1, specialHazards: [], isComplete: true } }),
    ];
    const result = rollupStorageArea("area-1", "Room 101", "bldg-1", containers);
    expect(result.worstContainerIds.health).toBe("a");
    expect(result.worstContainerIds.flammability).toBe("b");
  });
});

describe("rollupBuilding", () => {
  test("rolls up storage areas the same way containers roll up to areas", () => {
    const areas = [
      rollupStorageArea("area-1", "Room 101", "bldg-1", [
        container({ containerId: "a", storageAreaId: "area-1", rating: { health: 4, flammability: 0, instability: 0, specialHazards: [], isComplete: true } }),
      ]),
      rollupStorageArea("area-2", "Room 102", "bldg-1", [
        container({ containerId: "b", storageAreaId: "area-2", rating: { health: 0, flammability: 2, instability: 0, specialHazards: [], isComplete: true } }),
      ]),
    ];
    const building = rollupBuilding("bldg-1", "Main Hall", areas);
    expect(building.rating.health).toBe(4);
    expect(building.rating.flammability).toBe(2);
  });

  test("building sums unrated containers across its areas", () => {
    const areas = [
      rollupStorageArea("area-1", "Room 101", "bldg-1", [
        container({ containerId: "u1", storageAreaId: "area-1", source: "unrated", rating: { health: null, flammability: null, instability: null, specialHazards: [], isComplete: false } }),
      ]),
      rollupStorageArea("area-2", "Room 102", "bldg-1", [
        container({ containerId: "u2", storageAreaId: "area-2", source: "unrated", rating: { health: null, flammability: null, instability: null, specialHazards: [], isComplete: false } }),
        container({ containerId: "ok", storageAreaId: "area-2", rating: { health: 1, flammability: 1, instability: 1, specialHazards: [], isComplete: true } }),
      ]),
    ];
    const building = rollupBuilding("bldg-1", "Main Hall", areas);
    expect(building.unratedContainerCount).toBe(2);
  });
});

describe("deriveRatingFromHCodes", () => {
  test("no hazard data → all-null, never zero", () => {
    const r = deriveRatingFromHCodes([]);
    expect(r.health).toBeNull();
    expect(r.flammability).toBeNull();
    expect(r.instability).toBeNull();
    expect(r.isComplete).toBe(false);
  });

  test("H-codes present but none in a category → legitimate 0 for that category", () => {
    // H225 = highly flammable liquid (flammability 3), no health/instability codes.
    const r = deriveRatingFromHCodes(["H225"]);
    expect(r.flammability).toBe(3);
    expect(r.health).toBe(0);
    expect(r.instability).toBe(0);
    expect(r.isComplete).toBe(true);
  });

  test("oxidizer, water-reactive and corrosive special hazards are detected", () => {
    expect(deriveRatingFromHCodes(["H271"]).specialHazards).toContain("OX");
    expect(deriveRatingFromHCodes(["H260"]).specialHazards).toContain("W");
    expect(deriveRatingFromHCodes(["H314"]).specialHazards).toContain("COR");
  });
});
