import { MessageBase } from "@cogno/app/app-bus/app-bus";

export interface SelectedWorkspacePayload {
  readonly color?: string;
  readonly id: string;
  readonly name: string;
}

export type SelectedWorkspaceChangedEvent = MessageBase<"SelectedWorkspaceChanged", SelectedWorkspacePayload | undefined>;
