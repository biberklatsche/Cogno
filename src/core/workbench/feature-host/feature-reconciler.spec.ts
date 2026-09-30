import type { FeatureDefinition } from "@cogno/core/api/contributions";
import type { ActionName } from "@cogno/core/workbench/bus/action.models";
import type { FeatureModeContract } from "@cogno/shared/domain";
import { describe, expect, it, vi } from "vitest";
import { FeatureContributionRegistrar, FeatureReconciler } from "./feature-reconciler";

type FakeFeature = Partial<FeatureDefinition<ActionName>> & { id: string };

/** `failRegister` makes registering that feature throw, as a lifecycle might. */
function harness(
  fakes: ReadonlyArray<FakeFeature>,
  failRegister: (id: string) => boolean = () => false,
) {
  const features = fakes.map(
    (fake): FeatureDefinition<ActionName> => ({ mode: "on", target: "workbench", ...fake }),
  );
  const desired = new Map<string, FeatureModeContract>(
    features.map((feature) => [feature.id, feature.mode]),
  );
  const calls: string[] = [];
  const registrar: FeatureContributionRegistrar = {
    register: (feature) => {
      calls.push(`register:${feature.id}`);
      if (failRegister(feature.id)) throw new Error("boom");
    },
    unregister: (feature) => calls.push(`unregister:${feature.id}`),
  };
  const reconciler = new FeatureReconciler(
    features,
    registrar,
    (feature) => desired.get(feature.id) ?? "off",
  );
  return { reconciler, desired, calls };
}

describe("FeatureReconciler", () => {
  it("registers a feature's contributions", () => {
    const { reconciler, calls } = harness([{ id: "a" }]);

    reconciler.reconcile();

    expect(calls).toEqual(["register:a"]);
    expect(reconciler.statusOf("a")).toBe("active");
  });

  it("rolls back the contributions and fails when registering throws (rule 1)", () => {
    const { reconciler, calls } = harness([{ id: "a" }], (id) => id === "a");

    reconciler.reconcile();

    expect(calls).toEqual(["register:a", "unregister:a"]);
    expect(reconciler.statusOf("a")).toBe("failed");
  });

  it("unregisters a feature switched off and ends inactive (rule 2)", () => {
    const { reconciler, desired, calls } = harness([{ id: "a" }]);

    reconciler.reconcile();
    desired.set("a", "off");
    reconciler.reconcile();

    expect(calls).toEqual(["register:a", "unregister:a"]);
    expect(reconciler.statusOf("a")).toBe("inactive");
  });

  it("ends inactive and reports it when the feature's code throws on the way out (rule 2)", () => {
    let desiredMode: FeatureModeContract = "on";
    const reportError = vi.fn();
    const reconciler = new FeatureReconciler(
      [{ id: "a", mode: "on", target: "workbench" }],
      {
        register: () => {},
        unregister: () => {
          throw new Error("cleanup failed");
        },
      },
      () => desiredMode,
      reportError,
    );

    reconciler.reconcile();
    desiredMode = "off";
    reconciler.reconcile();

    expect(reconciler.statusOf("a")).toBe("inactive");
    expect(reportError).toHaveBeenCalledWith("a", expect.any(Error));
  });

  it("keeps a dependent inactive when its requirement is off (rule 3)", () => {
    const { reconciler } = harness([
      { id: "a", mode: "off" },
      { id: "b", requires: ["a"] },
    ]);

    reconciler.reconcile();

    expect(reconciler.statusOf("a")).toBe("inactive");
    expect(reconciler.statusOf("b")).toBe("inactive");
  });

  it("activates in dependency order and deactivates dependents first (rule 3)", () => {
    const { reconciler, desired, calls } = harness([{ id: "a" }, { id: "b", requires: ["a"] }]);

    reconciler.reconcile();
    expect(calls).toEqual(["register:a", "register:b"]);
    expect(reconciler.statusOf("b")).toBe("active");

    calls.length = 0;
    desired.set("a", "off");
    reconciler.reconcile();

    expect(calls).toEqual(["unregister:b", "unregister:a"]);
    expect(reconciler.statusOf("a")).toBe("inactive");
    expect(reconciler.statusOf("b")).toBe("inactive");
  });

  it("stays failed: a later reconcile does not retry it", () => {
    let attempts = 0;
    const { reconciler } = harness([{ id: "a" }], () => {
      attempts += 1;
      return attempts === 1;
    });

    reconciler.reconcile();
    expect(reconciler.statusOf("a")).toBe("failed");

    reconciler.reconcile();
    expect(reconciler.statusOf("a")).toBe("failed");
    expect(attempts).toBe(1);
  });
});
