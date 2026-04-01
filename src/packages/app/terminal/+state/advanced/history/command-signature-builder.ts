import { ClassifiedCommandToken, CommandSignature, CommandSignaturePart } from "./command-pattern.models";

export class CommandSignatureBuilder {
    build(classifiedCommandTokens: ClassifiedCommandToken[]): CommandSignature | undefined {
        if (classifiedCommandTokens.length === 0) {
            return undefined;
        }

        const parts = classifiedCommandTokens.map<CommandSignaturePart>((classifiedCommandToken) => {
            if (classifiedCommandToken.kind === "stable") {
                return {
                    kind: "stable",
                    value: classifiedCommandToken.value,
                };
            }

            return {
                kind: "slot",
                slotIndex: 0,
            };
        });

        let variableSlotCounter = 0;
        for (const currentPart of parts) {
            if (currentPart.kind !== "slot") {
                continue;
            }
            currentPart.slotIndex = variableSlotCounter;
            variableSlotCounter += 1;
        }

        if (!parts.some((part) => part.kind === "slot")) {
            return undefined;
        }

        return {
            key: parts
                .map((part) => part.kind === "stable" ? `stable:${part.value.toLowerCase()}` : `slot:${part.slotIndex}`)
                .join("|"),
            parts,
        };
    }
}


