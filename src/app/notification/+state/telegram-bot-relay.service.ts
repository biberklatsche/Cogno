import {DestroyRef, inject, Injectable} from "@angular/core";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {Bot, Context, GrammyError, HttpError} from "grammy";
import {AppBus} from "../../app-bus/app-bus";
import {ConfigService} from "../../config/+state/config.service";
import {NotificationEvent} from "../+bus/events";
import {TerminalId} from "../../grid-list/+model/model";
import {Logger} from "../../_tauri/logger";

type TelegramConfiguration = {
    enabled: boolean;
    botToken: string;
    chatIdentifier: string;
    forwardNotifications: boolean;
    forwardRepliesToTerminal: boolean;
};

@Injectable({providedIn: "root"})
export class TelegramBotRelayService {
    private readonly appBus = inject(AppBus);
    private readonly configService = inject(ConfigService);
    private readonly destroyReference = inject(DestroyRef);

    private readonly botByToken: Map<string, Bot> = new Map();
    private readonly incomingHandlerRegisteredForToken: Set<string> = new Set();
    private readonly terminalIdByReplyKey: Map<string, TerminalId> = new Map();
    private readonly maxMappedReplies = 500;
    private activeReceivingBotToken?: string;

    constructor() {
        this.appBus.on$({type: "Notification", path: ["notification"]})
            .pipe(takeUntilDestroyed(this.destroyReference))
            .subscribe((notificationEvent) => {
                console.log("##############NotificationEvent", notificationEvent);
                void this.forwardNotificationToTelegramIfNeeded(notificationEvent).catch((error: unknown) => {
                    Logger.warn(`[TelegramBotRelayService] forwarding failed: ${String(error)}`);
                });
            });

        this.configService.config$
            .pipe(takeUntilDestroyed(this.destroyReference))
            .subscribe(() => this.reconcileIncomingTelegramRelay());

        this.destroyReference.onDestroy(() => this.stopIncomingTelegramRelay());
    }

    private reconcileIncomingTelegramRelay(): void {
        const telegramConfiguration = this.readTelegramConfiguration();
        if (
            !telegramConfiguration.enabled
            || !telegramConfiguration.forwardRepliesToTerminal
            || !this.isTelegramConfigurationUsable(telegramConfiguration)
        ) {
            this.stopIncomingTelegramRelay();
            return;
        }

        if (this.activeReceivingBotToken === telegramConfiguration.botToken) {
            return;
        }

        this.stopIncomingTelegramRelay();
        const telegramBot = this.getTelegramBot(telegramConfiguration.botToken);
        this.ensureIncomingHandlerRegistered(telegramConfiguration.botToken, telegramBot);
        void telegramBot.start({allowed_updates: ["message"]}).catch((error: unknown) => {
            Logger.warn(`[TelegramBotRelayService] receiver failed: ${this.describeTelegramError(error)}`);
        });
        this.activeReceivingBotToken = telegramConfiguration.botToken;
    }

    private stopIncomingTelegramRelay(): void {
        if (!this.activeReceivingBotToken) {
            return;
        }

        const activeBot = this.botByToken.get(this.activeReceivingBotToken);
        if (activeBot) {
            try {
                activeBot.stop();
            } catch (error: unknown) {
                Logger.warn(`[TelegramBotRelayService] stop receiver failed: ${this.describeTelegramError(error)}`);
            }
        }

        this.activeReceivingBotToken = undefined;
    }

    private ensureIncomingHandlerRegistered(botToken: string, telegramBot: Bot): void {
        if (this.incomingHandlerRegisteredForToken.has(botToken)) {
            return;
        }

        telegramBot.on("message:text", (context: Context) => {
            void this.handleIncomingTextMessage(context).catch((error: unknown) => {
                Logger.warn(`[TelegramBotRelayService] handling incoming message failed: ${String(error)}`);
            });
        });

        telegramBot.catch((error: unknown) => {
            const botError = error as {error?: unknown};
            Logger.warn(`[TelegramBotRelayService] bot error: ${this.describeTelegramError(botError.error ?? error)}`);
        });

        this.incomingHandlerRegisteredForToken.add(botToken);
    }

    private async handleIncomingTextMessage(context: Context): Promise<void> {
        const messageText = context.message?.text?.trim();
        if (!messageText) {
            return;
        }
        if (context.from?.is_bot) {
            return;
        }

        const telegramConfiguration = this.readTelegramConfiguration();
        if (
            !telegramConfiguration.enabled
            || !telegramConfiguration.forwardRepliesToTerminal
            || !this.isTelegramConfigurationUsable(telegramConfiguration)
        ) {
            return;
        }

        const incomingChatIdentifier = String(context.chat?.id ?? "");
        if (incomingChatIdentifier !== telegramConfiguration.chatIdentifier) {
            return;
        }

        const replyMessageIdentifier = context.message?.reply_to_message?.message_id;
        const targetTerminalIdentifier = this.resolveTerminalIdForIncomingReply(
            incomingChatIdentifier,
            replyMessageIdentifier
        );
        if (!targetTerminalIdentifier) {
            this.appBus.publish({
                type: "Notification",
                path: ["notification"],
                payload: {
                    header: "Telegram Reply",
                    body: "No terminal mapping found. Reply directly to a forwarded terminal notification.",
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
                terminalId: targetTerminalIdentifier,
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
                source: "telegram"
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
        const sentMessage = await telegramBot.api.sendMessage(telegramConfiguration.chatIdentifier, text);
        this.rememberReplyMapping(
            telegramConfiguration.chatIdentifier,
            sentMessage.message_id,
            notificationPayload.terminalId
        );
    }

    private readTelegramConfiguration(): TelegramConfiguration {
        const telegramConfiguration = this.configService.config.notification?.telegram;
        return {
            enabled: telegramConfiguration?.enabled ?? false,
            botToken: telegramConfiguration?.bot_token ?? "",
            chatIdentifier: telegramConfiguration?.chat_id ?? "",
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

    private resolveTerminalIdForIncomingReply(chatIdentifier: string, replyMessageIdentifier?: number): TerminalId | undefined {
        if (replyMessageIdentifier == null) {
            return undefined;
        }
        return this.terminalIdByReplyKey.get(this.buildReplyKey(chatIdentifier, replyMessageIdentifier));
    }

    private rememberReplyMapping(chatIdentifier: string, messageIdentifier: number, terminalId?: TerminalId): void {
        if (!terminalId) {
            return;
        }

        const replyKey = this.buildReplyKey(chatIdentifier, messageIdentifier);
        this.terminalIdByReplyKey.set(replyKey, terminalId);

        while (this.terminalIdByReplyKey.size > this.maxMappedReplies) {
            const firstKey = this.terminalIdByReplyKey.keys().next().value as string | undefined;
            if (!firstKey) {
                break;
            }
            this.terminalIdByReplyKey.delete(firstKey);
        }
    }

    private buildReplyKey(chatIdentifier: string, messageIdentifier: number): string {
        return `${chatIdentifier}:${messageIdentifier}`;
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
