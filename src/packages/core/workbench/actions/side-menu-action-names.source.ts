/**
 * The action names the side-menu features contribute, for the action
 * catalogue. Features are wired together above the workbench, so the workbench
 * asks for these through a source instead of reaching the app-era registry
 * (ARCHITECTURE.md 3.1, "sources are injected").
 */
export abstract class SideMenuActionNamesSource {
  abstract getSideMenuActionNames(): ReadonlyArray<string>;
}
