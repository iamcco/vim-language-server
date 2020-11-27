import childProcess, {ChildProcess} from "child_process";
import { join } from "path";
import { from, Subject, timer } from "rxjs";
import { waitMap } from "rxjs-operators/lib/waitMap";
import { filter, map, switchMap } from "rxjs/operators";
import { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";

import logger from "../common/logger";
import { IParserHandles} from "../common/types";
import { handleParse } from "../common/util";
import { handleDiagnostic } from "../handles/diagnostic";
import config from "./config";
import { workspace } from "./workspaces";

const log = logger("parser");

const parserHandles: IParserHandles = {};

const indexes: Record<string, boolean> = {};

const origin$: Subject<TextDocument> = new Subject<TextDocument>();

let scanProcess: ChildProcess;
let isScanRuntimepath: boolean = false;

function send(params: any) {
  if (!scanProcess) {
    log.log('scan process do not exists')
    return
  }
  if ((scanProcess as any).signalCode) {
    log.log(`scan process signal code: ${(scanProcess as any).signalCode}`)
    return
  }
  if (scanProcess.killed) {
    log.log('scan process was killed')
    return
  }
  scanProcess.send(params, (err) => {
    if (err) {
      log.warn(`Send error: ${err.stack || err.message || err.name}`)
    }
  })
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
    const { data, msglog } = mess;
    if (data) {
      if (!workspace.isExistsBuffer(data.uri)) {
        workspace.updateBuffer(data.uri, data.node);
      }
    }

    if (msglog) {
      log.info(`child_log: ${msglog}`);
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
        return from(handleParse(td));
      }, true),
    ).subscribe(
      (res) => {
        if (config.diagnostic.enable) {
          // handle diagnostic
          handleDiagnostic(textDoc, res[1]);
        }
        // handle node
        workspace.updateBuffer(uri, res[0]);
        // scan project
        if (!indexes[uri]) {
          indexes[uri] = true;
          send({
            uri,
          })
          if (!isScanRuntimepath) {
            isScanRuntimepath = true;
            scan([config.vimruntime].concat(config.runtimepath));
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
export function scan(paths: string | string[]) {
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
      send({
        uri: URI.file(join(p, "f")).toString(),
      })
    }
  }
}
