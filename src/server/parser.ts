import childProcess, {ChildProcess} from "child_process";
import { join } from "path";
import { from, of, Subject, timer } from "rxjs";
import { waitMap } from "rxjs-operators/lib/waitMap";
import { catchError, filter, map, switchMap, timeout } from "rxjs/operators";
import { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";

import logger from "../common/logger";
import { IParserHandles} from "../common/types";
import {delay} from "../common/util";
import { handleDiagnostic } from "../handles/diagnostic";
import {INode} from "../lib/vimparser";
import config from "./config";
import { workspace } from "./workspaces";

const log = logger("parser");

const parserHandles: IParserHandles = {};

const indexes: Record<string, boolean> = {};
const indexesFsPaths: Record<string, boolean> = {};

const origin$: Subject<TextDocument> = new Subject<TextDocument>();

const parserCallbacks: Record<string, (param: any) => void> = {}
const queueFsPaths: string[] = []

let scanProcess: ChildProcess;
let isScanRuntimepath: boolean = false;
let isParsing = false

function send(params: any): boolean {
  if (!scanProcess) {
    log.log('scan process do not exists')
    return false
  }
  if ((scanProcess as any).signalCode) {
    log.log(`scan process signal code: ${(scanProcess as any).signalCode}`)
    return false
  }
  if (scanProcess.killed) {
    log.log('scan process was killed')
    return false
  }
  scanProcess.send(params, (err) => {
    if (err) {
      log.warn(`Send error: ${err.stack || err.message || err.name}`)
    }
  })
  return true
}

function startIndex() {
  if (scanProcess) {
    return;
  }
  scanProcess = childProcess.fork(
    join(__dirname, "scan.js"),
    ["--node-ipc"],
  );

  scanProcess.on("message", (mess) => {
    const { msglog, id, res, error, fsPaths } = mess;

    if (msglog) {
      log.info(`child_log: ${msglog}`);
    }

    if (fsPaths) {
      parserFiles(fsPaths)
    }

    if (id && parserCallbacks[id]) {
      parserCallbacks[id]({
        res,
        error
      })
      delete parserCallbacks[id]
    }
  });

  scanProcess.on("error", (err: Error) => {
    log.warn(`${err.stack || err.message || err}`);
  });

  scanProcess.on('exit', (code, signal) => {
    log.log(`exit: ${code}, signal: ${signal}`);
  });

  scanProcess.on('close', (code, signal) => {
    log.log(`close: ${code}, signal: ${signal}`);
  });

  scanProcess.on('uncaughtException', (err) => {
    log.log(`Uncaught exception: ${err.stack || err.message || err.name || err}`);
  })

  scanProcess.on('disconnect', () => {
    log.log(`disconnect`);
  })

  send({
    config: {
      gap: config.indexes.gap,
      count: config.indexes.count,
      projectRootPatterns: config.indexes.projectRootPatterns,
    },
  })
}

export function next(
  textDoc: TextDocument,
  save: boolean,
) {
  if (!parserHandles[textDoc.uri]) {
    const { uri } = textDoc;
    parserHandles[uri] = origin$.pipe(
      filter((td: TextDocument) => uri === td.uri),
      switchMap((td: TextDocument) => {
        return timer(100).pipe(
          map(() => td),
        );
      }),
      waitMap((td: TextDocument) => {
        const id =  `${Date.now()}-${Math.random()}`
        return from(new Promise<{res: any, error: any, isTimeout?: boolean}>((res) => {
          parserCallbacks[id] = res
          send({
            id,
            uri,
            text: td.getText()
          })
        })).pipe(
          timeout(50000),
          catchError(() => {
            if (parserCallbacks[id]) {
              delete parserCallbacks[id]
            }
            scanProcess.kill()
            scanProcess = undefined
            return of({
              res: '',
              error: `Timeout: 50000ms`,
              isTimeout: true,
            })
          })
        )
      }, true),
    ).subscribe(
      (data) => {
        const { res, error, isTimeout } = data
        if (res) {
          if (config.diagnostic.enable) {
            // handle diagnostic
            handleDiagnostic(textDoc, res[1], save);
          }
          // handle node
          workspace.updateBuffer(uri, res[0]);
        }
        if (error) {
          log.error(`Parse ${uri} error: ${error}`)
        }
        if (isTimeout) {
          log.showErrorMessage(`Parse ${uri} error: ${error}`)
        }
        // scan project
        if (!indexes[uri]) {
          indexes[uri] = true;
          send({
            uri,
          })
          if (!isScanRuntimepath) {
            isScanRuntimepath = true;
            scanRuntimePaths([config.vimruntime].concat(config.runtimepath));
          }
        }
      },
      (err: Error) => {
        log.warn(`${err.stack || err.message || err}`);
      },
    );
  }
  if (!scanProcess) {
    startIndex();
  }
  origin$.next(textDoc);
}

export function unsubscribe(textDoc: TextDocument) {
  if (parserHandles[textDoc.uri] !== undefined) {
    parserHandles[textDoc.uri]!.unsubscribe();
  }
  parserHandles[textDoc.uri] = undefined;
}

// scan directory
export function scanRuntimePaths(paths: string | string[]) {
  if (!scanProcess) {
    startIndex();
  }
  if (config.indexes.runtimepath) {
    const list: string[] = [].concat(paths);

    for (let p of list) {
      if (!p) {
        continue;
      }
      p = p.trim();
      if (!p || p === "/") {
        continue;
      }
      const uri = URI.file(join(p, "f")).toString()
      if (!indexes[uri]) {
        indexes[uri] = true;
        send({
          uri
        })
      }
    }
  }
}

export async function parserFiles (paths: string[]) {
  queueFsPaths.push(...paths)
  if (isParsing) {
    return
  }
  isParsing = true
  while (queueFsPaths.length) {
    await Promise.all(
      Array(config.indexes.count).fill('').map(async () => {
        const fsPath = queueFsPaths.shift()
        if (!fsPath || indexesFsPaths[fsPath]) {
          return
        }
        indexesFsPaths[fsPath] = true
        const id = `${Date.now()}-${Math.random()}`
        const data = await new Promise<{res?: [INode | null, string], error: any, timeout?: boolean}>(res => {
          parserCallbacks[id] = res
          const isSend = send({
            id,
            fsPath
          })
          if (isSend) {
            setTimeout(() => {
              delete parserCallbacks[id]
              res({
                error: 'Timeout 50000ms',
                timeout: true
              })
            }, 50000);
          } else {
            queueFsPaths.unshift(fsPath)
            delete parserCallbacks[id]
            res({
              error: `Cancel parser since scan process does not exists`
            })
          }
        })
        if (data.res && data.res[0]) {
          const uri = URI.file(fsPath).toString()
          if (!workspace.isExistsBuffer(uri)) {
            workspace.updateBuffer(uri, data.res[0]);
          }
        }
        if (data.error) {
          log.error(`Parse ${fsPath} error: ${data.error}`)
        }
        if (data.timeout) {
          scanProcess.kill()
          scanProcess = undefined
          startIndex()
          log.showErrorMessage(`Parse ${fsPath} error: ${data.error}`)
        }
      })
    )
    await delay(config.indexes.gap)
  }
  isParsing = false
}
