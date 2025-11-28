import { bootstrapApplication } from "@angular/platform-browser";
import { appConfig } from "./app/app.config";
import { AppComponent } from "./app/app.component";
import {Environment} from "./app/common/environment/environment";
import {DB} from "./app/_tauri/db";

Environment.init().then(async () => {
        await DB.create(`sqlite:${Environment.dbFilePath()}`);
        bootstrapApplication(AppComponent, appConfig).catch((err) =>
            console.error(err),
        )
}
);


