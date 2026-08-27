import { bootstrapApplication } from "@angular/platform-browser";
import { AppComponent } from "@cogno/app/app.component";
import { Environment } from "@cogno/core/infrastructure/environment/environment";
import { Paths } from "@cogno/platform/path";
import { appConfig } from "./app.config";

// The application's paths must be known before anything reads them, so they
// are determined here and handed to the injector as ready-made instances.
const paths = new Paths();
const environment = new Environment(paths);

environment.init().then(() => {
  bootstrapApplication(AppComponent, {
    ...appConfig,
    providers: [
      ...appConfig.providers,
      { provide: Paths, useValue: paths },
      { provide: Environment, useValue: environment },
    ],
  }).catch((error: unknown) => console.error(error));
});
