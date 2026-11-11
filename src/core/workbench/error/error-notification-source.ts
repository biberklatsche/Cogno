import { NotificationSourceContract } from "@cogno/core/api/contributions";

export const ERROR_NOTIFICATION_SOURCE_ID = "errors";
export const HANDLED_EXCEPTION_EVENT_ID = "handled";
export const UNHANDLED_EXCEPTION_EVENT_ID = "unhandled";

/** Cogno's own errors as a source of notifications; off by default, for diagnosis. */
export const ERROR_NOTIFICATION_SOURCE: NotificationSourceContract = {
  id: ERROR_NOTIFICATION_SOURCE_ID,
  label: "Errors",
  events: [
    {
      id: HANDLED_EXCEPTION_EVENT_ID,
      label: "A handled error is reported",
      description: "Notify about handled exceptions reported through the central error reporter.",
    },
    {
      id: UNHANDLED_EXCEPTION_EVENT_ID,
      label: "An unhandled error occurs",
      description:
        "Notify about unhandled renderer exceptions caught by the global error reporter.",
    },
  ],
};
