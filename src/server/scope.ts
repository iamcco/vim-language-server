import fs from "fs";
import path from "path";
import { Location, Position, Range } from "vscode-languageserver";
import { URI } from "vscode-uri";

import { getChildren, hasModifier } from "../common/ast";
import { INode, IPos } from "../lib/vimparser";

const NODE_TOPLEVEL = 1;
const NODE_FUNCTION = 4;
const NODE_LET = 9;
const NODE_IF = 13;
const NODE_ELSEIF = 14;
const NODE_ELSE = 15;
const NODE_WHILE = 17;
const NODE_FOR = 19;
const NODE_TRY = 23;
const NODE_CATCH = 24;
const NODE_FINALLY = 25;
const NODE_CALL = 78;
const NODE_DOT = 79;
const NODE_STRING = 81;
const NODE_IDENTIFIER = 86;
const NODE_LAMBDA = 92;
const NODE_CONST = 94;
const NODE_DEF = 101;
const NODE_VAR = 103;
const NODE_FINAL = 104;
const NODE_EXPORT = 105;
const NODE_IMPORT = 106;
const NODE_VIM9SCRIPT = 107;
const NODE_BLOCK = 111;
const NODE_CLASS = 113;
const NODE_INTERFACE = 115;
const NODE_ENUM = 117;
const NODE_ENUMVALUE = 119;
const NODE_TYPE = 120;

// nodes with a body that is a block scope in Vim9 script
const blockNodes: Record<number, boolean> = {
  [NODE_IF]: true,
  [NODE_ELSEIF]: true,
  [NODE_ELSE]: true,
  [NODE_WHILE]: true,
  [NODE_FOR]: true,
  [NODE_TRY]: true,
  [NODE_CATCH]: true,
  [NODE_FINALLY]: true,
  [NODE_BLOCK]: true,
};

const classNodes: Record<number, boolean> = {
  [NODE_CLASS]: true,
  [NODE_INTERFACE]: true,
  [NODE_ENUM]: true,
};

export interface IScope {
  kind: "script" | "function" | "block" | "class";
  node: INode;
  parent?: IScope;
  decls: IDecl[];
}

export interface IDecl {
  name: string;
  kind: "variable" | "function" | "class" | "type" | "import" | "member" | "method" | "enumvalue" | "argument";
  pos: IPos;
  node: INode;
  scope: IScope;
  exported: boolean;
  // scope of the members of a class
  members?: IScope;
  // type of a variable or argument
  type?: string;
  // the command that declares a variable, e.g. NODE_VAR
  statement?: number;
  // declared in Vim9 script
  vim9?: boolean;
}

// a name used in the script
export interface IOccurrence {
  node: INode;
  parent?: INode;
  scope: IScope;
  vim9: boolean;
}

export interface IScopeIndex {
  script: IScope;
  occurrences: IOccurrence[];
}

const isBefore = (a: IPos, b: IPos) => a.lnum < b.lnum || (a.lnum === b.lnum && a.col < b.col);

// position of the argument of a command, e.g. the name after :class
function argPos(node: INode): IPos {
  return (node.ea && node.ea.argpos && node.ea.argpos.lnum) ? node.ea.argpos : node.pos;
}

// name of an import without "as": the file name without ".vim"
export function getImportName(node: INode): string {
  if (node.alias) {
    return node.alias;
  }
  const file = typeof (node.left && node.left.value) === "string" ? node.left.value.replace(/^['"]|['"]$/g, "") : "";
  return path.basename(file).replace(/\.vim$/, "");
}

/*
 * Index the declarations of a script by scope, and the names used in it.
 */
export function buildScopeIndex(root: INode): IScopeIndex {
  const script: IScope = { kind: "script", node: root, decls: [] };
  const occurrences: IOccurrence[] = [];
  const vim9script = (root.body || []).some((n) => n.type === NODE_VIM9SCRIPT);

  const declare = (scope: IScope, decl: Partial<IDecl> & { name: string, kind: IDecl["kind"], node: INode }) => {
    if (!decl.name || !(decl.pos || decl.node.pos)) {
      return;
    }
    const res = { pos: decl.node.pos, exported: false, scope, ...decl } as IDecl;
    scope.decls.push(res);
    return res;
  };

  const declareNames = (scope: IScope, nodes: INode[], kind: IDecl["kind"], exported: boolean,
                        statement?: number, vim9?: boolean) => {
    nodes.forEach((n) => {
      if (n && n.type === NODE_IDENTIFIER && n.value) {
        declare(scope, {
          name: `${n.value}`.replace(/^\.\.\./, ""),
          kind: scope.kind === "class" ? "member" : kind,
          node: n,
          exported,
          type: n.type_str || undefined,
          statement,
          vim9,
        });
      }
    });
  };

  const walk = (node: INode, scope: IScope, vim9: boolean, parent: INode | undefined, exported: boolean) => {
    if (!node || typeof node.type !== "number") {
      return;
    }
    if (hasModifier(node, "vim9cmd")) {
      vim9 = true;
    } else if (hasModifier(node, "legacy")) {
      vim9 = false;
    }
    const walkAll = (nodes: any, s: IScope, v: boolean = vim9) => {
      [].concat(nodes || []).forEach((n: INode) => walk(n, s, v, node, false));
    };

    switch (node.type) {
      case NODE_TOPLEVEL:
        node.body.forEach((n) => {
          if (n.type === NODE_VIM9SCRIPT) {
            vim9 = true;
          }
          walk(n, scope, vim9, node, false);
        });
        return;
      case NODE_FUNCTION:
      case NODE_DEF: {
        const left = node.left;
        if (left && left.type === NODE_IDENTIFIER) {
          declare(scope, {
            name: left.value,
            kind: scope.kind === "class" ? "method" : "function",
            node: left,
            exported,
          });
          walk(left, scope, vim9, node, false);
        } else {
          walkAll(left, scope);
        }
        const fscope: IScope = { kind: "function", node, parent: scope, decls: [] };
        const isVim9 = node.type === NODE_DEF;
        declareNames(fscope, node.rlist || [], "argument", false);
        walkAll(node.default_args, fscope, isVim9);
        walkAll(node.body, fscope, isVim9);
        return;
      }
      case NODE_LAMBDA: {
        const lscope: IScope = { kind: "function", node, parent: scope, decls: [] };
        declareNames(lscope, node.rlist || [], "argument", false);
        walkAll(node.left, lscope);
        walkAll(node.body, lscope, true);
        return;
      }
      case NODE_CLASS:
      case NODE_INTERFACE:
      case NODE_ENUM: {
        const cscope: IScope = { kind: "class", node, parent: scope, decls: [] };
        declare(scope, {
          name: node.name,
          kind: "class",
          node,
          pos: argPos(node),
          exported,
          members: cscope,
        });
        (node.enumvalues || []).forEach((value) => {
          declare(cscope, { name: value.value, kind: "enumvalue", node: value });
          walkAll(value.rlist, scope, true);
        });
        walkAll(node.body, cscope, true);
        return;
      }
      case NODE_TYPE:
        declare(scope, { name: node.name, kind: "type", node, pos: argPos(node), exported });
        return;
      case NODE_IMPORT: {
        const name = getImportName(node);
        const offset = node.alias && node.str ? node.str.lastIndexOf(node.alias) : -1;
        const pos = argPos(node);
        declare(scope, {
          name,
          kind: "import",
          node,
          pos: offset === -1 ? pos : { ...pos, col: pos.col + offset },
        });
        return;
      }
      case NODE_EXPORT:
        (node.body || []).forEach((n) => walk(n, scope, vim9, node, true));
        return;
      case NODE_VAR:
      case NODE_FINAL:
      case NODE_CONST:
      case NODE_LET: {
        walkAll(node.right, scope);
        const names = [].concat(node.left || []).concat(node.list || []).concat(node.rest || []);
        // only names without a scope are declared, "let g:x" is global
        const plain = names.filter((n: INode) => n.type === NODE_IDENTIFIER && /^[a-zA-Z_]\w*$/.test(n.value));
        declareNames(scope, plain, "variable", exported, node.type, vim9);
        names.forEach((n: INode) => walk(n, scope, vim9, node, false));
        return;
      }
      case NODE_FOR: {
        walkAll(node.right, scope);
        const bscope: IScope = { kind: "block", node, parent: scope, decls: [] };
        const names = [].concat(node.left || []).concat(node.list || []).concat(node.rest || []);
        declareNames(bscope, names, "variable", false);
        walkAll(names, bscope);
        walkAll(node.body, bscope);
        return;
      }
      case NODE_IDENTIFIER:
        occurrences.push({ node, parent, scope, vim9 });
        return;
      default:
        if (blockNodes[node.type]) {
          walkAll(node.cond, scope);
          const bscope: IScope = { kind: "block", node, parent: scope, decls: [] };
          walkAll(node.body, bscope);
          getChildren(node)
            .filter((n) => n !== node.cond && (node.body || []).indexOf(n) === -1)
            .forEach((n) => walk(n, scope, vim9, node, false));
          return;
        }
        if (node.type === NODE_DOT) {
          walk(node.left, scope, vim9, node, false);
          walk(node.right, scope, vim9, node, false);
          return;
        }
        if (node.block) {
          // :command and :autocmd with a block
          walkAll(node.block.body, { kind: "block", node: node.block, parent: scope, decls: [] }, true);
        }
        getChildren(node).forEach((n) => {
          if (n !== node.block) {
            walk(n, scope, vim9, node, false);
          }
        });
    }
  };

  walk(root, script, vim9script, undefined, false);
  return { script, occurrences };
}

// the name at a 0-based position
export function findOccurrence(index: IScopeIndex, position: Position): IOccurrence | undefined {
  return index.occurrences.find((occ) => {
    const { pos, value } = occ.node;
    if (!pos || typeof value !== "string") {
      return false;
    }
    const start = pos.col - 1;
    return pos.lnum - 1 === position.line && start <= position.character && position.character < start + value.length;
  });
}

// find a declaration in a scope and the scopes around it
export function lookup(scope: IScope | undefined, name: string, at?: IPos): IDecl[] {
  for (let s = scope; s; s = s.parent) {
    const found = s.decls.filter((d) => d.name === name);
    if (found.length) {
      const before = at ? found.filter((d) => !isBefore(at, d.pos)) : [];
      return before.length ? [before[before.length - 1]] : found;
    }
  }
  return [];
}

function enclosingClass(scope: IScope | undefined): IScope | undefined {
  for (let s = scope; s; s = s.parent) {
    if (s.kind === "class") {
      return s;
    }
  }
}

// declaration of the class with the members in "members"
function classDecl(index: IScopeIndex, members: IScope): IDecl | undefined {
  return index.script.decls.find((d) => d.members === members);
}

// a member of a class or one of the classes it extends
function lookupMember(index: IScopeIndex, members: IScope | undefined, name: string, seen: IScope[] = []): IDecl[] {
  if (!members || seen.indexOf(members) !== -1) {
    return [];
  }
  const found = members.decls.filter((d) => d.name === name);
  if (found.length) {
    return found;
  }
  const base = typeof members.node.extends === "string" ? members.node.extends : "";
  const baseDecl = lookup(index.script, base).find((d) => !!d.members);
  return lookupMember(index, baseDecl && baseDecl.members, name, seen.concat(members));
}

// class name of a type like "Shape" or "list<Shape>" is not followed
function classOfType(index: IScopeIndex, type: string | undefined): IDecl | undefined {
  if (!type || !/^\w+$/.test(type)) {
    return;
  }
  return lookup(index.script, type).find((d) => !!d.members);
}

// the class of a variable: from its type or "Class.new()"
function classOfDecl(index: IScopeIndex, decl: IDecl): IDecl | undefined {
  if (decl.members) {
    return decl;
  }
  const byType = classOfType(index, decl.type);
  if (byType) {
    return byType;
  }
  const parentNode = (index.occurrences.find((o) => o.node === decl.node) || {} as IOccurrence).parent;
  const right = parentNode && parentNode.right;
  if (right && right.type === NODE_CALL && right.left && right.left.type === NODE_DOT && right.left.left.type === NODE_IDENTIFIER) {
    return lookup(decl.scope, right.left.left.value).find((d) => !!d.members);
  }
}

export interface IResolved {
  // declarations in this script
  decls: IDecl[];
  // a name exported by an imported script
  imported?: { decl: IDecl, name: string };
}

/*
 * Resolve the name at "position" in Vim9 script.  Legacy script names are
 * left to the name based lookup.
 */
export function resolve(index: IScopeIndex, position: Position): IResolved {
  const occ = findOccurrence(index, position);
  if (!occ) {
    return { decls: [] };
  }
  const { node, parent } = occ;
  const name: string = node.value;
  // member: base.name
  if (parent && parent.type === NODE_DOT && parent.right === node) {
    const base = parent.left;
    if (!base || base.type !== NODE_IDENTIFIER) {
      return { decls: [] };
    }
    if (base.value === "this" || base.value === "super") {
      const members = enclosingClass(occ.scope);
      if (base.value === "this") {
        return { decls: lookupMember(index, members, name) };
      }
      const current = members && classDecl(index, members);
      const superName = current && typeof current.node.extends === "string" ? current.node.extends : "";
      const superDecl = lookup(index.script, superName).find((d) => !!d.members);
      return { decls: lookupMember(index, superDecl && superDecl.members, name) };
    }
    const baseDecl = lookup(occ.scope, base.value, base.pos)[0];
    if (!baseDecl) {
      return { decls: [] };
    }
    if (baseDecl.kind === "import") {
      return { decls: [], imported: { decl: baseDecl, name } };
    }
    const cls = classOfDecl(index, baseDecl);
    return { decls: cls ? lookupMember(index, cls.members, name) : [] };
  }
  if (!occ.vim9 || /^([gbwtvsla]:|\$|&|@)/.test(name)) {
    return { decls: [] };
  }
  return { decls: lookup(occ.scope, name, node.pos) };
}

export function declLocation(uri: string, decl: IDecl): Location {
  const line = Math.max(decl.pos.lnum - 1, 0);
  const col = Math.max(decl.pos.col - 1, 0);
  return {
    uri,
    range: Range.create(Position.create(line, col), Position.create(line, col + decl.name.length)),
  };
}

// exported declaration "name" of a script
export function findExport(index: IScopeIndex, name: string): IDecl[] {
  const decls = index.script.decls.filter((d) => d.name === name);
  const exported = decls.filter((d) => d.exported);
  return exported.length ? exported : decls;
}

/*
 * File of an :import, see ":help :import":
 * - "./file.vim", "../file.vim": relative to the importing script
 * - "/file.vim", "~/file.vim": absolute
 * - autoload "file.vim": "autoload/file.vim" in 'runtimepath'
 * - "file.vim": "import/file.vim" in 'runtimepath'
 */
export function resolveImportPath(node: INode, uri: string, runtimepath: string[]): string | undefined {
  const value = node.left && node.left.type === NODE_STRING ? `${node.left.value}` : "";
  const file = value.replace(/^['"]|['"]$/g, "");
  if (!file) {
    return;
  }
  const dir = path.dirname(URI.parse(uri).fsPath);
  const candidates: string[] = [];
  if (/^\.\.?\//.test(file)) {
    candidates.push(path.resolve(dir, file));
  } else if (/^~\//.test(file)) {
    candidates.push(path.join(process.env.HOME || "", file.slice(2)));
  } else if (path.isAbsolute(file)) {
    candidates.push(file);
  } else {
    const sub = node.autoload ? "autoload" : "import";
    // the runtime directory of the importing script comes first
    const m = dir.match(/^(.*?)[\/\\](autoload|import|plugin|ftplugin|indent|syntax|colors|compiler)([\/\\].*)?$/);
    const roots = (m ? [m[1]] : [dir]).concat(runtimepath);
    roots.forEach((root) => candidates.push(path.join(root, sub, file)));
  }
  return candidates.find((p) => fs.existsSync(p));
}
