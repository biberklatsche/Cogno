export class AutocompletePathUtil {
  static shortenParentTraversalDisplay(path: string): string {
    if (path.startsWith("../../")) {
      return path.replace(/^(?:\.\.\/)+/, ".../");
    }
    return path;
  }

  static isParentTraversalOnly(path: string): boolean {
    return /^(\.\.\/)+$/.test(path);
  }
}
