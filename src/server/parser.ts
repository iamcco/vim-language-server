import { homedir } from 'os';
import { join } from 'path';
import childProcess, {ChildProcess} from 'child_process';
import { Subject, timer, from } from 'rxjs';
import { switchMap, map, filter } from 'rxjs/operators';
import { TextDocument } from 'vscode-languageserver';
import { waitMap } from 'rxjs-operators/lib/waitMap';
import vscUri from 'vscode-uri';

import { handleDiagnostic } from '../handles/diagnostic';
import { workspace } from './workspaces';
import { handleParse } from '../common/util';
import { IParserHandles} from '../common/types';
import logger from '../common/logger';
import config from './config';

const log = logger('parser')

const parserHandles: IParserHandles = {}

const indexes: Record<string, boolean> = {}

const origin$: Subject<TextDocument> = new Subject<TextDocument>()

let scanProcess: ChildProcess
let isScanRuntimepath: boolean = false

function startIndex() {
  if (scanProcess) {
    return
  }
  scanProcess = childProcess.fork(
    join(__dirname, 'scan.js'),
    ['--node-ipc']
  )

  scanProcess.on('message', (mess) => {
    const { data, log } = mess
    if (data) {
      if (!workspace.isExistsBuffer(data.uri)) {
        workspace.updateBuffer(data.uri, data.node)
      }
    }
    if (log) {
      log.info(`child_log: ${mess.log}`)
    }
  })

  scanProcess.on('error', (err: Error) => {
    log.error(`${err.stack || err.message || err}`)
  })

  scanProcess.send({
    config: {
      gap: config.indexes.gap,
      count: config.indexes.count
    }
  })
}


export function next(
  textDoc: TextDocument,
) {
  if (!parserHandles[textDoc.uri]) {
    const { uri } = textDoc
    parserHandles[uri] = origin$.pipe(
      filter((textDoc: TextDocument) => uri === textDoc.uri),
      switchMap((textDoc: TextDocument) => {
        return timer(100).pipe(
          map(() => textDoc)
        )
      }),
      waitMap((textDoc: TextDocument) => {
        return from(handleParse(textDoc))
      }, true)
    ).subscribe(
      (res) => {
        if (config.diagnostic.enable) {
          // handle diagnostic
          handleDiagnostic(textDoc, res[1])
        }
        // handle node
        workspace.updateBuffer(uri, res[0])
        // scan project
        if (!indexes[uri]) {
          indexes[uri] = true
          scanProcess.send({
            uri
          })
          if (!isScanRuntimepath) {
            isScanRuntimepath = true
            scan([config.vimruntime].concat(config.runtimepath))
          }
        }
      },
      (err: Error) => {
        log.error(`${err.stack || err.message || err}`)
      }
    )
  }
  if (!scanProcess) {
    startIndex()
  }
  origin$.next(textDoc)
}

export function unsubscribe(textDoc: TextDocument) {
  if (parserHandles[textDoc.uri] !== undefined) {
    parserHandles[textDoc.uri]!.unsubscribe()
  }
  parserHandles[textDoc.uri] = undefined
}

// scan dirtory
export function scan(paths: string | string[]) {
  if (!scanProcess) {
    startIndex()
  }
  if (config.indexes.runtimepath) {
    const list: string[] = [].concat(paths)

    for (let idx = 0; idx < list.length; idx++) {
      let p = list[idx]
      if (!p) {
        continue
      }
      p = p.trim();
      if (!p || p === '/') {
        continue
      }
      scanProcess.send({
        uri: vscUri.file(join(p, 'f')).toString()
      })
    }
  }
}
