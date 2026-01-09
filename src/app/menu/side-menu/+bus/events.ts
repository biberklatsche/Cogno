import {MessageBase} from "../../../app-bus/app-bus";

export type SideMenuViewOpenedEvent = MessageBase<"SideMenuViewOpened", { label: string }>;
export type SideMenuViewClosedEvent = MessageBase<"SideMenuViewClosed", { label: string }>;

export type SideMenuEvent = SideMenuViewOpenedEvent | SideMenuViewClosedEvent;
