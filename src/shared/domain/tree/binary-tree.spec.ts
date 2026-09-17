import { BinaryTree } from "@cogno/shared/domain";
import { describe, expect, it } from "vitest";

describe("BinaryTree", () => {
  it("should add left child on root", () => {
    const tree = new BinaryTree();
    tree.add(undefined, "l");
    /*
          r
        /  \
       l    l
   */
    expect(tree.root.left).toBeTruthy();
    expect(tree.root.right).toBeTruthy();
    expect(tree.root.key).toBe("");
  });

  it("should add right child on root", () => {
    const tree = new BinaryTree();
    tree.add(undefined, "r");
    /*
           r
         /  \
        l    l
    */
    expect(tree.root.left).toBeTruthy();
    expect(tree.root.right).toBeTruthy();
  });

  it("should add left child on left child", () => {
    const tree = new BinaryTree();
    tree.add(undefined, "l");
    tree.add("l", "l");
    /*
           r
         /  \
        b    l
       / \
       l l
    */
    expect(tree.root.left?.left).toBeTruthy();
    expect(tree.root.left?.right).toBeTruthy();
  });

  it("should add right child on left child", () => {
    const tree = new BinaryTree();
    tree.add(undefined, "l");
    tree.add("l", "r");
    /*
           r
         /  \
        b    l
       / \
       l l
    */
    expect(tree.root.left?.left).toBeTruthy();
    expect(tree.root.left?.right).toBeTruthy();
  });

  it("should add left child on right child", () => {
    const tree = new BinaryTree();
    tree.add(undefined, "l");
    tree.add("r", "l");
    /*
           r
         /  \
        l    b
            / \
            l l
    */
    expect(tree.root.right?.left).toBeTruthy();
    expect(tree.root.right?.right).toBeTruthy();
  });

  it("should add right child on right child", () => {
    const tree = new BinaryTree();
    tree.add(undefined, "l");
    tree.add("r", "r");
    /*
           r
         /  \
        l    b
            / \
            l l
    */
    expect(tree.root.right?.left).toBeTruthy();
    expect(tree.root.right?.right).toBeTruthy();
  });

  it("should remove nodes", () => {
    const tree = new BinaryTree();
    tree.add(undefined, "l");
    tree.add("r", "l");
    tree.add("l", "l");
    /*
           r
         /  \
        b    b
       / \  / \
       l l  l l
    */
    tree.remove("ll");
    /*
           r
         /  \
        l    b
            / \
            l l
    */
    expect(tree.root.left).toBeTruthy();
    expect(tree.root.left?.left).toBeFalsy();
    expect(tree.root.left?.right).toBeFalsy();
    expect(tree.root.right).toBeTruthy();
    expect(tree.root.right?.left).toBeTruthy();
    expect(tree.root.right?.right).toBeTruthy();
    tree.remove("rr");
    /*
           r
         /  \
        l    l
    */
    expect(tree.root.right).toBeTruthy();
    expect(tree.root.right?.left).toBeFalsy();
    expect(tree.root.right?.right).toBeFalsy();
    tree.remove("r");
    /*
           l
    */
    expect(tree.root.right).toBeFalsy();
    expect(tree.root.left).toBeFalsy();
  });

  it("should calc correct path", () => {
    const tree = new BinaryTree();
    tree.add(undefined, "l");
    tree.add("r", "l");
    tree.add("l", "l");
    /*
           r
         /  \
        b    b
       / \  / \
       l l  l l
    */
    expect(tree.root.key).toEqual("");
    expect(tree.root.left?.key).toEqual("l");
    expect(tree.root.right?.key).toEqual("r");
    expect(tree.root.left?.left?.key).toEqual("ll");
    expect(tree.root.left?.right?.key).toEqual("lr");
    expect(tree.root.right?.left?.key).toEqual("rl");
    expect(tree.root.right?.right?.key).toEqual("rr");
  });

  it("should return next leaf on root", () => {
    const tree = new BinaryTree();
    expect(tree.getNextLeaf("")?.key).toEqual("");
  });

  it("should return next leaf", () => {
    const tree = new BinaryTree();
    tree.add(undefined, "l");
    tree.add("r", "l");
    tree.add("l", "l");
    /*
           r
         /  \
        b    b
       / \  / \
       l l  l l
    */
    expect(tree.getNextLeaf("ll")?.key).toEqual("lr");
    expect(tree.getNextLeaf("lr")?.key).toEqual("rl");
    expect(tree.getNextLeaf("rl")?.key).toEqual("rr");
    expect(tree.getNextLeaf("rr")?.key).toEqual("ll");
  });

  it("should return previous leaf on root", () => {
    const tree = new BinaryTree();
    expect(tree.getPreviousLeaf("")?.key).toEqual("");
  });

  it("should return previous leaf", () => {
    const tree = new BinaryTree();
    tree.add(undefined, "l");
    tree.add("r", "l");
    tree.add("l", "l");
    /*
           r
         /  \
        b    b
       / \  / \
       l l  l l
    */
    expect(tree.getPreviousLeaf("ll")?.key).toEqual("rr");
    expect(tree.getPreviousLeaf("rr")?.key).toEqual("rl");
    expect(tree.getPreviousLeaf("rl")?.key).toEqual("lr");
    expect(tree.getPreviousLeaf("lr")?.key).toEqual("ll");
  });

  it("should find nodes", () => {
    const tree = new BinaryTree<string>();
    tree.root.data = "1";
    tree.add(undefined, "l", undefined, "2");
    tree.add("l", "r", undefined, "3");
    tree.add("r", "r", undefined, "4");
    /*
           r
         /  \
        r    l
       / \  / \
       2 3  1 4
    */
    const data = tree.find((n) => n.data === "2" || n.data === "1");
    expect(data.map((d) => d.data)).toEqual(["2", "1"]);
  });

  it("should find nodes in flat tree", () => {
    const tree = new BinaryTree<string>();
    tree.root.data = "1";
    const data = tree.find((n) => n.data === "1");
    expect(data.map((d) => d.data)).toEqual(["1"]);
  });

  it("should find first", () => {
    const tree = new BinaryTree<string>();
    tree.root.data = "1";
    tree.add(undefined, "l", undefined, "2");
    tree.add("l", "r", undefined, "3");
    tree.add("r", "r", undefined, "4");
    /*
           r
         /  \
        r    l
       / \  / \
       2 3  1 4
    */
    const data = tree.first((n) => n.data === "1");
    expect(data?.data).toEqual("1");
  });

  it("should find nodes in flat tree", () => {
    const tree = new BinaryTree<string>();
    tree.root.data = "1";
    const data = tree.first((n) => n.data === "1");
    expect(data?.data).toEqual("1");
  });
});
