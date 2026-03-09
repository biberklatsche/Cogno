import {bootstrapApplication} from "@angular/platform-browser";
import {appConfig} from "./src/app.config";
import {AppComponent} from "./src/app.component";
import {Environment} from "./src/common/environment/environment";

Environment.init().then(async () => {
        bootstrapApplication(AppComponent, appConfig).catch((err) =>
            console.error(err),
        )
    }
);
