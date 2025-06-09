import { bootstrapApplication } from "@angular/platform-browser";
import { appConfig } from "./app/app.config";
import { AppComponent } from "./app/app.component";
import {Environment} from "./app/environment/environment";

Environment.init().catch((err:Error) => console.log(err)).finally(() => {
    bootstrapApplication(AppComponent, appConfig).catch((err) =>
        console.error(err),
    );
});

