import { Injector, runInInjectionContext } from "@angular/core";
import { BehaviorSubject, firstValueFrom } from "rxjs";
import { describe, expect, it, vi } from "vitest";
import type { Config } from "../../config/+models/config";
import type { ConfigService } from "../../config/+state/config.service";
import { ColorSelectComponent } from "./color-select.component";

describe("ColorSelectComponent", () => {
  it("maps configured colors to selectable color items", async () => {
    const configSubject = new BehaviorSubject<Config>({
      color: {
        red: "ff0000",
        green: "00ff00",
        yellow: "ffff00",
        blue: "0000ff",
        magenta: "ff00ff",
        cyan: "00ffff",
        black: "000000",
        white: "ffffff",
        grey: "999999",
      },
    });

    const component = runInInjectionContext(Injector.create({ providers: [] }), () => {
      return new ColorSelectComponent({
        config$: configSubject.asObservable(),
      } as ConfigService);
    });

    await expect(firstValueFrom(component.colors$)).resolves.toEqual([
      { name: "red", value: "#ff0000" },
      { name: "green", value: "#00ff00" },
      { name: "yellow", value: "#ffff00" },
      { name: "blue", value: "#0000ff" },
      { name: "magenta", value: "#ff00ff" },
      { name: "cyan", value: "#00ffff" },
    ]);
  });

  it("emits undefined for the default option and the selected color name otherwise", () => {
    const component = runInInjectionContext(Injector.create({ providers: [] }), () => {
      return new ColorSelectComponent({
        config$: new BehaviorSubject<Config>({}).asObservable(),
      } as ConfigService);
    });
    const emitSpy = vi.spyOn(component.colorSelected, "emit");

    component.onPick("default");
    component.onPick("blue");

    expect(emitSpy).toHaveBeenNthCalledWith(1, undefined);
    expect(emitSpy).toHaveBeenNthCalledWith(2, "blue");
  });
});
