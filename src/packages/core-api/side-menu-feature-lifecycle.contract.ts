import { FeatureModeContract } from "./feature-mode.contract";

export interface SideMenuFeatureLifecycleContract {
  onModeChange?(mode: FeatureModeContract): void;
  onOpen?(): void;
  onClose?(): void;
  onFocus?(): void;
  onBlur?(): void;
}


