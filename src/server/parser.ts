import childProcess, {ChildProcess} from "child_process";
import { homedir } from "os";
import { join } from "path";
import { from, Subject, timer } from "rxjs";
import { waitMap } from "rxjs-operators/lib/waitMap";
import { filter, map, switchMap } from "rxjs/operators";
import { TextDocument } from "vscode-languageserver";
import vscUri from "vscode-uri";

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
    log.error(`${err.stack || err.message || err}`);
  });

  scanProcess.send({
    config: {
      count: config.indexes.count,
      gap: config.indexes.gap,
      projectRootPatterns: config.indexes.projectRootPatterns,
    },
  });
}

export function next(
  textDoc: TextDocument,
) {
  if (!parserHandles[textDoc.uri]) {
    const { uri } = textDoc;
    parserHandles[uri] = origin$.pipe(
      filter((textDoc: TextDocument) => uri === textDoc.uri),
      switchMap((textDoc: TextDocument) => {
        return timer(100).pipe(
          map(() => textDoc),
        );
      }),
      waitMap((textDoc: TextDocument) => {
        return from(handleParse(textDoc));
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
          scanProcess.send({
            uri,
          });
          if (!isScanRuntimepath) {
            isScanRuntimepath = true;
            scan([config.vimruntime].concat(config.runtimepath));
          }
        }
      },
      (err: Error) => {
        log.error(`${err.stack || err.message || err}`);
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

    for (let idx = 0; idx < list.length; idx++) {
      let p = list[idx];
      if (!p) {
        continue;
      }
      p = p.trim();
      if (!p || p === "/") {
        continue;
      }
      scanProcess.send({
        uri: vscUri.file(join(p, "f")).toString(),
      });
    }
  }
}
