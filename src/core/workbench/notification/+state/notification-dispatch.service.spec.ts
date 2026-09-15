import type { DestroyRef } from "@angular/core";
import type { Config } from "@cogno/core/infrastructure/config/models/config";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import type { NotificationChannelRegistry } from "@cogno/core/workbench/notification/+state/notification-channel-registry";
import type {
  NotificationChannelContract,
  NotificationChannelDispatchRequestContract,
  NotificationReplyChannelContract,
} from "@cogno/shared/domain";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigServiceMock } from "../../../../__test__/mocks/config-service.mock";
import { NotificationDispatchService } from "./notification-dispatch.service";

type DestroyRefMock = DestroyRef & {
  destroy(): void;
};

type NotificationChannelRegistryPort = Pick<NotificationChannelRegistry, "getChannels">;

describe("NotificationDispatchService", () => {
  let appBus: AppBus;
  let configService: ConfigServiceMock;
  let dispatchNotificationMock: ReturnType<typeof vi.fn<NotificationChannelContract["dispatch"]>>;
  let startReceivingRepliesMock: ReturnType<
    typeof vi.fn<NonNullable<NotificationReplyChannelContract["startReceivingReplies"]>>
  >;
  let stopReceivingRepliesMock: ReturnType<
    typeof vi.fn<NonNullable<NotificationReplyChannelContract["stopReceivingReplies"]>>
  >;

  beforeEach(() => {
    appBus = new AppBus();
    configService = new ConfigServiceMock();
    configService.setConfig({
      notification: {
        channel: {
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
      },
    } as Config);
    dispatchNotificationMock = vi.fn<NotificationChannelContract["dispatch"]>();
    startReceivingRepliesMock =
      vi.fn<NonNullable<NotificationReplyChannelContract["startReceivingReplies"]>>();
    stopReceivingRepliesMock =
      vi.fn<NonNullable<NotificationReplyChannelContract["stopReceivingReplies"]>>();
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

  it("isolates a throwing channel so the others still receive the notification", async () => {
    const throwingDispatch = vi.fn(() => {
      throw new Error("channel boom");
    });
    const workingDispatch = vi.fn();

    createService([
      createNotificationChannel({ id: "app", dispatch: throwingDispatch }),
      createNotificationChannel({ id: "reply-channel", dispatch: workingDispatch }),
    ]);
    appBus.publish({
      path: ["notification"],
      type: "Notification",
      payload: { header: "Build completed" },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(throwingDispatch).toHaveBeenCalledTimes(1);
    expect(workingDispatch).toHaveBeenCalledTimes(1);
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
    expect(startReceivingRepliesMock).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
    );

    destroyRef.destroy();

    expect(stopReceivingRepliesMock).toHaveBeenCalledTimes(1);
  });

  function createService(
    notificationChannels: ReadonlyArray<NotificationChannelContract>,
    destroyRef = createDestroyRefMock(),
  ): NotificationDispatchService {
    const notificationChannelRegistry: NotificationChannelRegistryPort = {
      getChannels: () => notificationChannels,
    };

    return new NotificationDispatchService(
      appBus,
      notificationChannelRegistry as NotificationChannelRegistry,
      configService,
      destroyRef,
    );
  }
});

function createNotificationChannel({
  id,
  dispatch,
}: {
  readonly dispatch: (
    notificationChannelDispatchRequest: NotificationChannelDispatchRequestContract,
  ) => void;
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
  readonly dispatch: (
    notificationChannelDispatchRequest: NotificationChannelDispatchRequestContract,
  ) => void;
  readonly id: string;
  readonly startReceivingReplies: NonNullable<
    NotificationReplyChannelContract["startReceivingReplies"]
  >;
  readonly stopReceivingReplies: NonNullable<
    NotificationReplyChannelContract["stopReceivingReplies"]
  >;
}): NotificationReplyChannelContract {
  return {
    ...createNotificationChannel({ id, dispatch }),
    startReceivingReplies,
    stopReceivingReplies,
  };
}
