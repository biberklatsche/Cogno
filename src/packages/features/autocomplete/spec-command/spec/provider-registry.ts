import { BackendOsContract, ShellContextContract } from "@cogno/core-api";
import { ShellConstraint, SpecSuggestionProvider, SpecSuggestionProviderRegistration } from "./spec.types";

type RegisteredProvider = {
    readonly provider: SpecSuggestionProvider;
    readonly shells?: ReadonlySet<ShellConstraint>;
    readonly backendOs?: ReadonlySet<BackendOsContract>;
    readonly priority: number;
    readonly registrationIndex: number;
};

export class SpecProviderRegistry {
    private readonly registeredProvidersById = new Map<string, RegisteredProvider[]>();

    constructor(
        providers: ReadonlyArray<SpecSuggestionProvider | SpecSuggestionProviderRegistration>,
    ) {
        providers.forEach((providerOrRegistration, registrationIndex) => {
            const registration = this.normalizeRegistration(providerOrRegistration, registrationIndex);
            const existing = this.registeredProvidersById.get(registration.provider.id) ?? [];
            existing.push(registration);
            this.registeredProvidersById.set(registration.provider.id, existing);
        });
    }

    resolve(providerId: string, shellContext: ShellContextContract): SpecSuggestionProvider | undefined {
        const registrations = this.registeredProvidersById.get(providerId);
        if (!registrations?.length) return undefined;

        let bestMatch: RegisteredProvider | undefined;
        let bestScore = Number.NEGATIVE_INFINITY;

        for (const registration of registrations) {
            const score = this.matchScore(registration, shellContext);
            if (score < 0) continue;
            if (score > bestScore) {
                bestScore = score;
                bestMatch = registration;
            }
        }

        return bestMatch?.provider;
    }

    private normalizeRegistration(
        providerOrRegistration: SpecSuggestionProvider | SpecSuggestionProviderRegistration,
        registrationIndex: number,
    ): RegisteredProvider {
        if ("provider" in providerOrRegistration) {
            return {
                provider: providerOrRegistration.provider,
                shells: providerOrRegistration.shells?.length
                    ? new Set(providerOrRegistration.shells)
                    : undefined,
                backendOs: providerOrRegistration.backendOs?.length
                    ? new Set(providerOrRegistration.backendOs)
                    : undefined,
                priority: providerOrRegistration.priority ?? 0,
                registrationIndex,
            };
        }

        return {
            provider: providerOrRegistration,
            shells: undefined,
            backendOs: undefined,
            priority: 0,
            registrationIndex,
        };
    }

    private matchScore(registration: RegisteredProvider, shellContext: ShellContextContract): number {
        if (registration.shells && !registration.shells.has(shellContext.shellType)) return -1;
        if (registration.backendOs && !registration.backendOs.has(shellContext.backendOs)) return -1;

        const shellSpecificity = registration.shells ? 100 : 0;
        const backendOsSpecificity = registration.backendOs ? 10 : 0;
        const prioritySpecificity = registration.priority;
        const tiebreaker = 1 / ((registration.registrationIndex + 1) * 1_000);

        return shellSpecificity + backendOsSpecificity + prioritySpecificity + tiebreaker;
    }
}



