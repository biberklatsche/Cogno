export class Tree<Key, Data> {
  private _root: Node<Key, Data>;

  constructor() {
    this._root = new Node(null, null);
  }

  getNode(keyPath: Key[] = [], options: { createMissing?: boolean, defaultData?: Data } = {createMissing: false}): Node<Key, Data> {
    return this.getNodeRecursive(keyPath.filter(k => k !== null), this._root, options);
  }

  private getNodeRecursive(keyPath: Key[], node: Node<Key, Data>, options: { createMissing?: boolean, defaultData?: Data }): Node<Key, Data> {
    if (keyPath.length === 0 || !node) {
      if (options.createMissing && !node.data) {
        node.data = options.defaultData ? {...options.defaultData} : null;
      }
      return node;
    }
    const currentKey = keyPath.splice(0, 1)[0];
    let child = node.getChild(currentKey);
    if (options.createMissing && child === null) {
      const data = options.defaultData ? {...options.defaultData} : null;
      child = node.addChild(this.createNode(currentKey, data));
    }
    return this.getNodeRecursive(keyPath, child, options);
  }

  createNode(key: Key, data: Data = null): Node<Key, Data> {
    return new Node(key, data);
  }

  get root(): Node<Key, Data> {
    return this.getNode();
  }

  find(find: (node: Node<Key, Data>) => boolean = null): Node<Key, Data> [] {
    return this._root.find(find);
  }

  first(find: (node: Node<Key, Data>) => boolean = null): Node<Key, Data> {
    return this._root.first(find);
  }
}

export class Node<Key, Data> {
  private _children: Node<Key, Data>[] = null;
  private _parent: Node<Key, Data> = null;

  constructor(private _key: Key, private _data: Data) {
  }

  get isRoot(): boolean {
    return !this._parent;
  }

  get root(): Node<Key, Data> {
    return this.rootRecursive(this);
  }

  private rootRecursive(node: Node<Key, Data>): Node<Key, Data> {
    if (node.isRoot) {
      return node;
    }
    return this.rootRecursive(node._parent);
  }

  get isLeaf(): boolean {
    return !this._children || this._children.length === 0;
  }

  get isBranch(): boolean {
    return !this.isRoot && !this.isLeaf;
  }

  get hasData() {
    return !this._data;
  }

  get data() {
    return this._data;
  }

  set data(data: Data) {
    this._data = data;
  }

  get key() {
    return this._key;
  }

  hasChild(key: Key) {
    return this.getChild(key) !== null;
  }

  get path(): Node<Key, Data>[] {
    const result = [];
    this.pathUntilRecursive(this, null, result);
    return result;
  }

  pathUntil(untilNode: Node<Key, Data>): Node<Key, Data>[] {
    const result = [];
    this.pathUntilRecursive(this, untilNode, result);
    return result;
  }

  pathTo(toNode: Node<Key, Data>, navigationNode: Node<Key, Data>): Node<Key, Data>[] {
    if (toNode === this) {
      return [];
    }
    const currentNodePath = this.path;
    const toNodePath = toNode.path;
    let pathIndex = 0;
    let commonRoot = this.root;
    while (toNodePath.length > pathIndex && currentNodePath.length > pathIndex) {
      const nodeTo = toNodePath[pathIndex];
      const currentNode = currentNodePath[pathIndex];
      pathIndex++;
      if (nodeTo === currentNode) {
        commonRoot = currentNode;
      }
    }
    const p1 = this.pathUntil(commonRoot).map(n => new Node<Key, Data>(navigationNode._key, navigationNode._data));
    const p2 = toNode.pathUntil(commonRoot);
    if(commonRoot.isRoot){
      return p2;
    } else if (p2.length === 0) {
      return [...p1, navigationNode, toNode];
    } else {
      return [...p1, ...p2];
    }
  }

  private pathUntilRecursive(node: Node<Key, Data>, toNode: Node<Key, Data>, result: Node<Key, Data>[]) {
    if (!node.isRoot && node !== toNode) {
      this.pathUntilRecursive(node.parent, toNode, result);
      result.push(node);
    }
  }

  get children(): Node<Key, Data>[] {
    return this._children;
  }

  get parent(): Node<Key, Data> {
    return this._parent;
  }

  addChild(node: Node<Key, Data>): Node<Key, Data> {
    if (this._children === null) {
      this._children = [];
    }
    if (this.children.find(c => c._key === node._key)) {
      throw new Error(`Child with key '${node._key}' exists in node with key '${this._key}'.`);
    }
    node._parent = this;
    this.children.push(node);
    return node;
  }

  getChild(key: Key): Node<Key, Data> {
    if (this.isLeaf) {
      return null;
    }
    return this.children.find(c => c._key === key) ?? null;
  }

  find(find: (node: Node<Key, Data>) => boolean = null): Node<Key, Data> [] {
    if (find === null) {
      find = () => true;
    }
    const results = [];
    if (!this.isLeaf) {
      this.children.forEach(child => this.findRecursive(child, find, results));
    }
    return results;
  }

  first(find: (node: Node<Key, Data>) => boolean = null): Node<Key, Data> {
    if (find === null) {
      find = () => true;
    }
    return this.firstRecursive(this, find);
  }

  private findRecursive(currentNode: Node<Key, Data>, find: (node: Node<Key, Data>) => boolean, results: Node<Key, Data>[]) {
    if (find(currentNode)) {
      results.push(currentNode);
    }
    if (!currentNode.isLeaf) {
      currentNode.children.forEach(c => this.findRecursive(c, find, results));
    }
  }

  private firstRecursive(currentNode: Node<Key, Data>, find: (node: Node<Key, Data>) => boolean): Node<Key, Data> {
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
    return null;
  }
}
