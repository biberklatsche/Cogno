import { bootstrapApplication } from "@angular/platform-browser";
import { AppComponent } from "@cogno/app-shell/app.component";
import { Environment } from "@cogno/app-shell/common/environment/environment";
import { appConfig } from "./app.config";

Environment.init().then(async () => {
  bootstrapApplication(AppComponent, appConfig).catch((error: unknown) => console.error(error));
});
