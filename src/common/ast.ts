import { INode } from "../lib/vimparser";

// properties that do not hold child nodes
const skipKeys: Record<string, boolean> = {
  attr: true,
  ea: true,
  pos: true,
};

export function isNode(value: any): value is INode {
  return !!value && typeof value === "object" && !Array.isArray(value) && typeof value.type === "number";
}

/*
 * All child nodes of a node, in source order where the parser keeps it.
 * Lists of nodes and pairs of nodes (dictionary entries) are flattened.
 */
export function getChildren(node: INode): INode[] {
  const res: INode[] = [];
  const add = (value: any) => {
    if (isNode(value)) {
      res.push(value);
    } else if (Array.isArray(value)) {
      value.forEach(add);
    }
  };
  Object.keys(node).forEach((key) => {
    if (!skipKeys[key]) {
      add((node as any)[key]);
    }
  });
  return res;
}

// command modifiers of a node, e.g. "vim9cmd" or "legacy"
export function hasModifier(node: INode, name: string): boolean {
  const modifiers: { name: string }[] = (node.ea && (node.ea as any).modifiers) || [];
  return modifiers.some((m) => m.name === name);
}
