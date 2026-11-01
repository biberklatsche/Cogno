import { bootstrapApplication } from "@angular/platform-browser";
import { Environment } from "@cogno/core/infrastructure/environment/environment";
import { AppComponent } from "@cogno/core/workbench/shell/app.component";
import { Paths } from "@cogno/platform/path";
import { appConfig } from "./app.config";

// The application's paths must be known before anything reads them, so they
// are determined here and handed to the injector as ready-made instances.
const paths = new Paths();
const environment = new Environment(paths);

environment
  .init()
  .then(() =>
    bootstrapApplication(AppComponent, {
      ...appConfig,
      providers: [
        ...appConfig.providers,
        { provide: Paths, useValue: paths },
        { provide: Environment, useValue: environment },
      ],
    }),
  )
  .catch((error: unknown) => {
    // Nothing of the app exists yet to show this in; a blank window would be
    // all the user sees. Put the reason where they look instead.
    console.error(error);
    showStartupFailure(error);
  });

function showStartupFailure(error: unknown): void {
  const reason = error instanceof Error ? error.message : String(error);
  const container = document.createElement("div");
  container.className = "startup-failure";
  const title = document.createElement("h1");
  title.textContent = "Cogno could not start";
  const detail = document.createElement("pre");
  detail.textContent = reason;
  const hint = document.createElement("p");
  hint.textContent = "The log file in the Cogno directory has the details.";
  container.append(title, detail, hint);
  document.body.replaceChildren(container);
}
