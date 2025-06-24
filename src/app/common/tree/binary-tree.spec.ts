import {BinaryTree} from './binary-tree';

describe('BinaryTree', () => {

  it('should add left child on root', () => {
    const tree = new BinaryTree();
    tree.add(null, 'l');
    /*
          r
        /  \
       l    l
   */
    expect(tree.root.left).toBeTruthy();
    expect(tree.root.right).toBeTruthy();
    expect(tree.root.key).toBe(BinaryTree.ROOT_KEY);
  });

  it('should add right child on root', () => {
    const tree = new BinaryTree();
    tree.add(null, 'r');
    /*
           r
         /  \
        l    l
    */
    expect(tree.root.left).toBeTruthy();
    expect(tree.root.right).toBeTruthy();
  });

  it('should add left child on left child', () => {
    const tree = new BinaryTree();
    tree.add(null, 'l');
    tree.add('l', 'l');
    /*
           r
         /  \
        b    l
       / \
       l l
    */
    expect(tree.root.left.left).toBeTruthy();
    expect(tree.root.left.right).toBeTruthy();
  });

  it('should add right child on left child', () => {
    const tree = new BinaryTree();
    tree.add(null, 'l');
    tree.add('l', 'r');
    /*
           r
         /  \
        b    l
       / \
       l l
    */
    expect(tree.root.left.left).toBeTruthy();
    expect(tree.root.left.right).toBeTruthy();
  });

  it('should add left child on right child', () => {
    const tree = new BinaryTree();
    tree.add(null, 'l');
    tree.add('r', 'l');
    /*
           r
         /  \
        l    b
            / \
            l l
    */
    expect(tree.root.right.left).toBeTruthy();
    expect(tree.root.right.right).toBeTruthy();
  });

  it('should add right child on right child', () => {
    const tree = new BinaryTree();
    tree.add(null, 'l');
    tree.add('r', 'r');
    /*
           r
         /  \
        l    b
            / \
            l l
    */
    expect(tree.root.right.left).toBeTruthy();
    expect(tree.root.right.right).toBeTruthy();
  });

  it('should remove nodes', () => {
    const tree = new BinaryTree();
    tree.add(null, 'l');
    tree.add('r', 'l');
    tree.add('l', 'l');
    /*
           r
         /  \
        b    b
       / \  / \
       l l  l l
    */
    tree.remove('ll');
    /*
           r
         /  \
        l    b
            / \
            l l
    */
    expect(tree.root.left).toBeTruthy();
    expect(tree.root.left.left).toBeFalsy();
    expect(tree.root.left.right).toBeFalsy();
    expect(tree.root.right).toBeTruthy();
    expect(tree.root.right.left).toBeTruthy();
    expect(tree.root.right.right).toBeTruthy();
    tree.remove('rr');
    /*
           r
         /  \
        l    l
    */
    expect(tree.root.right).toBeTruthy();
    expect(tree.root.right.left).toBeFalsy();
    expect(tree.root.right.right).toBeFalsy();
    tree.remove('r');
    /*
           l
    */
    expect(tree.root.right).toBeFalsy();
    expect(tree.root.left).toBeFalsy();
  });

  it('should calc correct path', () => {
    const tree = new BinaryTree();
    tree.add(null, 'l');
    tree.add('r', 'l');
    tree.add('l', 'l');
    /*
           r
         /  \
        b    b
       / \  / \
       l l  l l
    */
    expect(tree.root.key).toEqual('');
    expect(tree.root.left.key).toEqual('l');
    expect(tree.root.right.key).toEqual('r');
    expect(tree.root.left.left.key).toEqual('ll');
    expect(tree.root.left.right.key).toEqual('lr');
    expect(tree.root.right.left.key).toEqual('rl');
    expect(tree.root.right.right.key).toEqual('rr');
  });

  it('should return next leaf on root', () => {
    const tree = new BinaryTree();
    expect(tree.getNextLeaf('').key).toEqual('');
  });

  it('should return next leaf', () => {
    const tree = new BinaryTree();
    tree.add(null, 'l');
    tree.add('r', 'l');
    tree.add('l', 'l');
    /*
           r
         /  \
        b    b
       / \  / \
       l l  l l
    */
    expect(tree.getNextLeaf('ll').key).toEqual('lr');
    expect(tree.getNextLeaf('lr').key).toEqual('rl');
    expect(tree.getNextLeaf('rl').key).toEqual('rr');
    expect(tree.getNextLeaf('rr').key).toEqual('ll');
  });

  it('should return previous leaf on root', () => {
    const tree = new BinaryTree();
    expect(tree.getPreviousLeaf('').key).toEqual('');
  });

  it('should return previous leaf', () => {
    const tree = new BinaryTree();
    tree.add(null, 'l');
    tree.add('r', 'l');
    tree.add('l', 'l');
    /*
           r
         /  \
        b    b
       / \  / \
       l l  l l
    */
    expect(tree.getPreviousLeaf('ll').key).toEqual('rr');
    expect(tree.getPreviousLeaf('rr').key).toEqual('rl');
    expect(tree.getPreviousLeaf('rl').key).toEqual('lr');
    expect(tree.getPreviousLeaf('lr').key).toEqual('ll');
  });

  it('should count leafs on empty tree', () => {
    const tree = new BinaryTree();
    expect(tree.length).toBe(1);
  });

  it('should count leafs on non empty tree', () => {
    let tree = new BinaryTree();
    tree.add(null, 'l');
    tree.add('r', 'l');
    tree.add('l', 'l');
    /*
           r
         /  \
        b    b
       / \  / \
       l l  l l
    */
    expect(tree.length).toBe(4);

    tree = new BinaryTree();
    tree.add(null, 'l');
    tree.add('r', 'r');
    /*
           r
         /  \
        l    b
            / \
            l l
    */
    expect(tree.length).toBe(3);

    tree = new BinaryTree();
    tree.add(null, 'l');
    tree.add('l', 'r');
    /*
           r
         /  \
        b    l
       / \
       l l
    */
    expect(tree.length).toBe(3);
  });

  it('should toggle', () => {
    const tree = new BinaryTree();
    tree.add(null, 'l', null, 'test');
    /*
           r
         /  \
        l    l
    */
    expect(tree.getData('l')).toEqual('test');
    expect(tree.getData('r')).toEqual(null);
    tree.root.toggle();
    expect(tree.getData('r')).toEqual('test');
    expect(tree.getData('l')).toEqual(null);
  });

  it('should unsplit simple', () => {
    const tree = new BinaryTree<string>();
    tree.root.data = 'test2';
    tree.add(null, 'l', null, 'test1');
    /*
           r
         /  \
        l    l
    */
    expect(tree.getData('l')).toEqual('test1');
    expect(tree.getData('r')).toEqual('test2');
    tree.flatten((d1, d2) => d1 + d2);
    expect(tree.root.isLeaf).toEqual(true);
    expect(tree.root.data).toEqual('test1test2');
  });

  it('should unsplit left branch', () => {
    const tree = new BinaryTree<string>();
    tree.root.data = '1';
    tree.add(null, 'l', null, '2');
    tree.add('l', 'r', null, '3');
    /*
           r
         /  \
        b    1
       / \
       2 3
    */
    tree.flatten((d1, d2) => d1 + d2);
    expect(tree.root.isLeaf).toEqual(true);
    expect(tree.root.data).toEqual('231');
  });

  it('should unsplit right branch', () => {
    const tree = new BinaryTree<string>();
    tree.root.data = '1';
    tree.add(null, 'l', null, '2');
    tree.add('r', 'r', null, '3');
    /*
           r
         /  \
        2    l
            / \
            1 3
    */
    tree.flatten((d1, d2) => d1 + d2);
    expect(tree.root.isLeaf).toEqual(true);
    expect(tree.root.data).toEqual('213');
  });

  it('should unsplit big tree', () => {
    const tree = new BinaryTree<string>();
    tree.root.data = '1';
    tree.add(null, 'l', null, '2');
    tree.add('l', 'r', null, '3');
    tree.add('r', 'r', null, '4');
    /*
           r
         /  \
        r    l
       / \  / \
       2 3  1 4
    */
    tree.flatten((d1, d2) => d1 + d2);
    expect(tree.root.isLeaf).toEqual(true);
    expect(tree.root.data).toEqual('2314');
  });

  it('should stringify tree', () => {
    const tree = new BinaryTree<{value: string; key: string}>();
    tree.root.data = {value: '1', key: '1'};
    tree.add(null, 'l', null, {value: '2', key: '2'});
    tree.add('l', 'r', null, {value: '3', key: '3'});
    tree.add('r', 'r', null, {value: '4', key: '4'});
    /*
           r
         /  \
        r   l
       / \  / \
       2 3  1 4
    */
    const s = tree.stringify(['key']);
    expect(s).toEqual('{"_root":{"_left":{"_left":{"_data":{"value":"2"}},"_right":{"_data":{"value":"3"}}},"_right":{"_left":{"_data":{"value":"1"}},"_right":{"_data":{"value":"4"}}}}}');
  });

  it('should return data of leafs', () => {
    const tree = new BinaryTree<string>();
    tree.root.data = '1';
    tree.add(null, 'l', null, '2');
    tree.add('l', 'r', null, '3');
    tree.add('r', 'r', null, '4');
    /*
           r
         /  \
        r    l
       / \  / \
       2 3  1 4
    */
    const data = tree.getDataOfLeafs();
    expect(data).toEqual(['2', '3', '1', '4']);
  });

  it('should find nodes', () => {
    const tree = new BinaryTree<string>();
    tree.root.data = '1';
    tree.add(null, 'l', null, '2');
    tree.add('l', 'r', null, '3');
    tree.add('r', 'r', null, '4');
    /*
           r
         /  \
        r    l
       / \  / \
       2 3  1 4
    */
    const data = tree.find((n) => n.data === '2' || n.data === '1');
    expect(data.map(d => d.data)).toEqual(['2', '1']);
  });

  it('should find nodes in flat tree', () => {
    const tree = new BinaryTree<string>();
    tree.root.data = '1';
    const data = tree.find((n) => n.data === '1');
    expect(data.map(d => d.data)).toEqual(['1']);
  });

  it('should find first', () => {
    const tree = new BinaryTree<string>();
    tree.root.data = '1';
    tree.add(null, 'l', null, '2');
    tree.add('l', 'r', null, '3');
    tree.add('r', 'r', null, '4');
    /*
           r
         /  \
        r    l
       / \  / \
       2 3  1 4
    */
    const data = tree.first((n) => n.data === '1');
    expect(data.data).toEqual('1');
  });

  it('should find nodes in flat tree', () => {
    const tree = new BinaryTree<string>();
    tree.root.data = '1';
    const data = tree.first((n) => n.data === '1');
    expect(data.data).toEqual('1');
  });
});
