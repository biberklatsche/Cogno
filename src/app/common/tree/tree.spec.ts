import {Tree} from './tree';


describe('Tree', () => {

  it('should return root', () => {
    const tree = new Tree<string, string>();
    expect(tree.root).toEqual({_key: null, _data: null, _children: null, _parent: null});
  });

  it('should return child', () => {
    const tree = new Tree<string, string>();
    tree.root.addChild(tree.createNode('test', 'testData'));
    expect(tree.getNode(['test'])).toEqual({_key: 'test', _data: 'testData', _children: null, _parent: tree.root});
  });

  it('should return child more complex', () => {
    const tree = new Tree<string, string>();
    const root = tree.root;
    const child = root.addChild(tree.createNode('test1', 'testData1'));
    child.addChild(tree.createNode('test3', 'testData3'));
    root.addChild(tree.createNode('test2', 'testData2'));
    expect(tree.getNode(['test1', 'test3'])).toEqual({_key: 'test3', _data: 'testData3', _children: null, _parent: child});
  });

  it('should return null if child does not exists', () => {
    const tree = new Tree<string, string>();
    const root = tree.root;
    root.addChild(tree.createNode('test1', 'testData1'));
    expect(tree.getNode(['test2'])).toBeNull();
  });

  it('should create missing nodes', () => {
    const tree = new Tree<string, string>();
    const expectedTree = new Tree<string, string>();
    const root = expectedTree.getNode();
    const child0 = root.addChild(tree.createNode('test0'));
    const child1 = child0.addChild(tree.createNode('test1'));
    const child2 = child1.addChild(tree.createNode('test2'));
    expect(tree.getNode(['test0', 'test1', 'test2'], {createMissing: true})).toEqual(child2);
  });

  it('should throw exception if child exists with same key', () => {
    const tree = new Tree<string, string>();
    tree.root.addChild(tree.createNode('test', 'testData'));
    expect(() => tree.root.addChild(tree.createNode('test', 'testData'))).toThrowError();
  });

  it('should return leaf if we search for leafs', () => {
    const tree = new Tree<string, string>();
    const root = tree.root;
    const child = root.addChild(tree.createNode('test1', 'testData1'));
    const leaf1 = child.addChild(tree.createNode('test3', 'testData3'));
    const leaf2 = root.addChild(tree.createNode('test2', 'testData2'));
    const leafs = tree.find(n => n.isLeaf);
    expect(leafs).toContain(leaf1);
    expect(leafs).toContain(leaf2);
  });

  it('should return null if no node exists', () => {
    const tree = new Tree<string, string>();
    const root = tree.root;
    const child = root.addChild(tree.createNode('test1', 'testData1'));
    const leaf1 = child.addChild(tree.createNode('test3', 'testData3'));
    const leaf2 = root.addChild(tree.createNode('test2', 'testData2'));
    const leaf = tree.first(n => false);
    expect(leaf).toBeNull();
  });

  it('should return node with correct data but searched from node', () => {
    const tree = new Tree<string, string>();
    const root = tree.root;
    const child = root.addChild(tree.createNode('test1', 'atestData1'));
    const leaf1 = child.addChild(tree.createNode('test3', 'atestData3'));
    const leaf2 = child.addChild(tree.createNode('test2', 'btestData2'));
    const leafs = child.find(n => n.data && n.data.startsWith('a'));
    expect(leafs).toContain(leaf1);
  });

  it('should return empty array if node does not exists', () => {
    const tree = new Tree<string, string>();
    const root = tree.root;
    const child = root.addChild(tree.createNode('test1', 'atestData1'));
    const leaf1 = child.addChild(tree.createNode('test3', 'atestData3'));
    const leaf2 = child.addChild(tree.createNode('test2', 'btestData2'));
    const leafs = child.find(n => n.data && n.data.startsWith('c'));
    expect(leafs).toEqual([]);
  });

  it('should return correct path', () => {
    const tree = new Tree<string, string>();
    const root = tree.root;
    const child = root.addChild(tree.createNode('test1', 'testData1'));
    const leaf1 = child.addChild(tree.createNode('test3', 'testData3'));
    const leaf2 = root.addChild(tree.createNode('test2', 'testData2'));
    expect(leaf2.path.map(n => n.key)).toEqual([leaf2.key]);
    expect(leaf1.path.map(n => n.key)).toEqual([child.key, leaf1.key]);
  });

  it('should return correct path until node', () => {
    const tree = new Tree<string, string>();
    const root = tree.root;
    const child = root.addChild(tree.createNode('test1', 'testData1'));
    const leaf1 = child.addChild(tree.createNode('test2', 'testData2'));
    const leaf2 = leaf1.addChild(tree.createNode('test3', 'testData3'));
    expect(leaf2.pathUntil(child).map(n => n.key)).toEqual([leaf1.key, leaf2.key]);
  });

  it('should return correct path to node - toNode ist in other path from root', () => {
    const tree = new Tree<string, string>();
    const root = tree.root;
    const child1 = root.addChild(tree.createNode('child1', 'testData1'));
    const child2 = root.addChild(tree.createNode('child2', 'testData4'));
    const child1_1 = child1.addChild(tree.createNode('child1_1', 'testData2'));
    const leaf1 = child1_1.addChild(tree.createNode('leaf1', 'testData3'));
    expect(leaf1.pathTo(child2, tree.createNode('..', '')).map(n => n.key)).toEqual([child2.key]);
  });

  it('should return correct path to node - toNode is in same path before', () => {
    const tree = new Tree<string, string>();
    const root = tree.root;
    const child1 = root.addChild(tree.createNode('test1', 'testData1'));
    const child2 = root.addChild(tree.createNode('toNode', 'testData4'));
    const leaf1 = child1.addChild(tree.createNode('test2', 'testData2'));
    const leaf2 = leaf1.addChild(tree.createNode('test3', 'testData3'));
    expect(leaf2.pathTo(leaf1, tree.createNode('..', '')).map(n => n.key)).toEqual(['..', '..', leaf1.key]);
  });

  it('should return correct path to node - toNode is in same path after', () => {
    const tree = new Tree<string, string>();
    const root = tree.root;
    const child1 = root.addChild(tree.createNode('test1', 'testData1'));
    const child2 = root.addChild(tree.createNode('toNode', 'testData4'));
    const leaf1 = child1.addChild(tree.createNode('test2', 'testData2'));
    const leaf2 = leaf1.addChild(tree.createNode('test3', 'testData3'));
    expect(child1.pathTo(leaf2, tree.createNode('..', '')).map(n => n.key)).toEqual([leaf1.key, leaf2.key]);
  });

  it('should return correct path to node - toNode is same node', () => {
    const tree = new Tree<string, string>();
    const root = tree.root;
    const child1 = root.addChild(tree.createNode('test1', 'testData1'));
    const child2 = root.addChild(tree.createNode('toNode', 'testData4'));
    const leaf1 = child1.addChild(tree.createNode('test2', 'testData2'));
    const leaf2 = leaf1.addChild(tree.createNode('test3', 'testData3'));
    expect(leaf2.pathTo(leaf2, tree.createNode('..', '')).map(n => n.key)).toEqual([]);
  });

  it('should return correct path to node - next child root', () => {
    const tree = new Tree<string, string>();
    const root = tree.root;
    const child = root.addChild(tree.createNode('test1', 'testData1'));
    const leaf1 = child.addChild(tree.createNode('test1', 'testData1'));
    const leaf2 = child.addChild(tree.createNode('test2', 'testData4'));
    expect(leaf1.pathTo(leaf2, tree.createNode('..', '')).map(n => n.key)).toEqual(['..', leaf2.key]);
  });

  it('should be root if it is root', () => {
    const tree = new Tree<string, string>();
    const root = tree.root;
    expect(root.isRoot).toBeTruthy();
    expect(root.isLeaf).toBeTruthy();
    expect(root.isBranch).toBeFalsy();
  });
});
