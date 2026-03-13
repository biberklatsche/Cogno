import {bootstrapApplication} from "@angular/platform-browser";
import {appConfig} from "./app.config";
import {AppComponent} from "./app.component";
import {Environment} from "./common/environment/environment";

Environment.init().then(async () => {
        bootstrapApplication(AppComponent, appConfig).catch((err) =>
            console.error(err),
        )
    }
);
