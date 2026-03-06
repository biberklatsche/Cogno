import {DestroyRef, Injectable} from "@angular/core";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {Bot, Context, GrammyError, HttpError} from "grammy";
import {AppBus} from "../../app-bus/app-bus";
import {ConfigService} from "../../config/+state/config.service";
import {NotificationChannels, NotificationEvent} from "../+bus/events";
import {TerminalId} from "../../grid-list/+model/model";
import {Logger} from "../../_tauri/logger";

type TelegramConfiguration = {
    available: boolean;
    enabled: boolean;
    botToken: string;
    chatIdentifier: string;
    forwardRepliesToTerminal: boolean;
};

@Injectable({providedIn: "root"})
export class TelegramBotRelayService {

    private readonly botByToken: Map<string, Bot> = new Map();
    private readonly incomingHandlerRegisteredForToken: Set<string> = new Set();
    private readonly terminalIdByReplyKey: Map<string, TerminalId> = new Map();
    private readonly lastTerminalIdByChatIdentifier: Map<string, TerminalId> = new Map();
    private readonly terminalIdsWithOpenChannel: Set<TerminalId> = new Set();
    private readonly maxMappedReplies = 50;
    private receivingBot?: Bot;

    constructor(private appBus: AppBus, private configService: ConfigService, private destroyReference: DestroyRef,) {
        this.appBus.on$({type: "Notification", path: ["notification"]})
            .pipe(takeUntilDestroyed(this.destroyReference))
            .subscribe((notificationEvent) => {
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
            !telegramConfiguration.available
            || !telegramConfiguration.enabled
            || !telegramConfiguration.forwardRepliesToTerminal
            || !this.isTelegramConfigurationUsable(telegramConfiguration)
        ) {
            this.stopIncomingTelegramRelay();
            return;
        }

        const telegramBot = this.getTelegramBot(telegramConfiguration.botToken);
        this.ensureIncomingHandlerRegistered(telegramConfiguration.botToken, telegramBot);
        if (this.receivingBot === telegramBot) {
            return;
        }

        this.stopIncomingTelegramRelay(telegramBot);
        void telegramBot.start({allowed_updates: ["message"]}).catch((error: unknown) => {
            Logger.warn(`[TelegramBotRelayService] receiver failed: ${this.describeTelegramError(error)}`);
            if (this.receivingBot === telegramBot) {
                this.receivingBot = undefined;
            }
        });
        this.receivingBot = telegramBot;
    }

    private stopIncomingTelegramRelay(keepBot?: Bot): void {
        for (const bot of this.botByToken.values()) {
            if (keepBot && bot === keepBot) {
                continue;
            }
            try {
                bot.stop();
            } catch (error: unknown) {
                Logger.warn(`[TelegramBotRelayService] stop receiver failed: ${this.describeTelegramError(error)}`);
            }
        }
        this.receivingBot = keepBot;
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
            !telegramConfiguration.available
            || !telegramConfiguration.enabled
            || !telegramConfiguration.forwardRepliesToTerminal
            || !this.isTelegramConfigurationUsable(telegramConfiguration)
        ) {
            return;
        }

        const incomingChatIdentifier = String(context.chat?.id ?? "");
        if (
            incomingChatIdentifier.length > 0
            && incomingChatIdentifier !== telegramConfiguration.chatIdentifier
        ) {
            return;
        }

        const replyMessageIdentifier = context.message?.reply_to_message?.message_id;
        const targetTerminalIdentifier = this.resolveTerminalIdForIncomingReply(
            incomingChatIdentifier,
            replyMessageIdentifier
        ) ?? this.resolveLatestTerminalIdForChat(incomingChatIdentifier)
            ?? this.resolveSingleTerminalFallback(incomingChatIdentifier);
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
        this.rememberTerminalIdWithOpenChannel(notificationPayload.terminalId, notificationPayload.channels);
        if (notificationPayload.source === "telegram") {
            return;
        }

        const telegramConfiguration = this.readTelegramConfiguration();
        if (
            !telegramConfiguration.available
            || !telegramConfiguration.enabled
            || !this.isTelegramConfigurationUsable(telegramConfiguration)
            || !this.isTelegramChannelEnabledForNotification(notificationPayload.channels)
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
            available: telegramConfiguration?.available ?? true,
            enabled: telegramConfiguration?.enabled ?? false,
            botToken: telegramConfiguration?.bot_token ?? "",
            chatIdentifier: telegramConfiguration?.chat_id ?? "",
            forwardRepliesToTerminal: telegramConfiguration?.forward_replies_to_terminal ?? true,
        };
    }

    private isTelegramChannelEnabledForNotification(notificationChannels?: Partial<NotificationChannels>): boolean {
        if (!notificationChannels || notificationChannels.telegram == null) {
            return true;
        }
        return notificationChannels.telegram;
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
        this.lastTerminalIdByChatIdentifier.set(chatIdentifier, terminalId);

        while (this.terminalIdByReplyKey.size > this.maxMappedReplies) {
            const firstKey = this.terminalIdByReplyKey.keys().next().value as string | undefined;
            if (!firstKey) {
                break;
            }
            this.terminalIdByReplyKey.delete(firstKey);
        }
    }

    private rememberTerminalIdWithOpenChannel(
        terminalId?: TerminalId,
        notificationChannels?: Partial<NotificationChannels>
    ): void {
        if (!terminalId || !notificationChannels) {
            return;
        }

        const hasOpenChannel = Boolean(
            notificationChannels.app
            || notificationChannels.os
            || notificationChannels.telegram
        );
        if (hasOpenChannel) {
            this.terminalIdsWithOpenChannel.add(terminalId);
            return;
        }
        this.terminalIdsWithOpenChannel.delete(terminalId);
    }

    private resolveSingleTerminalFallback(incomingChatIdentifier: string): TerminalId | undefined {
        if (incomingChatIdentifier.length > 0) {
            return undefined;
        }
        if (this.terminalIdsWithOpenChannel.size !== 1) {
            return undefined;
        }
        return this.terminalIdsWithOpenChannel.values().next().value as TerminalId | undefined;
    }

    private resolveLatestTerminalIdForChat(incomingChatIdentifier: string): TerminalId | undefined {
        if (!incomingChatIdentifier) {
            return undefined;
        }
        return this.lastTerminalIdByChatIdentifier.get(incomingChatIdentifier);
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
