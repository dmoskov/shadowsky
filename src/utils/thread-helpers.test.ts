import { describe, expect, it } from "vitest";
import type { ThreadNode } from "../contexts/ThreadContext";
import {
  countBranchPoints,
  countNodeDescendants,
  findMaxThreadDepth,
  flattenThreadTree,
} from "./thread-helpers";

function node(depth: number, children: ThreadNode[] = []): ThreadNode {
  return { post: {}, children, depth } as unknown as ThreadNode;
}

// root
// ├── a
// │   ├── a1
// │   └── a2
// └── b
//     └── b1
//         └── b1a
function buildTree(): ThreadNode {
  return node(0, [node(1, [node(2), node(2)]), node(1, [node(2, [node(3)])])]);
}

describe("countNodeDescendants", () => {
  it("counts all descendants recursively", () => {
    expect(countNodeDescendants(buildTree())).toBe(6);
  });
  it("is 0 for a leaf node", () => {
    expect(countNodeDescendants(node(0))).toBe(0);
  });
});

describe("findMaxThreadDepth", () => {
  it("returns the deepest node depth", () => {
    expect(findMaxThreadDepth([buildTree()])).toBe(3);
  });
  it("is 0 for a single root", () => {
    expect(findMaxThreadDepth([node(0)])).toBe(0);
  });
});

describe("countBranchPoints", () => {
  it("counts nodes with more than one child", () => {
    // root (2 children) and the first 'a' node (2 children) => 2
    expect(countBranchPoints([buildTree()])).toBe(2);
  });
  it("is 0 for a linear chain", () => {
    expect(countBranchPoints([node(0, [node(1, [node(2)])])])).toBe(0);
  });
});

describe("flattenThreadTree", () => {
  it("flattens depth-first and assigns sequential flatIndex", () => {
    const flat = flattenThreadTree([buildTree()]);
    expect(flat).toHaveLength(7);
    expect(flat.map((n) => n.flatIndex)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    // depth-first order: root(0) a(1) a1(2) a2(2) b(1) b1(2) b1a(3)
    expect(flat.map((n) => n.depth)).toEqual([0, 1, 2, 2, 1, 2, 3]);
  });
});
