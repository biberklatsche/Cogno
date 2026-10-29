/**
 * A feature's settings block, read from the parsed config by the feature's
 * dotted `configPath` ("feature.git"); undefined when nothing is set there.
 */
export function readFeatureConfig(
  config: Readonly<Record<string, unknown>> | undefined,
  configPath: string,
): Readonly<Record<string, unknown>> | undefined {
  const value = configPath.split(".").reduce<unknown>((current, segment) => {
    if (typeof current !== "object" || current === null) return undefined;
    return (current as Record<string, unknown>)[segment];
  }, config);
  return typeof value === "object" && value !== null
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;
}
