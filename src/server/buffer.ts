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

const globalFuncPattern = /^(g:\w+(\.\w+)*|[a-zA-Z_]\w*(\.\w+)*|\w+(#\w+)+)$/;
const scriptFuncPattern = /^(s:\w+(\.\w+)*|<SID>\w+(\.\w+)*)$/i;
const globalVariablePattern = /^(g:\w+(\.\w+)*|b:\w+(\.\w+)*|\w{1,}(\.\w+)*|\w+(#\w+)+)$/;
const localVariablePattern = /^(s:\w+(\.\w+)*|l:\w+(\.\w+)*|a:\w+(\.\w+)*)$/;
const envPattern = /^\$\w+$/;

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
      this.resolveCompletionItems([node]);
    } catch (error) {
      log.error(error.stack);
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
      .filter((item) => !/^(a|l):/.test(item.label));
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
        (next.args || []).forEach((name) => {
          if (res.indexOf(name.value) === -1) {
            res.push(name.value);
          }
        });
        return res;
      }, [])
      .map((name) => ({
        label: `a:${name}`,
        kind: CompletionItemKind.Variable,
        sortText: sortTexts.one,
        insertText: `a:${name}`,
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
          break;
        case NODE_EXCALL:
        case NODE_RETURN:
        case NODE_DELFUNCTION:
        case NODE_THROW:
        case NODE_EVAL:
          nodeList = nodeList.concat(node.left);
          break;
        case NODE_DOT:
          nodeList = nodeList.concat(node.left);
          this.takeIdentifier(node);
          break;
        case NODE_ECHO:
        case NODE_ECHON:
        case NODE_ECHOMSG:
        case NODE_ECHOERR:
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
          nodeList = nodeList.concat(node.left || []);
          nodeList = nodeList.concat(node.right || []);
          break;
        case NODE_FOR:
          nodeList = nodeList.concat(node.body || []);
          nodeList = nodeList.concat(node.right || []);
          this.takeFor([].concat(node.left || []).concat(node.list || []));
          break;
        case NODE_TRY:
        case NODE_CATCH:
        case NODE_FINALLY:
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
          nodeList = nodeList.concat(node.right || []);
          if (node.left && node.left.type === NODE_DOT) {
            nodeList = nodeList.concat(node.left.left);
          }
          // not a function by function()/funcref()
          if (!this.takeFunctionByRef(node)) {
            this.takeLet(node);
          }
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
    const { left, rlist, endfunction } = node;
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
      startLine: pos.lnum,
      startCol: pos.col,
      endLine: endfunction!.pos.lnum,
      endCol: endfunction!.pos.col,
      range: {
        startLine: node.pos.lnum,
        startCol: node.pos.col,
        endLine: endfunction!.pos.lnum,
        endCol: endfunction!.pos.col,
      }
    };
    if (globalFuncPattern.test(name)) {
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
    if (localVariablePattern.test(name)) {
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
      if (localVariablePattern.test(name)) {
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
