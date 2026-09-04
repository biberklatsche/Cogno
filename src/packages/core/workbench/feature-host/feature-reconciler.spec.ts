import type { ActionName } from "@cogno/core/workbench/bus/action.models";
import type { FeatureDefinition } from "@cogno/shared/contributions";
import type { FeatureModeContract } from "@cogno/shared/domain";
import { describe, expect, it, vi } from "vitest";
import { FeatureContributionRegistrar, FeatureReconciler } from "./feature-reconciler";

type FakeFeature = Partial<FeatureDefinition<ActionName>> & { id: string };

function deferred<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function harness(fakes: ReadonlyArray<FakeFeature>) {
  const features = fakes.map(
    (fake): FeatureDefinition<ActionName> => ({ mode: "on", target: "workbench", ...fake }),
  );
  const desired = new Map<string, FeatureModeContract>(
    features.map((feature) => [feature.id, feature.mode]),
  );
  const calls: string[] = [];
  const registrar: FeatureContributionRegistrar = {
    register: (feature) => calls.push(`register:${feature.id}`),
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
  it("registers then activates a feature", async () => {
    const activate = vi.fn();
    const { reconciler, calls } = harness([{ id: "a", activate }]);

    await reconciler.reconcile();

    expect(calls).toEqual(["register:a"]);
    expect(activate).toHaveBeenCalledTimes(1);
    expect(reconciler.stateOf("a").status).toBe("active");
  });

  it("rolls back the contributions and fails when activate throws (rule 2)", async () => {
    const { reconciler, calls } = harness([
      {
        id: "a",
        activate: () => {
          throw new Error("boom");
        },
      },
    ]);

    await reconciler.reconcile();

    expect(calls).toEqual(["register:a", "unregister:a"]);
    expect(reconciler.stateOf("a").status).toBe("failed");
    expect(reconciler.stateOf("a").reason).toBe("boom");
  });

  it("finishes activation before honouring an off requested mid-activation (rule 1)", async () => {
    const gate = deferred();
    const { reconciler, desired, calls } = harness([{ id: "a", activate: () => gate.promise }]);

    const reconciled = reconciler.reconcile();
    // The activation is now in flight; the user turns the feature off.
    desired.set("a", "off");
    gate.resolve();
    await reconciled;

    expect(calls).toEqual(["register:a", "unregister:a"]);
    expect(reconciler.stateOf("a").status).toBe("inactive");
  });

  it("ends inactive even when deactivate throws (rule 3)", async () => {
    const { reconciler, desired, calls } = harness([
      {
        id: "a",
        deactivate: () => {
          throw new Error("cleanup failed");
        },
      },
    ]);

    await reconciler.reconcile();
    desired.set("a", "off");
    await reconciler.reconcile();

    expect(calls).toEqual(["register:a", "unregister:a"]);
    expect(reconciler.stateOf("a").status).toBe("inactive");
  });

  it("keeps a dependent inactive with a reason when its requirement is off (rule 4)", async () => {
    const { reconciler } = harness([
      { id: "a", mode: "off" },
      { id: "b", requires: ["a"] },
    ]);

    await reconciler.reconcile();

    expect(reconciler.stateOf("a").status).toBe("inactive");
    expect(reconciler.stateOf("b").status).toBe("inactive");
    expect(reconciler.stateOf("b").reason).toBe("needs a");
  });

  it("activates in dependency order and deactivates dependents first (rule 4)", async () => {
    const { reconciler, desired, calls } = harness([{ id: "a" }, { id: "b", requires: ["a"] }]);

    await reconciler.reconcile();
    expect(calls).toEqual(["register:a", "register:b"]);
    expect(reconciler.stateOf("b").status).toBe("active");

    calls.length = 0;
    desired.set("a", "off");
    await reconciler.reconcile();

    expect(calls).toEqual(["unregister:b", "unregister:a"]);
    expect(reconciler.stateOf("a").status).toBe("inactive");
    expect(reconciler.stateOf("b").status).toBe("inactive");
  });

  it("leaves failed only on retry (rule 6)", async () => {
    let attempts = 0;
    const { reconciler } = harness([
      {
        id: "a",
        activate: () => {
          attempts += 1;
          if (attempts === 1) {
            throw new Error("first attempt fails");
          }
        },
      },
    ]);

    await reconciler.reconcile();
    expect(reconciler.stateOf("a").status).toBe("failed");

    // A plain reconcile does not retry a failed feature.
    await reconciler.reconcile();
    expect(reconciler.stateOf("a").status).toBe("failed");

    await reconciler.retry("a");
    expect(reconciler.stateOf("a").status).toBe("active");
  });
});
