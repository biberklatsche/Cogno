import { BackendOsContract } from "./filesystem.contract";

export abstract class OsPlatformPort {
  abstract platform(): BackendOsContract;
}
