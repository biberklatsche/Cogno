export class BinaryTree<Data> {
  public static ROOT_KEY = "";

  constructor(data: Data | BinaryNode<Data> | undefined = undefined) {
    if (data instanceof BinaryNode) {
      this._root = data as BinaryNode<Data>;
    } else {
      this._root = new BinaryNode<Data>(data);
    }
  }

  private _root: BinaryNode<Data>;

  private static getNode<Data>(
    node: BinaryNode<Data>,
    key: string | undefined,
  ): BinaryNode<Data> | undefined {
    if (!key || !node) {
      return node;
    }
    const nextChar = key.charAt(0);
    if (nextChar === "l") {
      return node.left ? BinaryTree.getNode(node.left, key.substring(1, key.length)) : undefined;
    }
    return node.right ? BinaryTree.getNode(node.right, key.substring(1, key.length)) : undefined;
  }

  get length(): number {
    return this._root.countLeafs();
  }

  static isRoot(key: string) {
    return key === BinaryTree.ROOT_KEY;
  }

  get root(): BinaryNode<Data> {
    return this._root;
  }

  add(
    leafKey: string | undefined,
    position: "l" | "r",
    dataParent: Data | undefined = undefined,
    dataChild: Data | undefined = undefined,
  ) {
    const node = BinaryTree.getNode(this._root, leafKey);
    if (!node) return;
    const newNode = new BinaryNode<Data>(dataChild);
    const newParent = node.add(newNode, position);
    newParent.data = dataParent;
    if (node === this._root) {
      this._root = newParent;
    }
    return newNode.key;
  }

  remove(key: string): BinaryNode<Data> | undefined {
    const node = BinaryTree.getNode(this._root, key);
    if (!node) return;
    const newChild = node.remove();
    if (newChild?.isRoot) {
      this._root = newChild;
    }
    return newChild;
  }

  find(find: (node: BinaryNode<Data>) => boolean): BinaryNode<Data>[] {
    return this._root.find(find);
  }

  first(find: (node: BinaryNode<Data>) => boolean): BinaryNode<Data> | undefined {
    return this._root.first(find);
  }

  getData(key: string): Data | undefined {
    const node = BinaryTree.getNode(this._root, key);
    return node ? node.data : undefined;
  }

  getDataOfLeafs(): Data[] {
    return this._root.getDataOfLeafs();
  }

  setData(key: string, data: Data) {
    const node = BinaryTree.getNode(this._root, key);
    if (!node) throw new Error("Node does not exist");
    node.data = data;
  }

  getNextLeaf(key: string): BinaryNode<Data> | undefined {
    return this.getNextLeafInternal(key, 1);
  }

  getPreviousLeaf(key: string): BinaryNode<Data> | undefined {
    return this.getNextLeafInternal(key, -1);
  }

  flatten(merge: (d1: Data | undefined, d2: Data | undefined) => Data | undefined) {
    this._root.flatten(merge);
  }

  private getNextLeafInternal(key: string, counter: 1 | -1): BinaryNode<Data> | undefined {
    const bits = key.replace(/l/g, "0").replace(/r/g, "1");
    let number = Number.parseInt(bits, 2);
    number += counter;
    if (number < 0) {
      number = Number.MAX_SAFE_INTEGER;
    }
    let bitsResult = number.toString(2);
    if (bitsResult.length > key.length) {
      bitsResult = bitsResult.substring(bitsResult.length - key.length, bitsResult.length);
    }
    while (bitsResult.length < key.length) {
      bitsResult = `0${bitsResult}`;
    }
    const possibleKey = bitsResult.replace(/0/g, "l").replace(/1/g, "r");
    let node = BinaryTree.getNode(this._root, possibleKey);
    while (node === undefined) {
      node = BinaryTree.getNode(this._root, possibleKey.substring(0, possibleKey.length - 1));
    }
    while (!node?.isLeaf) {
      node = counter === 1 ? node?.left : node?.right;
    }
    return node;
  }

  stringify(ignore: string[] = []): string {
    return JSON.stringify(this, (key, value) => {
      if (key === "_parent" || value === null || ignore.indexOf(key) !== -1) {
        return;
      }
      return value;
    });
  }
}

export class BinaryNode<Data> {
  private _left: BinaryNode<Data> | undefined = undefined;
  private _right: BinaryNode<Data> | undefined = undefined;
  private _parent: BinaryNode<Data> | undefined = undefined;

  constructor(private _data: Data | undefined = undefined) {}

  get isLeaf(): boolean {
    return !this._left && !this._right;
  }

  get isRoot(): boolean {
    return !this._parent;
  }

  get data(): Data | undefined {
    return this._data;
  }

  set data(data: Data | undefined) {
    this._data = data;
  }

  get left(): BinaryNode<Data> | undefined {
    return this._left;
  }

  get right(): BinaryNode<Data> | undefined {
    return this._right;
  }

  get parent(): BinaryNode<Data> | undefined {
    return this._parent;
  }

  get children(): BinaryNode<Data>[] {
    if (this.isLeaf) return [];
    if (!this._left || !this._right) {
      throw new Error("Branch node must have both children.");
    }
    return [this._left, this._right];
  }

  get key(): string {
    return BinaryNode.createKey(this);
  }

  private static createKey<Data>(node: BinaryNode<Data> | undefined): string {
    if (!node || node.isRoot) {
      return "";
    }
    const current = node._parent?._left === node ? "l" : "r";
    return BinaryNode.createKey(node._parent) + current;
  }

  add(node: BinaryNode<Data>, position: "l" | "r"): BinaryNode<Data> {
    if (!this.isLeaf) {
      throw new Error("Add a node on a branch is not allowed.");
    }
    const newParent = new BinaryNode<Data>();
    if (this._parent !== undefined) {
      if (this._parent._left === this) {
        this._parent._left = newParent;
      } else {
        this._parent._right = newParent;
      }
    }
    newParent._parent = this._parent;
    this._parent = newParent;
    node._parent = newParent;
    switch (position) {
      case "l":
        newParent._left = node;
        newParent._right = this;
        break;
      case "r":
        newParent._left = this;
        newParent._right = node;
        break;
    }
    return newParent;
  }

  addToNode(node: BinaryNode<Data>, position: "l" | "r"): void {
    node._parent = this;
    switch (position) {
      case "l":
        this._left = node;
        break;
      case "r":
        this._right = node;
        break;
    }
  }

  remove(): BinaryNode<Data> | undefined {
    if (this._parent === undefined) {
      throw new Error("Could not remove root");
    }
    const otherChild = this._parent._left === this ? this._parent._right : this._parent._left;
    if (!otherChild) {
      throw new Error("Parent node has no sibling child.");
    }
    otherChild._parent = this._parent._parent;
    if (this._parent._parent !== undefined) {
      if (this._parent._parent._left === this._parent) {
        this._parent._parent._left = otherChild;
      } else {
        this._parent._parent._right = otherChild;
      }
    }
    this._parent = undefined;
    return otherChild;
  }

  find(find: (node: BinaryNode<Data>) => boolean): BinaryNode<Data>[] {
    if (find === null) {
      find = () => true;
    }
    const results: BinaryNode<Data>[] = [];
    if (this.isRoot && this.isLeaf && find(this)) {
      return [this];
    }
    if (!this.isLeaf) {
      this.children.forEach((child) => {
        this.findRecursive(child, find, results);
      });
    }
    return results;
  }

  first(find: (node: BinaryNode<Data>) => boolean): BinaryNode<Data> | undefined {
    if (find === null) {
      find = () => true;
    }
    return this.firstRecursive(this, find);
  }

  private findRecursive(
    currentNode: BinaryNode<Data>,
    find: (node: BinaryNode<Data>) => boolean,
    results: BinaryNode<Data>[],
  ) {
    if (find(currentNode)) {
      results.push(currentNode);
    }
    if (!currentNode.isLeaf) {
      currentNode.children.forEach((c) => {
        this.findRecursive(c, find, results);
      });
    }
  }

  private firstRecursive(
    currentNode: BinaryNode<Data>,
    find: (node: BinaryNode<Data>) => boolean,
  ): BinaryNode<Data> | undefined {
    if (find(currentNode)) {
      return currentNode;
    }
    if (!currentNode.isLeaf) {
      for (const child of currentNode.children) {
        const result = this.firstRecursive(child, find);
        if (!result) {
          continue;
        }
        return result;
      }
    }
    return undefined;
  }

  public countLeafs(): number {
    const result = { count: 0 };
    this.countLeafsRecursive(this, result);
    return result.count;
  }

  private countLeafsRecursive(
    currentNode: BinaryNode<Data> | undefined,
    result: { count: number },
  ) {
    if (currentNode?.isLeaf) {
      result.count++;
      return;
    } else {
      this.countLeafsRecursive(currentNode?._left, result);
      this.countLeafsRecursive(currentNode?._right, result);
      return;
    }
  }

  toggle() {
    if (!this._left || !this._right) {
      return;
    }
    const left = this._left;
    this._left = this._right;
    this._right = left;
  }

  flatten(merge: (d1: Data | undefined, d2: Data | undefined) => Data | undefined) {
    this.flattenRecursive(this, merge);
  }

  private flattenRecursive(
    node: BinaryNode<Data> | undefined,
    merge: (d1: Data | undefined, d2: Data | undefined) => Data | undefined,
  ) {
    if (node?._left !== undefined) {
      this.flattenRecursive(node._left, merge);
    }
    if (node?._right !== undefined) {
      this.flattenRecursive(node._right, merge);
    }
    if (node?.isLeaf && node.parent !== undefined && node.parent._right?.isLeaf) {
      node.parent._data = merge(node.parent._left?.data, node.parent._right?.data);
      node.parent._right = undefined;
      node.parent._left = undefined;
      return;
    }
  }

  getDataOfLeafs(): Data[] {
    return this.getDataOfLeafsRecursive(this);
  }

  private getDataOfLeafsRecursive(node: BinaryNode<Data>): Data[] {
    const data: Data[] = [];
    if (node._left !== undefined) {
      data.push(...this.getDataOfLeafsRecursive(node._left));
    }
    if (node._right !== undefined) {
      data.push(...this.getDataOfLeafsRecursive(node._right));
    }
    if (node.isLeaf && node.data !== undefined) {
      data.push(node.data);
    }
    return data;
  }
}
