import { MessageBase } from "@cogno/core/workbench/bus/message-base";

type SideMenuViewOpenedEvent = MessageBase<"SideMenuViewOpened", { label: string }>;
type SideMenuViewClosedEvent = MessageBase<"SideMenuViewClosed", { label: string }>;
type SideMenuViewFocusedEvent = MessageBase<"SideMenuViewFocused", { label: string }>;
type SideMenuViewBlurredEvent = MessageBase<"SideMenuViewBlurred", { label: string }>;

export type SideMenuEvent =
  | SideMenuViewOpenedEvent
  | SideMenuViewClosedEvent
  | SideMenuViewFocusedEvent
  | SideMenuViewBlurredEvent;
