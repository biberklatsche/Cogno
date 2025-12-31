import {InjectionToken} from '@angular/core';
import {WorkspaceConfigUi} from "../../workspace/+state/workspace.service";

export const DIALOG_DATA = new InjectionToken<WorkspaceConfigUi>('DIALOG_DATA');
