import URIParser from "vscode-uri";

import { CompletionItem, Location, Position, Range } from "vscode-languageserver";
import { findProjectRoot } from "../common/util";
import { INode } from "../lib/vimparser";
import { Buffer, IFunction, IIdentifier } from "./buffer";
import config from "./config";
// import logger from '../common/logger';

// const log = logger('workspace')

export class Workspace {
  private buffers: Record<string, Buffer> = {};

  public isExistsBuffer(uri: string) {
    if (this.buffers[uri]) {
      return true;
    }
    return false;
  }

  public async updateBuffer(uri: string, node: INode) {
    if (!node) {
      return;
    }
    if (this.buffers[uri]) {
      this.buffers[uri].updateBufferByNode(node);
    } else {
      let projectRoot = await findProjectRoot(
        URIParser.parse(uri).fsPath,
        config.indexes.projectRootPatterns,
      );
      if (projectRoot.indexOf(config.vimruntime) === 0) {
        projectRoot = config.vimruntime;
      }
      this.buffers[uri] = new Buffer(uri, projectRoot, node);
    }
  }

  public getBufferByUri(uri: string): Buffer | undefined {
    return this.buffers[uri];
  }

  public getFunctionItems(uri: string) {
    return this.getScriptFunctionItems(uri).concat(
      this.getGlobalFunctionItems(uri),
    );
  }

  public getIdentifierItems(uri: string, line: number) {
    return this.getLocalIdentifierItems(uri, line)
      .concat(
        this.getGlobalIdentifierItems(uri),
      );
  }

  public getLocations(
    name: string,
    uri: string,
    position: Position,
    locationType: "definition" | "references",
  ): {
    locations: Location[]
    isFunArg: boolean,
  } {
    let isFunArg: boolean = false;
    let res: Location[] = [];
    if (/^((g|b):\w+(\.\w+)*|\w+(#\w+)+)$/.test(name)) {
      res = this.getGlobalLocation(name, uri, position, locationType);
    } else if (/^([a-zA-Z_]\w*(\.\w+)*)$/.test(name)) {
      // get function args references first
      res = this.getFunArgLocation(name, uri, position, locationType);
      if (res.length) {
        isFunArg = true;
      } else {
        res = this.getLocalLocation(name, uri, position, locationType);
        if (!res.length) {
          res = this.getGlobalLocation(name, uri, position, locationType);
        }
      }
    } else if (/^((s:|<SID>)\w+(\.\w+)*)$/.test(name) && this.buffers[uri]) {
      const names = [name];
      if (/^<SID>/.test(name)) {
        names.push(name.replace(/^<SID>/, "s:"));
      } else {
        names.push(name.replace(/^s:/, "<SID>"));
      }
      res = this.getScriptLocation(names, uri, position, locationType);
    } else if (/^(l:\w+(\.\w+)*)$/.test(name) && this.buffers[uri]) {
      res = this.getLocalLocation(name, uri, position, locationType);
    } else if (/^(a:\w+(\.\w+)*)$/.test(name) && this.buffers[uri]) {
      res = this.getAIdentifierLocation(name, uri, position, locationType);
    }

    if (res.length) {
      res = res.sort((a, b) => {
        if (a.range.start.line === b.range.start.line) {
          return a.range.start.character - b.range.start.character;
        }
        return a.range.start.line - b.range.start.line;
      });
    }
    return {
      isFunArg,
      locations: res,
    };
  }

  public getLocationsByUri(
    name: string,
    uri: string,
    position: Position,
    locationType: "definition" | "references",
  ): {
    locations: Location[]
    isFunArg: boolean,
  } {
    let isFunArg: boolean = false;
    let res: Location[] = [];
    if (/^((g|b):\w+(\.\w+)*|\w+(#\w+)+)$/.test(name)) {
      res = this.getGlobalLocationByUri(name, uri, position, locationType);
    } else if (/^([a-zA-Z_]\w*(\.\w+)*)$/.test(name)) {
      // get function args references first
      res = this.getFunArgLocation(name, uri, position, locationType);
      if (res.length) {
        isFunArg = true;
      } else {
        res = this.getLocalLocation(name, uri, position, locationType);
        if (!res.length) {
          res = this.getGlobalLocationByUri(name, uri, position, locationType);
        }
      }
    } else if (/^((s:|<SID>)\w+(\.\w+)*)$/.test(name) && this.buffers[uri]) {
      const names = [name];
      if (/^<SID>/.test(name)) {
        names.push(name.replace(/^<SID>/, "s:"));
      } else {
        names.push(name.replace(/^s:/, "<SID>"));
      }
      res = this.getScriptLocation(names, uri, position, locationType);
    } else if (/^(l:\w+(\.\w+)*)$/.test(name) && this.buffers[uri]) {
      res = this.getLocalLocation(name, uri, position, locationType);
    } else if (/^(a:\w+(\.\w+)*)$/.test(name) && this.buffers[uri]) {
      res = this.getAIdentifierLocation(name, uri, position, locationType);
    }

    if (res.length) {
      res = res.sort((a, b) => {
        if (a.range.start.line === b.range.start.line) {
          return a.range.start.character - b.range.start.character;
        }
        return a.range.start.line - b.range.start.line;
      });
    }
    return {
      isFunArg,
      locations: res,
    };
  }

  private filterDuplicate(items: CompletionItem[]): CompletionItem[] {
    const tmp: Record<string, boolean> = {};
    return items.reduce((res, next) => {
      if (!tmp[next.label]) {
        tmp[next.label] = true;
        res.push(next);
      }
      return res;
    }, []);
  }

  private getGlobalFunctionItems(uri: string): CompletionItem[] {
    const buf = this.buffers[uri];
    if (!buf) {
      return [];
    }
    const buffers = config.suggest.fromRuntimepath
      ? Object.values(this.buffers)
      : Object.values(this.buffers).filter((b) => {
        if (config.suggest.fromVimruntime && b.isBelongToWorkdir(config.vimruntime)) {
          return true;
        }
        return b.isBelongToWorkdir(buf.getProjectRoot());
      });
    return this.filterDuplicate(
      buffers.reduce<CompletionItem[]>((res, cur) => {
        return res.concat(cur.getGlobalFunctionItems());
      }, []),
    );
  }

  private getScriptFunctionItems(uri: string): CompletionItem[] {
    if (!this.buffers[uri]) {
      return [];
    }
    return this.buffers[uri].getScriptFunctionItems();
  }

  private getGlobalIdentifierItems(uri: string): CompletionItem[] {
    const buf = this.buffers[uri];
    if (!buf) {
      return [];
    }
    const buffers = config.suggest.fromRuntimepath
      ? Object.values(this.buffers)
      : Object.values(this.buffers).filter((b) => {
        if (config.suggest.fromVimruntime && b.isBelongToWorkdir(config.vimruntime)) {
          return true;
        }
        return b.isBelongToWorkdir(buf.getProjectRoot());
      });
    return this.filterDuplicate(
      buffers.reduce<CompletionItem[]>((res, cur) => {
        return res
          .concat(cur.getGlobalIdentifierItems())
          .concat(cur.getEnvItems());
      }, []),
    );
  }

  private getLocalIdentifierItems(uri: string, line: number): CompletionItem[] {
    if (!this.buffers[uri]) {
      return [];
    }
    const buf = this.buffers[uri];
    return buf.getFunctionLocalIdentifierItems(line)
      .concat(
        buf.getLocalIdentifierItems(),
      );
  }

  private getLocation(uri: string, item: IFunction | IIdentifier): Location {
    return {
      uri,
      range: Range.create(
        Position.create(item.startLine - 1, item.startCol - 1),
        Position.create(item.startLine - 1, item.startCol - 1 + item.name.length),
      ),
    };
  }

  private getGlobalLocation(
    name: string,
    // tslint:disable-next-line: variable-name
    _uri: string,
    // tslint:disable-next-line: variable-name
    position: Position,
    locationType: "definition" | "references",
  ): Location[] {
    return Object.keys(this.buffers).reduce((pre, uri) => {
      return pre.concat(this.getGlobalLocationByUri(name, uri, position, locationType));
    }, [] as Location[]);
  }

  private getGlobalLocationByUri(
    name: string,
    // tslint:disable-next-line: variable-name
    uri: string,
    // tslint:disable-next-line: variable-name
    _position: Position,
    locationType: "definition" | "references",
  ): Location[] {
    let res: Location[] = [];
    let tmp: Location[] = [];
    let list: Location[] = [];
    const gloalFunctions = locationType === "definition"
      ? this.buffers[uri].getGlobalFunctions()
      : this.buffers[uri].getGlobalFunctionRefs();
    Object.keys(gloalFunctions).forEach((fname) => {
      if (fname === name) {
        res = res.concat(
          gloalFunctions[fname].map((item) => this.getLocation(uri, item)),
        );
      }
    });
    const identifiers = locationType === "definition"
      ? this.buffers[uri].getGlobalIdentifiers()
      : this.buffers[uri].getGlobalIdentifierRefs();
    Object.keys(identifiers).forEach((fname) => {
      if (fname === name) {
        tmp = tmp.concat(
          identifiers[fname].map((item) => this.getLocation(uri, item)),
        );
      }
    });
    // filter function local variables
    if (/^([a-zA-Z_]\w*(\.\w+)*)$/.test(name)) {
      const glFunctions = this.buffers[uri].getGlobalFunctions();
      const scriptFunctions = this.buffers[uri].getScriptFunctions();
      const funList = Object.values(glFunctions).concat(
        Object.values(scriptFunctions),
      ).reduce((aur, fs) => aur.concat(fs), []);
      tmp.forEach((l) => {
        if (!funList.some((fun) => {
          return fun.startLine - 1 < l.range.start.line && l.range.start.line < fun.endLine - 1;
        })) {
          list.push(l);
        }
      });
    } else {
      list = tmp;
    }
    res = res.concat(list);
    return res;
  }

  private getScriptLocation(
    names: string[],
    uri: string,
    // tslint:disable-next-line: variable-name
    _position: Position,
    locationType: "definition" | "references",
  ): Location[] {
    let res: Location[] = [];
    if (!this.buffers[uri]) {
      return res;
    }
    const functions = locationType === "definition"
      ? this.buffers[uri].getScriptFunctions()
      : this.buffers[uri].getScriptFunctionRefs();
    Object.keys(functions).forEach((fname) => {
      const idx = names.indexOf(fname);
      if (idx !== -1) {
        res = res.concat(
          functions[names[idx]].map((item) => this.getLocation(uri, item)),
        );
      }
    });
    const identifiers = locationType === "definition"
      ? this.buffers[uri].getLocalIdentifiers()
      : this.buffers[uri].getLocalIdentifierRefs();
    Object.keys(identifiers).forEach((fname) => {
      const idx = names.indexOf(fname);
      if (idx !== -1) {
        res = res.concat(
          identifiers[names[idx]].map((item) => this.getLocation(uri, item)),
        );
      }
    });
    return res;
  }

  private getLocalLocation(
    name: string,
    uri: string,
    position: Position,
    locationType: "definition" | "references",
  ): Location[] {
    const list: Location[] = [];
    if (!this.buffers[uri]) {
      return list;
    }
    const vimLineNum = position.line + 1;
    let startLine = -1;
    let endLine = -1;
    // get function args completion items
    ([] as IFunction[])
      .concat(
        Object
        .values(this.buffers[uri].getGlobalFunctions())
        .reduce((res, next) => res.concat(next), []),
      )
      .concat(
        Object
        .values(this.buffers[uri].getScriptFunctions())
        .reduce((res, next) => res.concat(next), []),
      )
      .forEach((fun) => {
        if (fun.startLine < vimLineNum && vimLineNum < fun.endLine) {
          startLine = fun.startLine;
          endLine = fun.endLine;
        }
      });
    if (startLine !== -1 && endLine !== -1) {
      const globalVariables = locationType === "definition"
        ? this.buffers[uri].getGlobalIdentifiers()
        : this.buffers[uri].getGlobalIdentifierRefs();
      Object.keys(globalVariables).some((key) => {
        if (key === name) {
          globalVariables[key].forEach((item) => {
            if (startLine < item.startLine && item.startLine < endLine) {
              list.push(this.getLocation(uri, item));
            }
          });
          return true;
        }
        return false;
      });
      const localVariables = locationType === "definition"
        ? this.buffers[uri].getLocalIdentifiers()
        : this.buffers[uri].getLocalIdentifierRefs();
      Object.keys(localVariables).some((key) => {
        if (key === name) {
          localVariables[key].forEach((item) => {
            if (startLine < item.startLine && item.startLine < endLine) {
              list.push(this.getLocation(uri, item));
            }
          });
          return true;
        }
        return false;
      });
    }
    return list;
  }

  private getAIdentifierLocation(
    name: string,
    uri: string,
    position: Position,
    locationType: "definition" | "references",
  ): Location[] {
    const res: Location[] = [];
    if (!this.buffers[uri]) {
      return res;
    }
    if (locationType === "definition") {
      const flist: IFunction[] = [];
      const globalFunctions = this.buffers[uri].getGlobalFunctions();
      Object.keys(globalFunctions).forEach((fname) => {
        globalFunctions[fname].forEach((item) => {
          if (item.startLine - 1 < position.line && position.line < item.endLine - 1) {
            flist.push(item);
          }
        });
      });
      const scriptFunctions = this.buffers[uri].getScriptFunctions();
      Object.keys(scriptFunctions).forEach((fname) => {
        scriptFunctions[fname].forEach((item) => {
          if (item.startLine - 1 < position.line && position.line < item.endLine - 1) {
            flist.push(item);
          }
        });
      });
      if (flist.length) {
        const n = name.slice(2);
        return flist.filter((item) => item.args && item.args.some((m) => m.value === n))
          .map((item) => {
            const startLine = item.startLine - 1;
            let startCol = item.startCol - 1;
            let endCol = item.startCol - 1;
            item.args.some((arg) => {
              if (arg.value === n) {
                startCol = arg.pos.col - 1;
                endCol = startCol + n.length;
                return true;
              }
              return false;
            });
            return {
              uri,
              range: Range.create(
                Position.create(startLine, startCol),
                Position.create(startLine, endCol),
              ),
            };
          });
      }
    } else {
      const flist: IFunction[] = [];
      const globalFunctions = this.buffers[uri].getGlobalFunctions();
      Object.keys(globalFunctions).forEach((fname) => {
        globalFunctions[fname].forEach((item) => {
          if (item.startLine - 1 < position.line && position.line < item.endLine - 1) {
            flist.push(item);
          }
        });
      });
      const scriptFunctions = this.buffers[uri].getScriptFunctions();
      Object.keys(scriptFunctions).forEach((fname) => {
        scriptFunctions[fname].forEach((item) => {
          if (item.startLine - 1 < position.line && position.line < item.endLine - 1) {
            flist.push(item);
          }
        });
      });
      if (flist.length) {
        const identifiers = this.buffers[uri].getLocalIdentifierRefs();
        Object.keys(identifiers).forEach((key) => {
          if (key === name) {
            identifiers[name].forEach((item) => {
              flist.forEach((fitem) => {
                if (fitem.startLine < item.startLine && item.startLine < fitem.endLine) {
                  res.push({
                    uri,
                    range: Range.create(
                      Position.create(item.startLine - 1, item.startCol - 1),
                      Position.create(item.startLine - 1, item.startCol - 1 + item.name.length),
                    ),
                  });
                }
              });
            });
          }
        });
      }
    }
    return res;
  }

  private getFunArgLocation(
    name: string,
    uri: string,
    position: Position,
    locationType: "definition" | "references",
  ): Location[] {
    const res: Location[] = [];
    if (!this.buffers[uri]) {
      return res;
    }
    if (locationType === "references") {
      const globalFunctions = this.buffers[uri].getGlobalFunctions();
      const scriptFunctions = this.buffers[uri].getScriptFunctions();
      let startLine = -1;
      let endLine = -1;
      Object.values(globalFunctions).forEach((fitems) => {
        fitems.forEach((fitem) => {
          fitem.args.forEach((arg) => {
            const { pos } = arg;
            if (pos) {
              if (pos.lnum === position.line + 1 && arg.value === name) {
                startLine = fitem.startLine;
                endLine = fitem.endLine;
              }
            }
          });
        });
      });
      if (startLine === -1 && endLine === -1) {
        Object.values(scriptFunctions).forEach((fitems) => {
          fitems.forEach((fitem) => {
            fitem.args.forEach((arg) => {
              const { pos } = arg;
              if (pos) {
                if (pos.lnum === position.line + 1 && arg.value === name) {
                  startLine = fitem.startLine;
                  endLine = fitem.endLine;
                }
              }
            });
          });
        });
      }
      if (startLine !== -1 && endLine !== -1) {
        const identifiers = this.buffers[uri].getLocalIdentifierRefs();
        Object.keys(identifiers).forEach((key) => {
          if (key === `a:${name}`) {
            identifiers[key].forEach((item) => {
              if (startLine < item.startLine && item.startLine < endLine) {
                res.push({
                  uri,
                  range: Range.create(
                    Position.create(item.startLine - 1, item.startCol - 1),
                    Position.create(item.startLine - 1, item.startCol - 1 + item.name.length),
                  ),
                });
              }
            });
          }
        });
      }
    } else {
      const flist: IFunction[] = [];
      const globalFunctions = this.buffers[uri].getGlobalFunctions();
      Object.keys(globalFunctions).forEach((fname) => {
        globalFunctions[fname].forEach((item) => {
          if (item.startLine - 1 === position.line && position.character > item.startCol - 1) {
            flist.push(item);
          }
        });
      });
      const scriptFunctions = this.buffers[uri].getScriptFunctions();
      Object.keys(scriptFunctions).forEach((fname) => {
        scriptFunctions[fname].forEach((item) => {
          if (item.startLine - 1 === position.line && position.character > item.startCol - 1) {
            flist.push(item);
          }
        });
      });
      if (flist.length) {
        return flist.filter((item) => item.args && item.args.some((n) => n.value === name))
          .map((item) => {
            const startLine = item.startLine - 1;
            let startCol = item.startCol - 1;
            let endCol = item.startCol - 1;
            item.args.some((arg) => {
              if (arg.value === name) {
                startCol = arg.pos.col - 1;
                endCol = startCol + name.length;
                return true;
              }
              return false;
            });
            return {
              uri,
              range: Range.create(
                Position.create(startLine, startCol),
                Position.create(startLine, endCol),
              ),
            };
          });
      }
    }
    return res;
  }
}

export const workspace = new Workspace();
