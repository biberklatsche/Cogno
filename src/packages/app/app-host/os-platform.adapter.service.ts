import { Injectable } from "@angular/core";
import { OS } from "@cogno/app-tauri/os";
import { BackendOsContract, OsPlatformPort } from "@cogno/core-api";

@Injectable({ providedIn: "root" })
export class OsPlatformAdapterService extends OsPlatformPort {
  platform(): BackendOsContract {
    return OS.platform();
  }
}
