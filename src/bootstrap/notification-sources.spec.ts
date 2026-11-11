import { CORE_NOTIFICATION_SOURCES } from "@cogno/core/workbench/notification/+state/core-notification-sources";
import { describe, expect, it } from "vitest";
import { ALL_NOTIFICATION_SOURCES } from "../../scripts/notification-sources";
import { features } from "./features";

describe("notification sources of the generators", () => {
  it("are the sources the app composes at runtime: core's and every feature's", () => {
    const runtime = [
      ...CORE_NOTIFICATION_SOURCES,
      ...features.flatMap((feature) =>
        "notificationSources" in feature ? (feature.notificationSources ?? []) : [],
      ),
    ];

    // The generators write the default config and the reference from their list;
    // a feature's new source missing there would have no defaults and no docs.
    expect(ALL_NOTIFICATION_SOURCES.map((source) => source.id).sort()).toEqual(
      runtime.map((source) => source.id).sort(),
    );
    for (const source of ALL_NOTIFICATION_SOURCES) {
      expect(runtime).toContain(source);
    }
  });
});
