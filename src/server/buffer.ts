import { CompletionItem, CompletionItemKind, InsertTextFormat } from "vscode-languageserver";
import { sortTexts } from "../common/constant";
import logger from "../common/logger";
import { INode, IPos } from "../lib/vimparser";

const log = logger("buffer");

const NODE_TOPLEVEL = 1;
const NODE_EXCMD = 3;
const NODE_FUNCTION = 4;
const NODE_DELFUNCTION = 6;
const NODE_RETURN = 7;
const NODE_EXCALL = 8;
const NODE_LET = 9;
const NODE_UNLET = 10;
const NODE_LOCKVAR = 11;
const NODE_UNLOCKVAR = 12;
const NODE_IF = 13;
const NODE_ELSEIF = 14;
const NODE_ELSE = 15;
const NODE_WHILE = 17;
const NODE_FOR = 19;
const NODE_TRY = 23;
const NODE_CATCH = 24;
const NODE_FINALLY = 25;
const NODE_THROW = 27;
const NODE_ECHO = 28;
const NODE_ECHON = 29;
const NODE_ECHOMSG = 31;
const NODE_ECHOERR = 32;
const NODE_EXECUTE = 33;
const NODE_TERNARY = 34;
const NODE_OR = 35;
const NODE_AND = 36;
const NODE_EQUAL = 37;
const NODE_EQUALCI = 38;
const NODE_EQUALCS = 39;
const NODE_NEQUAL = 40;
const NODE_NEQUALCI = 41;
const NODE_NEQUALCS = 42;
const NODE_GREATER = 43;
const NODE_GREATERCI = 44;
const NODE_GREATERCS = 45;
const NODE_GEQUAL = 46;
const NODE_GEQUALCI = 47;
const NODE_GEQUALCS = 48;
const NODE_SMALLER = 49;
const NODE_SMALLERCI = 50;
const NODE_SMALLERCS = 51;
const NODE_SEQUAL = 52;
const NODE_SEQUALCI = 53;
const NODE_SEQUALCS = 54;
const NODE_MATCH = 55;
const NODE_MATCHCI = 56;
const NODE_MATCHCS = 57;
const NODE_NOMATCH = 58;
const NODE_NOMATCHCI = 59;
const NODE_NOMATCHCS = 60;
const NODE_IS = 61;
const NODE_ISCI = 62;
const NODE_ISCS = 63;
const NODE_ISNOT = 64;
const NODE_ISNOTCI = 65;
const NODE_ISNOTCS = 66;
const NODE_ADD = 67;
const NODE_SUBTRACT = 68;
const NODE_CONCAT = 69;
const NODE_MULTIPLY = 70;
const NODE_DIVIDE = 71;
const NODE_REMAINDER = 72;
const NODE_NOT = 73;
const NODE_MINUS = 74;
const NODE_PLUS = 75;
const NODE_SUBSCRIPT = 76;
const NODE_SLICE = 77;
const NODE_CALL = 78;
const NODE_DOT = 79;
const NODE_NUMBER = 80;
const NODE_STRING = 81;
const NODE_LIST = 82;
const NODE_DICT = 83;
const NODE_IDENTIFIER = 86;
const NODE_CURLYNAME = 87;
const NODE_ENV = 88;
const NODE_REG = 89;                    // TODO
const NODE_CURLYNAMEPART = 90;          // TODO
const NODE_CURLYNAMEEXPR = 91;          // TODO
const NODE_LAMBDA = 92;
const NODE_CONST = 94;
const NODE_EVAL = 95;
const NODE_HEREDOC = 96;
const NODE_METHOD = 97;
const NODE_ECHOCONSOLE = 98;
const NODE_LSHIFT = 99;
const NODE_RSHIFT = 100;
const NODE_DEF = 101;
const NODE_VAR = 103;
const NODE_FINAL = 104;
const NODE_EXPORT = 105;
const NODE_VIM9SCRIPT = 107;
const NODE_TUPLE = 108;
const NODE_CAST = 109;
const NODE_ASSIGN = 110;
const NODE_BLOCK = 111;
const NODE_CLASS = 113;
const NODE_INTERFACE = 115;
const NODE_ENUM = 117;
const NODE_ENUMVALUE = 119;
const NODE_TYPE = 120;
const NODE_PUBLIC = 121;
const NODE_STATIC = 122;
const NODE_ABSTRACT = 123;
const NODE_FALSY = 124;
const NODE_INTERPOLATION = 125;
const NODE_DEFER = 126;
const NODE_ECHOWINDOW = 127;

/*
 * buffer's completion items
 *
 * 1. functions: xxx g:xxx s:xxx xx#xxx
 * 2. identifier: xxx g:xxx s:xxx b:xxx l:xxx a:xxx
 */

/*
 * global function declation
 *
 * - g:function_name
 * - Captial_function_name
 */
export interface IFunction {
  name: string;
  args: INode[];
  // :def function, the arguments have no "a:"
  vim9?: boolean;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  range: {
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
  }
}

export interface IFunRef {
  name: string;
  args: INode[];
  startLine: number;
  startCol: number;
}

export interface IIdentifier {
  name: string;
  startLine: number;
  startCol: number;
}

/*
 * Vim9 class, interface, enum or type alias
 */
export interface IClass extends IIdentifier {
  kind: "class" | "interface" | "enum" | "type";
  endLine: number;
  endCol: number;
}

/*
 * xxxx
 * endxxx
 *
 */
export interface IRange {
  startLine: number
  startCol: number
  endLine: number
  endCol: number
}

const globalFuncPattern = /^(g:\w+(\.\w+)*|[a-zA-Z_]\w*(\.\w+)*|(\w+#)+\w*)$/;
const scriptFuncPattern = /^(s:\w+(\.\w+)*|<SID>\w+(\.\w+)*)$/i;
const globalVariablePattern = /^(g:\w+(\.\w+)*|b:\w+(\.\w+)*|\w{1,}(\.\w+)*|\w+(#\w+)+)$/;
const localVariablePattern = /^(s:\w+(\.\w+)*|l:\w+(\.\w+)*|a:\w+(\.\w+)*)$/;
const envPattern = /^\$\w+$/;
const plainNamePattern = /^[a-zA-Z_]\w*$/;
// names that are assigned without declaration in Vim9 script
const undeclaredPattern = /^([gbwtv]:|[$&@])/;

export class Buffer {

  private globalFunctions: Record<string, IFunction[]> = {};
  private scriptFunctions: Record<string, IFunction[]> = {};
  private globalFunctionRefs: Record<string, IFunRef[]> = {};
  private scriptFunctionRefs: Record<string, IFunRef[]> = {};

  private globalVariables: Record<string, IIdentifier[]> = {};
  private localVariables: Record<string, IIdentifier[]> = {};
  private globalVariableRefs: Record<string, IIdentifier[]> = {};
  private localVariableRefs: Record<string, IIdentifier[]> = {};

  private envs: Record<string, IIdentifier[]> = {};
  private envRefs: Record<string, IIdentifier[]> = {};

  private ranges: IRange[] = []

  // Vim9 script
  private isVim9: boolean = false;
  private classes: Record<string, IClass[]> = {};
  private methods: Record<string, IFunction[]> = {};
  // declared names without scope, sorted out when the functions are known
  private vim9Declarations: IIdentifier[] = [];

  constructor(
    private uri: string,
    private projectRoot: string,
    private node: INode,
  ) {
    this.updateBufferByNode(this.node);
  }

  public getGlobalFunctions() {
    return this.globalFunctions;
  }

  public getGlobalFunctionRefs() {
    return this.globalFunctionRefs;
  }

  public getScriptFunctions() {
    return this.scriptFunctions;
  }

  public getScriptFunctionRefs() {
    return this.scriptFunctionRefs;
  }

  public getGlobalIdentifiers() {
    return this.globalVariables;
  }

  public getGlobalIdentifierRefs() {
    return this.globalVariableRefs;
  }

  public getLocalIdentifiers() {
    return this.localVariables;
  }

  public getLocalIdentifierRefs() {
    return this.localVariableRefs;
  }

  public getRanges() {
    return this.ranges
  }

  public getNode() {
    return this.node;
  }

  public getClasses() {
    return this.classes;
  }

  public getMethods() {
    return this.methods;
  }

  public getIsVim9() {
    return this.isVim9;
  }

  public getProjectRoot() {
    return this.projectRoot;
  }

  public isBelongToWorkdir(workUri: string) {
    return this.projectRoot === workUri;
  }

  public updateBufferByNode(node: INode) {
    this.node = node;
    this.resetProperties();
    try {
      this.isVim9 = (node.body || []).some((n) => n.type === NODE_VIM9SCRIPT);
      this.resolveCompletionItems([node]);
      this.takeVim9Declarations();
    } catch (error) {
      log.warn(`updateBufferByNode: ${error.stack}`);
    }
  }

  /*
   * global function
   *
   * - g:xxx
   * - xx#xxx
   */
  public getGlobalFunctionItems(): CompletionItem[] {
    const refs: Record<string, IFunRef[]> = {};
    Object.keys(this.globalFunctionRefs).forEach((name) => {
      if (!this.globalFunctions[name]) {
        refs[name] = this.globalFunctionRefs[name];
      }
    });
    return this.getFunctionItems(this.globalFunctions, sortTexts.three)
      .concat(
        this.getFunctionItems(refs, sortTexts.three),
      );
  }

  /*
   * script function
   *
   * - s:xxx
   */
  public getScriptFunctionItems(): CompletionItem[] {
    const refs: Record<string, IFunRef[]> = {};
    Object.keys(this.scriptFunctionRefs).forEach((name) => {
      if (!this.scriptFunctions[name]) {
        refs[name] = this.scriptFunctionRefs[name];
      }
    });
    return this.getFunctionItems(this.scriptFunctions, sortTexts.two)
      .concat(
        this.getFunctionItems(refs, sortTexts.two),
      );
  }

  /*
   * global identifier
   *
   * - g:xxx
   * - b:xxx
   * - [a-zA-Z]+
   * - xx#xxx
   */
  public getGlobalIdentifierItems(): CompletionItem[] {
    const refs: Record<string, IIdentifier[]> = {};
    Object.keys(this.globalVariableRefs).forEach((name) => {
      if (!this.globalVariables[name]) {
        refs[name] = this.globalVariableRefs[name];
      }
    });
    const globalVariables: CompletionItem[] = [];
    const localVariables: CompletionItem[] = [];
    this.getIdentifierItems(this.globalVariables, sortTexts.three)
      .concat(
        this.getIdentifierItems(refs, sortTexts.three),
      )
      .forEach((item) => {
        if (/^([a-zA-Z_]\w*(\.\w+)*)$/.test(item.label)) {
          localVariables.push(item);
        } else {
          globalVariables.push(item);
        }
      });
    if (localVariables.length) {
        const gloalFunctions = this.getGlobalFunctions();
        const scriptFunctions = this.getScriptFunctions();
        const funList = Object.values(gloalFunctions).concat(
          Object.values(scriptFunctions),
        ).reduce((res, fs) => res.concat(fs), []);

        localVariables.forEach((l) => {
          if ((l.data as IIdentifier[]).some((identifier) => {
            return funList.every((fun) =>
              !(fun.startLine < identifier.startLine && identifier.startLine < fun.endLine));
          })) {
            globalVariables.push(l);
          }
        });
    }
    return globalVariables;
  }

  /*
   * local identifier
   *
   * - s:xxx
   */
  public getLocalIdentifierItems(): CompletionItem[] {
    const refs: Record<string, IIdentifier[]> = {};
    Object.keys(this.localVariableRefs).forEach((name) => {
      if (!this.localVariables[name]) {
        refs[name] = this.localVariableRefs[name];
      }
    });
    return this.getIdentifierItems(this.localVariables, sortTexts.two)
      .concat(
        this.getIdentifierItems(refs, sortTexts.two),
      )
      .filter((item) => !/^(a|l):/.test(item.label))
      .concat(this.getClassItems());
  }

  /*
   * Vim9 classes, interfaces, enums and types
   */
  public getClassItems(): CompletionItem[] {
    const kinds = {
      class: CompletionItemKind.Class,
      enum: CompletionItemKind.Enum,
      interface: CompletionItemKind.Interface,
      type: CompletionItemKind.TypeParameter,
    };
    return Object.keys(this.classes).map<CompletionItem>((name) => ({
      label: name,
      kind: kinds[this.classes[name][0].kind],
      sortText: sortTexts.two,
      documentation: `User defined ${this.classes[name][0].kind}`,
      insertText: name,
      insertTextFormat: InsertTextFormat.PlainText,
    }));
  }

  /*
   * function local identifier
   *
   * - l:xxx
   * - a:xxx
   * - identifiers in function range
   */
  public getFunctionLocalIdentifierItems(line: number): CompletionItem[] {
    const vimLineNum = line + 1;
    let startLine = -1;
    let endLine = -1;
    // get function args completion items
    const funArgs: CompletionItem[] = ([] as IFunction[])
      .concat(Object.values(this.globalFunctions).reduce((res, next) => res.concat(next), []))
      .concat(Object.values(this.scriptFunctions).reduce((res, next) => res.concat(next), []))
      .filter((fun) => {
        if (startLine === -1 && endLine === -1 && fun.startLine < vimLineNum && vimLineNum < fun.endLine) {
          startLine = fun.startLine;
          endLine = fun.endLine;
        } else if (fun.startLine > startLine && endLine > fun.endLine) {
          startLine = fun.startLine;
          endLine = fun.endLine;
        }

        return fun.startLine < vimLineNum && vimLineNum < fun.endLine;
      })
      .reduce<string[]>((res, next) => {
        (next.args || []).forEach((arg) => {
          // ...name of a :def function
          const name = next.vim9 ? `${arg.value}`.replace(/^\.\.\./, "") : `a:${arg.value}`;
          if (res.indexOf(name) === -1) {
            res.push(name);
          }
        });
        return res;
      }, [])
      .map((name) => ({
        label: name,
        kind: CompletionItemKind.Variable,
        sortText: sortTexts.one,
        insertText: name,
        insertTextFormat: InsertTextFormat.PlainText,
      }));
    if (startLine !== -1 && endLine !== -1) {
      const funcLocalIdentifiers = this.getIdentifierItems(this.localVariables, sortTexts.one)
        .concat(
          this.getIdentifierItems(this.globalVariables, sortTexts.one),
        )
        .filter((item) => {
          if (!(/^l:/.test(item.label) || /^([a-zA-Z_]\w*(\.\w+)*)$/.test(item.label))) {
            return false;
          }
          const { data } = item;
          if (!data) {
            return false;
          }
          return data.some((i: IIdentifier) => startLine < i.startLine && i.startLine < endLine);
        });
      return funArgs.concat(funcLocalIdentifiers);
    }
    return [];
  }

  /*
   * environment identifier
   *
   * - $xxx
   */
  public getEnvItems(): CompletionItem[] {
    return Object.keys(this.envs).map<CompletionItem>((name) => {
      return {
        label: name,
        insertText: name,
        sortText: sortTexts.three,
        insertTextFormat: InsertTextFormat.PlainText,
      };
    });
  }

  private resetProperties() {
    this.globalFunctions = {};
    this.scriptFunctions = {};
    this.globalFunctionRefs = {};
    this.scriptFunctionRefs = {};
    this.globalVariables = {};
    this.localVariables = {};
    this.globalVariableRefs = {};
    this.localVariableRefs = {};
    this.envs = {};
    this.envRefs = {};
    this.ranges = []
    this.isVim9 = false;
    this.classes = {};
    this.methods = {};
    this.vim9Declarations = [];
  }

  private resolveCompletionItems(nodes: INode | INode[]) {
    let nodeList: INode[] = [].concat(nodes);
    while (nodeList.length > 0) {
      const node = nodeList.pop();
      switch (node.type) {
        case NODE_TOPLEVEL:
          nodeList = nodeList.concat(node.body);
          break;
        // autocmd/command/map
        case NODE_EXCMD:
          this.takeFuncRefByExcmd(node);
          if (node.block) {
            nodeList = nodeList.concat(node.block.body || []);
            this.takeRange(node.block, "endblock");
          }
          break;
        case NODE_EXCALL:
        case NODE_RETURN:
        case NODE_DELFUNCTION:
        case NODE_THROW:
        case NODE_EVAL:
        case NODE_DEFER:
        case NODE_CAST:
          nodeList = nodeList.concat(node.left || []);
          break;
        case NODE_EXPORT:
        case NODE_PUBLIC:
        case NODE_STATIC:
        case NODE_ABSTRACT:
          nodeList = nodeList.concat(node.body || []);
          break;
        case NODE_BLOCK:
          nodeList = nodeList.concat(node.body || []);
          this.takeRange(node, "endblock");
          break;
        case NODE_CLASS:
        case NODE_INTERFACE:
        case NODE_ENUM:
          nodeList = nodeList.concat(node.body || []);
          nodeList = nodeList.concat(node.enumvalues || []);
          this.takeClass(node);
          this.takeRange(node, ["endclass", "endinterface", "endenum"]);
          break;
        case NODE_TYPE:
          this.takeClass(node);
          break;
        case NODE_ENUMVALUE:
          nodeList = nodeList.concat(node.rlist || []);
          break;
        case NODE_TUPLE:
        case NODE_INTERPOLATION:
          nodeList = nodeList.concat(node.value || []);
          break;
        case NODE_DOT:
          nodeList = nodeList.concat(node.left);
          this.takeIdentifier(node);
          break;
        case NODE_ECHO:
        case NODE_ECHON:
        case NODE_ECHOMSG:
        case NODE_ECHOERR:
        case NODE_ECHOCONSOLE:
        case NODE_ECHOWINDOW:
        case NODE_UNLET:
        case NODE_LOCKVAR:
        case NODE_UNLOCKVAR:
        case NODE_EXECUTE:
          nodeList = nodeList.concat(node.list || []);
          break;
        case NODE_TERNARY:
          nodeList = nodeList.concat(node.cond || []);
          nodeList = nodeList.concat(node.left || []);
          nodeList = nodeList.concat(node.right || []);
          break;
        case NODE_IF:
        case NODE_ELSEIF:
        case NODE_ELSE:
        case NODE_WHILE:
          this.takeRange(node, ['endif', 'endwhile'])
          nodeList = nodeList.concat(node.body || []);
          nodeList = nodeList.concat(node.cond || []);
          nodeList = nodeList.concat(node.elseif || []);
          nodeList = nodeList.concat(node._else || []);
          break;
        case NODE_OR:
        case NODE_AND:
        case NODE_EQUAL:
        case NODE_EQUALCI:
        case NODE_EQUALCS:
        case NODE_NEQUAL:
        case NODE_NEQUALCI:
        case NODE_NEQUALCS:
        case NODE_GREATER:
        case NODE_GREATERCI:
        case NODE_GREATERCS:
        case NODE_GEQUAL:
        case NODE_GEQUALCI:
        case NODE_GEQUALCS:
        case NODE_SMALLER:
        case NODE_SMALLERCI:
        case NODE_SMALLERCS:
        case NODE_SEQUAL:
        case NODE_SEQUALCI:
        case NODE_SEQUALCS:
        case NODE_MATCH:
        case NODE_MATCHCI:
        case NODE_MATCHCS:
        case NODE_NOMATCH:
        case NODE_NOMATCHCI:
        case NODE_NOMATCHCS:
        case NODE_IS:
        case NODE_ISCI:
        case NODE_ISCS:
        case NODE_ISNOT:
        case NODE_ISNOTCI:
        case NODE_ISNOTCS:
        case NODE_CONCAT:
        case NODE_MULTIPLY:
        case NODE_DIVIDE:
        case NODE_REMAINDER:
        case NODE_NOT:
        case NODE_MINUS:
        case NODE_PLUS:
        case NODE_ADD:
        case NODE_SUBTRACT:
        case NODE_SUBSCRIPT:
        case NODE_METHOD:
        case NODE_LSHIFT:
        case NODE_RSHIFT:
        case NODE_FALSY:
          nodeList = nodeList.concat(node.left || []);
          nodeList = nodeList.concat(node.right || []);
          break;
        case NODE_FOR:
          nodeList = nodeList.concat(node.body || []);
          nodeList = nodeList.concat(node.right || []);
          this.takeFor([].concat(node.left || []).concat(node.list || []));
          this.takeRange(node, 'endfor')
          break;
        case NODE_TRY:
        case NODE_CATCH:
        case NODE_FINALLY:
          this.takeRange(node, 'endtry')
          nodeList = nodeList.concat(node.body || []);
          nodeList = nodeList.concat(node.catch || []);
          nodeList = nodeList.concat(node._finally || []);
          break;
        case NODE_FUNCTION:
          nodeList = nodeList.concat(node.body || []);
          if (node.left && node.left.type === NODE_DOT) {
            nodeList = nodeList.concat(node.left.left);
          }
          this.takeFunction(node);
          this.takeRange(node, 'endfunction')
          break;
        case NODE_DEF:
          nodeList = nodeList.concat(node.body || []);
          nodeList = nodeList.concat(node.default_args || []);
          this.takeFunction(node);
          this.takeRange(node, "enddef");
          break;
        case NODE_LIST:
          nodeList = nodeList.concat(node.value || []);
          break;
        case NODE_DICT:
          nodeList = nodeList.concat(
            (node.value || []).map((item: [INode, INode]) => item[1]),
          );
          break;
        case NODE_SLICE:
        case NODE_LAMBDA:
          nodeList = nodeList.concat(node.left || []);
          nodeList = nodeList.concat(node.rlist || []);
          // Vim9 lambda with a block
          nodeList = nodeList.concat(node.body || []);
          break;
        case NODE_CALL:
          nodeList = nodeList.concat(node.rlist || []);
          if (node.left && node.left.type === NODE_DOT) {
            nodeList = nodeList.concat(node.left.left);
          }
          this.takeFuncRefByRef(node);
          this.takeFuncRef(node);
          break;
        case NODE_LET:
        case NODE_CONST:
        case NODE_VAR:
        case NODE_FINAL:
          nodeList = nodeList.concat(node.right || []);
          if (node.left && node.left.type === NODE_DOT) {
            nodeList = nodeList.concat(node.left.left);
          }
          // let [a, b] = ...
          this.takeFor([].concat(node.list || []).concat(node.rest || []));
          // not a function by function()/funcref()
          if (node.left && !this.takeFunctionByRef(node)) {
            this.takeLet(node);
          }
          break;
        case NODE_ASSIGN:
          // Vim9 assignment: g:var, $ENV, &opt and @r are defined by it, other
          // variables were declared before
          nodeList = nodeList.concat(node.right || []);
          [].concat(node.left || []).concat(node.list || []).concat(node.rest || [])
            .forEach((left: INode) => {
              const name = this.getDotName(left);
              if (left.type !== NODE_DOT && left.type !== NODE_SUBSCRIPT && undeclaredPattern.test(name)) {
                this.takeLet({ ...node, left });
              } else {
                nodeList.push(left);
              }
            });
          break;
        case NODE_ENV:
        case NODE_IDENTIFIER:
          this.takeIdentifier(node);
          break;
        default:
          break;
      }
    }
    // log.info(`parse_buffer: ${JSON.stringify(this)}`)
  }

  private takeFunction(node: INode) {
    const { left, rlist } = node;
    // a function that is not closed ends where it starts
    const endNode = node.type === NODE_DEF ? node.enddef : node.endfunction;
    const end = (endNode && endNode.pos) || node.pos;
    const name = this.getDotName(left);
    if (!name) {
      return;
    }
    const pos = this.getDotPos(left);
    if (!pos) {
      return;
    }
    const func: IFunction = {
      name,
      args: rlist || [],
      vim9: node.type === NODE_DEF,
      startLine: pos.lnum,
      startCol: pos.col,
      endLine: end.lnum,
      endCol: end.col,
      range: {
        startLine: node.pos.lnum,
        startCol: node.pos.col,
        endLine: end.lnum,
        endCol: end.col,
      }
    };
    if (this.getClassAt(node.pos.lnum)) {
      // method of a Vim9 class
      if (!this.methods[name]) {
        this.methods[name] = [];
      }
      this.methods[name].push(func);
    } else if (this.isVim9 && plainNamePattern.test(name)) {
      // functions without a scope are script-local in Vim9 script
      if (!this.scriptFunctions[name]) {
        this.scriptFunctions[name] = [];
      }
      this.scriptFunctions[name].push(func);
    } else if (globalFuncPattern.test(name)) {
      if (!this.globalFunctions[name] || !Array.isArray(this.globalFunctions[name])) {
        this.globalFunctions[name] = [];
      }
      this.globalFunctions[name].push(func);
    } else if (scriptFuncPattern.test(name)) {
      if (!this.scriptFunctions[name] || !Array.isArray(this.scriptFunctions[name])) {
        this.scriptFunctions[name] = [];
      }
      this.scriptFunctions[name].push(func);
    }
  }

  /*
   * vim function
   *
   * - let funcName = function()
   * - let funcName = funcref()
   */
  private takeFunctionByRef(node: INode): boolean {
    const { left, right } = node;
    if (!right || right.type !== NODE_CALL) {
      return;
    }
    // is not function()/funcref()
    if (
      !right.left ||
      !right.left.value ||
      ["function", "funcref"].indexOf(right.left.value) === -1
    ) {
      return;
    }
    const name = this.getDotName(left);
    if (!name) {
      return;
    }
    const pos = this.getDotPos(left);
    if (!pos) {
      return false;
    }
    const func: IFunction = {
      name,
      args: [],
      startLine: pos.lnum,
      startCol: pos.col,
      endLine: pos.lnum,
      endCol: pos.col,
      range: {
        startLine: pos.lnum,
        startCol: pos.col,
        endLine: pos.lnum,
        endCol: pos.col,
      }
    };
    if (globalFuncPattern.test(name)) {
      if (!this.globalFunctions[name] || !Array.isArray(this.globalFunctions[name])) {
        this.globalFunctions[name] = [];
      }
      this.globalFunctions[name].push(func);
      return true;
    } else if (scriptFuncPattern.test(name)) {
      if (!this.scriptFunctions[name] || !Array.isArray(this.scriptFunctions[name])) {
        this.scriptFunctions[name] = [];
      }
      this.scriptFunctions[name].push(func);
      return true;
    }
    return false;
  }

  private takeFuncRef(node: INode) {
    const { left, rlist } = node;
    let name = "";
    if (left.type === NODE_IDENTIFIER) {
      name = left.value;
    // <SID>funName
    } else if (left.type === NODE_CURLYNAME) {
      name = ((left.value || []) as INode[]).map((item) => item.value).join("");
    } else if (left.type === NODE_DOT) {
      name = this.getDotName(left);
    }
    if (!name) {
      return;
    }
    const pos = this.getDotPos(left);
    if (!pos) {
      return;
    }
    const funcRef: IFunRef = {
      name,
      args: rlist || [],
      startLine: pos.lnum,
      startCol: pos.col,
    };

    if (globalFuncPattern.test(name)) {
      if (!this.globalFunctionRefs[name] || !Array.isArray(this.globalFunctionRefs[name])) {
        this.globalFunctionRefs[name] = [];
      }
      this.globalFunctionRefs[name].push(funcRef);
    } else if (scriptFuncPattern.test(name)) {
      if (!this.scriptFunctionRefs[name] || !Array.isArray(this.scriptFunctionRefs[name])) {
        this.scriptFunctionRefs[name] = [];
      }
      this.scriptFunctionRefs[name].push(funcRef);
    }

  }

  /*
   * vim function ref
   * first value is function name
   *
   * - function('funcName')
   * - funcref('funcName')
   */
  private takeFuncRefByRef(node: INode) {
    const { left, rlist } = node;
    const funcNode = rlist && rlist[0];
    if (
      !left ||
      ["function", "funcref"].indexOf(left.value) === -1 ||
      !funcNode ||
      !funcNode.pos ||
      typeof funcNode.value !== "string"
    ) {
      return;
    }

    // delete '/" of function name
    const name = (funcNode.value as string).replace(/^['"]|['"]$/g, "");
    const funcRef: IFunRef = {
      name,
      args: [],
      startLine: funcNode.pos.lnum,
      startCol: funcNode.pos.col + 1, // +1 by '/"
    };

    if (globalFuncPattern.test(name)) {
      if (!this.globalFunctionRefs[name] || !Array.isArray(this.globalFunctionRefs[name])) {
        this.globalFunctionRefs[name] = [];
      }
      this.globalFunctionRefs[name].push(funcRef);
    } else if (scriptFuncPattern.test(name)) {
      if (!this.scriptFunctionRefs[name] || !Array.isArray(this.scriptFunctionRefs[name])) {
        this.scriptFunctionRefs[name] = [];
      }
      this.scriptFunctionRefs[name].push(funcRef);
    }
  }

  /*
   * FIXME: take function ref by
   *
   * - autocmd
   * - command
   * - map
   */
  private takeFuncRefByExcmd(node: INode) {
    const { pos, str } = node;
    if (!str) {
      return;
    }

    // tslint:disable-next-line: max-line-length
    if (!/^[ \t]*((au|aut|auto|autoc|autocm|autocmd|com|comm|comma|comman|command)!?[ \t]+|([a-zA-Z]*map!?[ \t]+.*?:))/.test(str)) {
      return;
    }

    const regFunc = /(<sid>[\w_#]+|[a-zA-Z_]:[\w_#]+|[\w_#]+)[ \t]*\(/gi;
    let m = regFunc.exec(str);

    while (m) {
      const name = m[1];
      if (name) {
        const funcRef: IFunRef = {
          name,
          args: [],
          startLine: pos.lnum,
          startCol: pos.col + m.index,
        };

        if (globalFuncPattern.test(name)) {
          if (!this.globalFunctionRefs[name] || !Array.isArray(this.globalFunctionRefs[name])) {
            this.globalFunctionRefs[name] = [];
          }
          this.globalFunctionRefs[name].push(funcRef);
        } else if (scriptFuncPattern.test(name)) {
          if (!this.scriptFunctionRefs[name] || !Array.isArray(this.scriptFunctionRefs[name])) {
            this.scriptFunctionRefs[name] = [];
          }
          this.scriptFunctionRefs[name].push(funcRef);
        }
      }
      m = regFunc.exec(str);
    }
  }

  private takeLet(node: INode) {
    const pos = this.getDotPos(node.left);
    const name = this.getDotName(node.left);
    if (!pos || !name) {
      return;
    }
    const identifier: IIdentifier =  {
      name,
      startLine: pos.lnum,
      startCol: pos.col,
    };
    if (this.isVim9 && plainNamePattern.test(name)) {
      this.vim9Declarations.push(identifier);
    } else if (localVariablePattern.test(name)) {
      if (!this.localVariables[name] || !Array.isArray(this.localVariables[name])) {
        this.localVariables[name] = [];
      }
      this.localVariables[name].push(identifier);
    } else if (globalVariablePattern.test(name)) {
      if (!this.globalVariables[name] || !Array.isArray(this.globalVariables[name])) {
        this.globalVariables[name] = [];
      }
      this.globalVariables[name].push(identifier);
    } else if (envPattern.test(name)) {
      if (!this.envs[name] || !Array.isArray(this.envs[name])) {
        this.envs[name] = [];
      }
      this.envs[name].push(identifier);
    }
  }

  /*
   * Vim9 class, interface, enum and type alias
   */
  private takeClass(node: INode) {
    if (!node.name || !node.pos) {
      return;
    }
    const kinds: Record<number, IClass["kind"]> = {
      [NODE_CLASS]: "class",
      [NODE_INTERFACE]: "interface",
      [NODE_ENUM]: "enum",
      [NODE_TYPE]: "type",
    };
    const end = [node.endclass, node.endinterface, node.endenum]
      .filter((n) => n && n.pos)
      .map((n) => n.pos)[0] || node.pos;
    // the name is the argument of the command
    const line = (node.ea && node.ea.argpos && node.ea.argpos.lnum) ? node.ea.argpos : node.pos;
    const item: IClass = {
      name: node.name,
      kind: kinds[node.type],
      startLine: line.lnum,
      startCol: line.col,
      endLine: end.lnum,
      endCol: end.col,
    };
    if (!this.classes[node.name]) {
      this.classes[node.name] = [];
    }
    this.classes[node.name].push(item);
  }

  private getClassAt(lnum: number): IClass | undefined {
    let res: IClass | undefined;
    Object.values(this.classes).forEach((list) => {
      list.forEach((item) => {
        if (item.kind !== "type" && item.startLine < lnum && lnum < item.endLine) {
          res = item;
        }
      });
    });
    return res;
  }

  /*
   * Vim9 variables without a scope: in a function they are local like
   * legacy function variables, in a class they are members, otherwise they
   * are script-local.
   */
  private takeVim9Declarations() {
    const funcs = ([] as IFunction[])
      .concat(...Object.values(this.globalFunctions))
      .concat(...Object.values(this.scriptFunctions))
      .concat(...Object.values(this.methods));
    this.vim9Declarations.forEach((identifier) => {
      const inFunction = funcs.some((f) => f.startLine < identifier.startLine && identifier.startLine < f.endLine);
      let list = this.localVariables;
      if (inFunction) {
        list = this.globalVariables;
      } else if (this.getClassAt(identifier.startLine)) {
        return;
      }
      if (!list[identifier.name]) {
        list[identifier.name] = [];
      }
      list[identifier.name].push(identifier);
    });
    this.vim9Declarations = [];
  }

  private takeRange(node: INode, keys: string | string[]) {
    [].concat(keys).forEach(key => {
      if (node.pos && node[key] && node[key].pos) {
        this.ranges.push({
          startLine: node.pos.lnum,
          startCol: node.pos.col,
          endLine: node[key].pos.lnum,
          endCol: node[key].pos.col
        })
      }
    })
  }

  private takeFor(nodes: INode[]) {
    nodes.forEach((node) => {
      if (node.type !== NODE_IDENTIFIER || !node.pos) {
        return;
      }
      const name = node.value;
      const identifier: IIdentifier =  {
        name,
        startLine: node.pos.lnum,
        startCol: node.pos.col,
      };
      if (this.isVim9 && plainNamePattern.test(name)) {
        this.vim9Declarations.push(identifier);
      } else if (localVariablePattern.test(name)) {
        if (!this.localVariables[name] || !Array.isArray(this.localVariables[name])) {
          this.localVariables[name] = [];
        }
        this.localVariables[name].push(identifier);
      } else if (globalVariablePattern.test(name)) {
        if (!this.globalVariables[name] || !Array.isArray(this.globalVariables[name])) {
          this.globalVariables[name] = [];
        }
        this.globalVariables[name].push(identifier);
      } else if (envPattern.test(name)) {
        if (!this.envs[name] || !Array.isArray(this.envs[name])) {
          this.envs[name] = [];
        }
        this.envs[name].push(identifier);
      }
    });
  }

  private takeIdentifier(node: INode) {
    const name = this.getDotName(node);
    if (!name) {
      return;
    }
    const pos = this.getDotPos(node);
    if (!pos) {
      return;
    }
    const identifier: IIdentifier = {
      name,
      startLine: pos.lnum,
      startCol: pos.col,
    };
    if (globalVariablePattern.test(name)) {
      if (!this.globalVariableRefs[name] || !Array.isArray(this.globalVariableRefs[name])) {
        this.globalVariableRefs[name] = [];
      }
      this.globalVariableRefs[name].push(identifier);
    } else if (localVariablePattern.test(name)) {
      if (!this.localVariableRefs[name] || !Array.isArray(this.localVariableRefs[name])) {
        this.localVariableRefs[name] = [];
      }
      this.localVariableRefs[name].push(identifier);
    } else if (envPattern.test(name)) {
      if (!this.envRefs[name] || !Array.isArray(this.envRefs[name])) {
        this.envRefs[name] = [];
      }
      this.envRefs[name].push(identifier);
    }
  }

  private getDotPos(node: INode): IPos | null {
    if (!node) {
      return null;
    }
    if (
      node.type === NODE_IDENTIFIER ||
      node.type === NODE_ENV ||
      node.type === NODE_CURLYNAME
    ) {
      return node.pos;
    }
    const { left } = node;
    return this.getDotPos(left);
  }

  private getDotName(node: INode) {
    if (
      node.type === NODE_IDENTIFIER ||
      node.type === NODE_STRING ||
      node.type === NODE_NUMBER ||
      node.type === NODE_ENV
    ) {
      return node.value;
    } else if (node.type === NODE_CURLYNAME) {
      return ((node.value || []) as INode[]).map((item) => item.value).join("");
    } else if (node.type === NODE_SUBSCRIPT) {
      return this.getDotName(node.left);
    }
    const { left, right } = node;
    const list = [];
    if (left) {
      list.push(this.getDotName(left));
    }
    if (right) {
      list.push(this.getDotName(right));
    }
    return list.join(".");
  }

  private getFunctionItems(
    items: Record<string, IFunction[] | IFunRef[]>,
    sortText: string,
  ): CompletionItem[] {
    return Object.keys(items).map<CompletionItem>((name) => {
      const list = items[name];
      let args = "${1}";
      if (list[0] && list[0].args && list[0].args.length > 0) {
        args = (list[0].args || []).reduce((res, next, idx) => {
          // FIXME: resove next.value is not string
          const value = typeof next.value !== "string" ? "param" : next.value;
          if (idx === 0) {
            return `\${${idx + 1}:${value}}`;
          }
          return `${res}, \${${idx + 1}:${value}}`;
        }, "");
      }
      let label = name;
      if (/^<SID>/.test(name)) {
        label = name.replace(/^<SID>/, "s:");
      }
      return {
        label,
        detail: "any",
        sortText,
        documentation: "User defined function",
        kind: CompletionItemKind.Function,
        insertText: `${label}(${args})\${0}`,
        insertTextFormat: InsertTextFormat.Snippet,
      };
    });
  }

  private getIdentifierItems(items: Record<string, IIdentifier[]>, sortText: string): CompletionItem[] {
    return Object.keys(items)
      .filter((name) => !this.globalFunctions[name] && !this.scriptFunctions[name])
      .map<CompletionItem>((name) => {
        const list: IIdentifier[] = items[name];
        return {
          label: name,
          kind: CompletionItemKind.Variable,
          sortText,
          documentation: "User defined variable",
          insertText: name,
          insertTextFormat: InsertTextFormat.PlainText,
          data: list || [],
        };
      });
  }
}
