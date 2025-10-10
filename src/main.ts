import { bootstrapApplication } from "@angular/platform-browser";
import { appConfig } from "./app/app.config";
import { AppComponent } from "./app/app.component";
import {Environment} from "./app/common/environment/environment";

Environment.init().then(() =>
    bootstrapApplication(AppComponent, appConfig).catch((err) =>
        console.error(err),
    )
);


