/** The shape every bus message shares. Imports nothing, so message types never import the bus. */
export type MessageBase<T extends string = string, P = unknown> = {
  type: T;
  payload?: P;

  /** Set by a subscriber that carried the message out (an action that ran). */
  performed?: boolean;
  defaultPrevented?: boolean;
};

export type ActionBase<T extends string = string, P = unknown> = MessageBase<T, P> & {
  trigger?: { broadcast: boolean; unconsumed: boolean; performable: boolean; always: boolean };
  args?: string[];
};
