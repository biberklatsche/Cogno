import { FeatureModeContract } from "@cogno/shared/domain";

export interface SideMenuFeatureLifecycleContract {
  onModeChange?(mode: FeatureModeContract): void;
  onOpen?(): void;
  onClose?(): void;
  onFocus?(): void;
  onBlur?(): void;
}
