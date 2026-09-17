import { Injectable } from "@angular/core";
import { AppMessage } from "@cogno/core/workbench/bus/messages";
import { Observable, Subject } from "rxjs";
import { filter, take } from "rxjs/operators";

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

/**
 * The workbench's message bus: one stream, subscribed by message type. Every
 * subscriber of a type gets a published message exactly once, synchronously,
 * in subscription order.
 */
@Injectable({ providedIn: "root" })
export class AppBus {
  private readonly messages = new Subject<AppMessage>();

  on$<K extends AppMessage["type"]>(
    type: K | readonly K[],
  ): Observable<Extract<AppMessage, { type: K }>> {
    const types: readonly string[] = typeof type === "string" ? [type] : type;
    return this.messages.pipe(
      filter((message): message is Extract<AppMessage, { type: K }> =>
        types.includes(message.type),
      ),
    );
  }

  /** The next message of `type`, then complete. */
  once$<K extends AppMessage["type"]>(type: K): Observable<Extract<AppMessage, { type: K }>> {
    return this.on$(type).pipe(take(1));
  }

  /** Delivers `message` and reports what its subscribers made of it. */
  publish(message: AppMessage): { defaultPrevented: boolean; performed?: boolean } {
    this.messages.next(message);
    return {
      defaultPrevented: message.defaultPrevented ?? false,
      performed: message.performed,
    };
  }
}
