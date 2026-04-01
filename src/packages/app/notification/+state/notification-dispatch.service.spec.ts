import type { DestroyRef } from "@angular/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  NotificationChannelContract,
  NotificationChannelDispatchRequestContract,
  NotificationReplyChannelContract,
} from "@cogno/core-api";
import type { Config } from "../../config/+models/config";
import { AppBus } from "../../app-bus/app-bus";
import { ConfigServiceMock } from "../../../__test__/mocks/config-service.mock";
import { AppWiringService } from "@cogno/app/app-host/app-wiring.service";
import { NotificationDispatchService } from "./notification-dispatch.service";

type DestroyRefMock = DestroyRef & {
  destroy(): void;
};

type NotificationChannelsWiringPort = Pick<AppWiringService, "getNotificationChannels">;

describe("NotificationDispatchService", () => {
  let appBus: AppBus;
  let configService: ConfigServiceMock;
  let dispatchNotificationMock: ReturnType<typeof vi.fn>;
  let startReceivingRepliesMock: ReturnType<typeof vi.fn>;
  let stopReceivingRepliesMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    appBus = new AppBus();
    configService = new ConfigServiceMock();
    configService.setConfig({
      notifications: {
        app: {
          available: true,
          enabled: true,
          duration_seconds: 5,
        },
        os: {
          available: true,
          enabled: false,
        },
        "reply-channel": {
          available: true,
          enabled: true,
        },
      },
    } as Config);
    dispatchNotificationMock = vi.fn();
    startReceivingRepliesMock = vi.fn();
    stopReceivingRepliesMock = vi.fn();
  });

  it("dispatches notifications only to enabled channels", () => {
    const notificationChannels = [
      createNotificationChannel({
        id: "app",
        dispatch: dispatchNotificationMock,
      }),
      createNotificationChannel({
        id: "os",
        dispatch: dispatchNotificationMock,
      }),
    ];

    createService(notificationChannels);
    appBus.publish({
      path: ["notification"],
      type: "Notification",
      payload: {
        header: "Build completed",
      },
    });

    expect(dispatchNotificationMock).toHaveBeenCalledTimes(1);
    expect(dispatchNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        notification: expect.objectContaining({ header: "Build completed" }),
        settings: expect.objectContaining({ enabled: true }),
      }),
    );
  });

  it("starts and stops reply channels with the dispatch service lifecycle", () => {
    const notificationReplyChannel = createReplyNotificationChannel({
      id: "reply-channel",
      dispatch: dispatchNotificationMock,
      startReceivingReplies: startReceivingRepliesMock,
      stopReceivingReplies: stopReceivingRepliesMock,
    });
    const destroyRef = createDestroyRefMock();

    createService([notificationReplyChannel], destroyRef);

    expect(startReceivingRepliesMock).toHaveBeenCalledTimes(1);
    expect(startReceivingRepliesMock).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));

    destroyRef.destroy();

    expect(stopReceivingRepliesMock).toHaveBeenCalledTimes(1);
  });

  function createService(
    notificationChannels: ReadonlyArray<NotificationChannelContract>,
    destroyRef = createDestroyRefMock(),
  ): NotificationDispatchService {
    const appWiringService: NotificationChannelsWiringPort = {
      getNotificationChannels: () => notificationChannels,
    };

    return new NotificationDispatchService(
      appBus,
      appWiringService as AppWiringService,
      configService,
      destroyRef,
    );
  }
});

function createNotificationChannel({
  id,
  dispatch,
}: {
  readonly dispatch: (notificationChannelDispatchRequest: NotificationChannelDispatchRequestContract) => void;
  readonly id: string;
}): NotificationChannelContract {
  return {
    displayName: id.toUpperCase(),
    id,
    sortOrder: 100,
    dispatch,
  };
}

function createDestroyRefMock(): DestroyRefMock {
  const destroyCallbacks: Array<() => void> = [];

  return {
    destroyed: false,
    onDestroy(callback: () => void): () => void {
      destroyCallbacks.push(callback);
      return () => {
        const callbackIndex = destroyCallbacks.indexOf(callback);
        if (callbackIndex >= 0) {
          destroyCallbacks.splice(callbackIndex, 1);
        }
      };
    },
    destroy(): void {
      for (const destroyCallback of destroyCallbacks.splice(0)) {
        destroyCallback();
      }
    },
  };
}

function createReplyNotificationChannel({
  id,
  dispatch,
  startReceivingReplies,
  stopReceivingReplies,
}: {
  readonly dispatch: (notificationChannelDispatchRequest: NotificationChannelDispatchRequestContract) => void;
  readonly id: string;
  readonly startReceivingReplies: () => void;
  readonly stopReceivingReplies: () => void;
}): NotificationReplyChannelContract {
  return {
    ...createNotificationChannel({ id, dispatch }),
    startReceivingReplies,
    stopReceivingReplies,
  };
}
