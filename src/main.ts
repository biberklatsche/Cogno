import {bootstrapApplication} from "@angular/platform-browser";
import {appConfig} from "./app/app.config";
import {AppComponent} from "./app/app.component";
import {Environment} from "./app/common/environment/environment";
import {DB} from "./app/_tauri/db";
import {migrate} from "./app/migrations/migrate";

Environment.init().then(async () => {
        bootstrapApplication(AppComponent, appConfig).catch((err) =>
            console.error(err),
        )
    }
);


