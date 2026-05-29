import { MessageBase } from "../../../app-bus/app-bus";

export type BusyIndicatorTarget = { kind: "terminal"; id: string } | { kind: "tab"; id: string };

export type BusyIndicatorRegisterEvent = MessageBase<
  "BusyIndicatorRegister",
  {
    registrationId: string;
    target: BusyIndicatorTarget;
    keyframes: number[][];
    priority: number;
  }
>;

export type BusyIndicatorUnregisterEvent = MessageBase<
  "BusyIndicatorUnregister",
  { registrationId: string }
>;
