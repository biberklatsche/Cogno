import {MessageBase} from "../../../app-bus/app-bus";

export type SideMenuViewOpenedEvent = MessageBase<"SideMenuViewOpened", { label: string }>;
export type SideMenuViewClosedEvent = MessageBase<"SideMenuViewClosed", { label: string }>;
export type SideMenuViewFocusedEvent = MessageBase<"SideMenuViewFocused", { label: string }>;
export type SideMenuViewBlurredEvent = MessageBase<"SideMenuViewBlurred", { label: string }>;

export type SideMenuEvent =
    | SideMenuViewOpenedEvent
    | SideMenuViewClosedEvent
    | SideMenuViewFocusedEvent
    | SideMenuViewBlurredEvent;
