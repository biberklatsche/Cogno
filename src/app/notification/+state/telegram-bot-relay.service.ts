import {DestroyRef, inject, Injectable} from "@angular/core";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {Bot, GrammyError, HttpError} from "grammy";
import {AppBus} from "../../app-bus/app-bus";
import {ConfigService} from "../../config/+state/config.service";
import {NotificationEvent} from "../+bus/events";
import {GridListService} from "../../grid-list/+state/grid-list.service";
import {Logger} from "../../_tauri/logger";

type TelegramConfiguration = {
    enabled: boolean;
    botToken: string;
    chatIdentifier: string;
    pollIntervalSeconds: number;
    forwardNotifications: boolean;
    forwardRepliesToTerminal: boolean;
};

@Injectable({providedIn: "root"})
export class TelegramBotRelayService {
    private readonly appBus = inject(AppBus);
    private readonly configService = inject(ConfigService);
    private readonly gridListService = inject(GridListService);
    private readonly destroyReference = inject(DestroyRef);

    private nextUpdateOffset: number = 0;
    private pollTimerHandle?: ReturnType<typeof setTimeout>;
    private activePollIntervalSeconds: number = 10;
    private isPollingInProgress = false;
    private readonly botByToken: Map<string, Bot> = new Map();

    constructor() {
        this.appBus.on$({type: "Notification", path: ["notification"]})
            .pipe(takeUntilDestroyed(this.destroyReference))
            .subscribe((notificationEvent) => {
                void this.forwardNotificationToTelegramIfNeeded(notificationEvent).catch((error: unknown) => {
                    Logger.warn(`[TelegramBotRelayService] forwarding failed: ${String(error)}`);
                });
            });

        this.startPollingLoop();
        this.destroyReference.onDestroy(() => this.stopPollingLoop());
    }

    private startPollingLoop(): void {
        this.stopPollingLoop();
        void this.pollTelegramUpdates();
    }

    private stopPollingLoop(): void {
        if (!this.pollTimerHandle) {
            return;
        }
        clearTimeout(this.pollTimerHandle);
        this.pollTimerHandle = undefined;
    }

    private scheduleNextPoll(delayMilliseconds: number): void {
        this.stopPollingLoop();
        this.pollTimerHandle = setTimeout(() => {
            void this.pollTelegramUpdates();
        }, delayMilliseconds);
    }

    private async pollTelegramUpdates(): Promise<void> {
        if (this.isPollingInProgress) {
            return;
        }
        this.isPollingInProgress = true;

        try {
            const telegramConfiguration = this.readTelegramConfiguration();
            if (
                !telegramConfiguration.enabled
                || !telegramConfiguration.forwardRepliesToTerminal
                || !this.isTelegramConfigurationUsable(telegramConfiguration)
            ) {
                this.scheduleNextPoll(5000);
                return;
            }

            this.activePollIntervalSeconds = telegramConfiguration.pollIntervalSeconds;
            const telegramBot = this.getTelegramBot(telegramConfiguration.botToken);
            const telegramUpdates = await telegramBot.api.getUpdates({
                offset: this.nextUpdateOffset,
                timeout: 0,
                allowed_updates: ["message"],
            });

            for (const telegramUpdate of telegramUpdates) {
                const updateIdentifier = telegramUpdate.update_id;
                if (updateIdentifier >= this.nextUpdateOffset) {
                    this.nextUpdateOffset = updateIdentifier + 1;
                }
                await this.handleTelegramUpdate(telegramConfiguration, telegramUpdate);
            }
        } catch (error: unknown) {
            Logger.warn(`[TelegramBotRelayService] polling failed: ${this.describeTelegramError(error)}`);
        } finally {
            this.isPollingInProgress = false;
            this.scheduleNextPoll(this.activePollIntervalSeconds * 1000);
        }
    }

    private async handleTelegramUpdate(
        telegramConfiguration: TelegramConfiguration,
        telegramUpdate: Awaited<ReturnType<Bot["api"]["getUpdates"]>>[number]
    ): Promise<void> {
        const messageText = telegramUpdate.message?.text?.trim();
        if (!messageText) {
            return;
        }
        if (telegramUpdate.message?.from?.is_bot) {
            return;
        }

        const incomingChatIdentifier = String(telegramUpdate.message?.chat?.id ?? "");
        if (incomingChatIdentifier !== telegramConfiguration.chatIdentifier) {
            return;
        }

        const focusedTerminalIdentifier = this.gridListService.getFocusedTerminalId();
        if (!focusedTerminalIdentifier) {
            this.appBus.publish({
                type: "Notification",
                path: ["notification"],
                payload: {
                    header: "Telegram Reply",
                    body: `No focused terminal to forward: ${messageText}`,
                    type: "warning",
                    timestamp: new Date(),
                    source: "telegram",
                }
            });
            return;
        }

        this.appBus.publish({
            type: "InjectTerminalInput",
            path: ["app", "terminal"],
            payload: {
                terminalId: focusedTerminalIdentifier,
                text: messageText,
                appendNewline: true,
            }
        });

        this.appBus.publish({
            type: "Notification",
            path: ["notification"],
            payload: {
                header: "Telegram Reply",
                body: messageText,
                type: "info",
                timestamp: new Date(),
                source: "telegram",
            }
        });
    }

    private async forwardNotificationToTelegramIfNeeded(notificationEvent: NotificationEvent): Promise<void> {
        const notificationPayload = notificationEvent.payload;
        if (!notificationPayload) {
            return;
        }
        if (notificationPayload.source === "telegram") {
            return;
        }

        const telegramConfiguration = this.readTelegramConfiguration();
        if (
            !telegramConfiguration.enabled
            || !telegramConfiguration.forwardNotifications
            || !this.isTelegramConfigurationUsable(telegramConfiguration)
        ) {
            return;
        }

        const bodyText = notificationPayload.body?.trim();
        const text = bodyText
            ? `[Notification] ${notificationPayload.header}\n${bodyText}`
            : `[Notification] ${notificationPayload.header}`;

        const telegramBot = this.getTelegramBot(telegramConfiguration.botToken);
        await telegramBot.api.sendMessage(telegramConfiguration.chatIdentifier, text);
    }

    private readTelegramConfiguration(): TelegramConfiguration {
        const telegramConfiguration = this.configService.config.notification?.telegram;
        return {
            enabled: telegramConfiguration?.enabled ?? false,
            botToken: telegramConfiguration?.bot_token ?? "",
            chatIdentifier: telegramConfiguration?.chat_id ?? "",
            pollIntervalSeconds: telegramConfiguration?.poll_interval_seconds ?? 10,
            forwardNotifications: telegramConfiguration?.forward_notifications ?? true,
            forwardRepliesToTerminal: telegramConfiguration?.forward_replies_to_terminal ?? true,
        };
    }

    private isTelegramConfigurationUsable(telegramConfiguration: TelegramConfiguration): boolean {
        return telegramConfiguration.botToken.trim().length > 0 && telegramConfiguration.chatIdentifier.trim().length > 0;
    }

    private getTelegramBot(botToken: string): Bot {
        const existingBot = this.botByToken.get(botToken);
        if (existingBot) {
            return existingBot;
        }
        const createdBot = new Bot(botToken);
        this.botByToken.set(botToken, createdBot);
        return createdBot;
    }

    private describeTelegramError(error: unknown): string {
        if (error instanceof GrammyError) {
            return `Telegram API error (${error.error_code}): ${error.description}`;
        }
        if (error instanceof HttpError) {
            return `Telegram HTTP error: ${String(error.error)}`;
        }
        return String(error);
    }
}
