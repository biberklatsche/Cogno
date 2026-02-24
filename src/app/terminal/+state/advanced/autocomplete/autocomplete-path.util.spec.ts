import { describe, expect, it } from "vitest";

import { AutocompletePathUtil } from "./autocomplete-path.util";

describe("AutocompletePathUtil", () => {
    it("shortens leading parent traversals when there is more than one", () => {
        expect(AutocompletePathUtil.shortenParentTraversalDisplay("../../foo/bar")).toBe(".../foo/bar");
        expect(AutocompletePathUtil.shortenParentTraversalDisplay("../../../foo")).toBe(".../foo");
    });

    it("keeps single parent traversal unchanged", () => {
        expect(AutocompletePathUtil.shortenParentTraversalDisplay("../foo")).toBe("../foo");
    });
});
