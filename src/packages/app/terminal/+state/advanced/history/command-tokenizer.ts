import { CommandToken } from "./command-pattern.models";

export class CommandTokenizer {
    tokenize(commandText: string): CommandToken[] {
        const trimmedCommandText = commandText.trim();
        if (!trimmedCommandText) {
            return [];
        }

        const commandTokens: CommandToken[] = [];
        let currentTokenCharacters = "";
        let activeQuoteCharacter: '"' | "'" | null = null;
        let tokenWasQuoted = false;

        const pushCurrentToken = (): void => {
            if (!currentTokenCharacters) {
                return;
            }

            commandTokens.push({
                value: currentTokenCharacters,
                rawValue: currentTokenCharacters,
                wasQuoted: tokenWasQuoted,
            });
            currentTokenCharacters = "";
            tokenWasQuoted = false;
        };

        for (let characterIndex = 0; characterIndex < trimmedCommandText.length; characterIndex += 1) {
            const currentCharacter = trimmedCommandText[characterIndex];

            if (activeQuoteCharacter !== null) {
                if (currentCharacter === "\\" && characterIndex + 1 < trimmedCommandText.length) {
                    characterIndex += 1;
                    currentTokenCharacters += trimmedCommandText[characterIndex];
                    continue;
                }

                if (currentCharacter === activeQuoteCharacter) {
                    activeQuoteCharacter = null;
                    continue;
                }

                currentTokenCharacters += currentCharacter;
                continue;
            }

            if (currentCharacter === '"' || currentCharacter === "'") {
                activeQuoteCharacter = currentCharacter;
                tokenWasQuoted = true;
                continue;
            }

            if (/\s/u.test(currentCharacter)) {
                pushCurrentToken();
                continue;
            }

            currentTokenCharacters += currentCharacter;
        }

        pushCurrentToken();
        return commandTokens;
    }
}
