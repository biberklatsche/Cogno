import {bootstrapApplication} from "@angular/platform-browser";
import {appConfig} from "./src/app.config";
import {AppComponent} from "./src/app.component";
import {Environment} from "./src/common/environment/environment";
import {DB} from "./src/_tauri/db";
import {migrate} from "./src/migrations/migrate";

Environment.init().then(async () => {
        bootstrapApplication(AppComponent, appConfig).catch((err) =>
            console.error(err),
        )
    }
);

