import { Injector, runInInjectionContext } from "@angular/core";
import { describe, expect, it } from "vitest";
import { CheckboxComponent } from "./checkbox.component";

describe("CheckboxComponent", () => {
  it("toggles the checked state", () => {
    const component = runInInjectionContext(Injector.create({ providers: [] }), () => {
      return new CheckboxComponent();
    });

    expect(component.checked()).toBe(false);

    component.toggle();
    expect(component.checked()).toBe(true);

    component.toggle();
    expect(component.checked()).toBe(false);
  });
});
