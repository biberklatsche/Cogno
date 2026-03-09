import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {TelegramBotRelayService} from "./telegram-bot-relay.service";
import {AppBus} from "../../app-bus/app-bus";
import {DestroyRef} from "@angular/core";
import {clear, getAppBus, getConfigService, getDestroyRef} from "../../../__test__/test-factory";
import {ConfigServiceMock} from "../../../__test__/mocks/config-service.mock";

describe("TelegramBotRelayService", () => {
    let service: TelegramBotRelayService;
    let appBus: AppBus;
    let configService: ConfigServiceMock;
    let destroyRef: DestroyRef;

    beforeEach(() => {
        appBus = getAppBus();
        configService = getConfigService();
        destroyRef = getDestroyRef();
        configService.setConfig({
            notification: {
                telegram: {
                    available: true,
                    enabled: false,
                    bot_token: "",
                    chat_id: "42",
                    forward_replies_to_terminal: true,
                }
            }
        } as any);

        service = new TelegramBotRelayService(appBus, configService, destroyRef);
        vi.spyOn(service as any, "readTelegramConfiguration").mockReturnValue({
            available: true,
            enabled: true,
            botToken: "test-token",
            chatIdentifier: "42",
            forwardRepliesToTerminal: true,
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        clear();
    });

    it("uses latest chat mapping for direct telegram messages without reply_to_message", async () => {
        const publishSpy = vi.spyOn(appBus, "publish");
        (service as any).rememberReplyMapping("42", 10, "terminal-a");
        (service as any).rememberReplyMapping("42", 11, "terminal-b");

        await (service as any).handleIncomingTextMessage({
            message: {text: "pwd"},
            from: {is_bot: false},
            chat: {id: 42},
        });

        expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
            type: "InjectTerminalInput",
            payload: expect.objectContaining({
                terminalId: "terminal-b",
                text: "pwd",
                appendNewline: true,
            })
        }));
    });

    it("prefers explicit reply_to_message mapping over latest chat mapping", async () => {
        const publishSpy = vi.spyOn(appBus, "publish");
        (service as any).rememberReplyMapping("42", 10, "terminal-a");
        (service as any).rememberReplyMapping("42", 11, "terminal-b");

        await (service as any).handleIncomingTextMessage({
            message: {
                text: "ls -la",
                reply_to_message: {message_id: 10},
            },
            from: {is_bot: false},
            chat: {id: 42},
        });

        expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
            type: "InjectTerminalInput",
            payload: expect.objectContaining({
                terminalId: "terminal-a",
                text: "ls -la",
                appendNewline: true,
            })
        }));
    });
});
