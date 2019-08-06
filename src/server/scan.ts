import os from 'os';
import { from, of, Subject, timer, Observable } from 'rxjs';
import fg from 'fast-glob';
import { join } from 'path';
import { mergeMap, filter, map, catchError, concatMap } from 'rxjs/operators';
import vscUri from 'vscode-uri';

import { readFileSync } from 'fs';
import { handleParse, findWorkDirectory } from '../common/util';
import { workDirPatterns } from '../common/constant';

const indexes: Record<string, boolean> = {}
const indexesFiles: Record<string, boolean> = {}
let queue: any[] = []
let source$: Subject<string>
let gap: number = 100
let count: number = 3

function initSource() {
  if (source$) {
    return
  }
  source$ = new Subject<string>()
  source$.pipe(
    concatMap(uri => {
      return from(findWorkDirectory(
        vscUri.parse(uri).fsPath,
        workDirPatterns
      )).pipe(
        filter(workDir => workDir && workDir !== os.homedir()),
        map(workDir => ({
          uri,
          workDir
        }))
      )
    }),
    filter(({ workDir }) => {
      if (!indexes[workDir]) {
        indexes[workDir] = true
        return true
      }
      return false
    }),
    concatMap(({ workDir }) => {
      const indexPath = join(workDir, '**/*.vim')
      return from(fg<string>([indexPath, '!**/node_modules/**'])).pipe(
        catchError(error => {
          process.send({
            log: [
              `Index Workspace Error: ${indexPath}`,
              `Error => ${error.stack || error.message || error}`
            ].join('\n')
          })
          return of(undefined)
        }),
        filter(list => list && list.length > 0),
        concatMap<string[], Observable<string>>(list => {
          return of(...list.sort((a, b) => a.length - b.length)).pipe(
            filter(fpath => {
              if (!indexesFiles[fpath]) {
                indexesFiles[fpath] = true
                return true
              }
              return false
            }),
            mergeMap((fpath) => {
              return timer(gap).pipe(
                concatMap(() => {
                  const content = readFileSync(fpath).toString()
                  return from(handleParse(content)).pipe(
                    filter(res => res[0] !== null),
                    map(res => ({
                      node: res[0],
                      uri: vscUri.file(fpath).toString()
                    })),
                    catchError(error => {
                      process.send({
                        log: `${fpath}:\n${error.stack || error.message || error}`
                      })
                      return of(undefined)
                    })
                  )
                })
              )
            }, count),
          )
        }),
      )
    }),
    filter(res => !!res)
  ).subscribe(
    (res) => {
      process.send({
        data: res
      })
    },
    (error) => {
      process.send({
        log: error.stack || error.message || error
      })
    }
  )
  if (queue.length) {
    queue.forEach(uri => {
      source$.next(uri)
    })
    queue = []
  }
}

process.on('message', (mess) => {
  const { uri, config } = mess
  if (uri) {
    if (source$) {
      source$.next(uri)
    } else {
      queue.push(uri)
    }
  }
  if (config) {
    if (config.gap !== undefined) {
      gap = config.gap
    }
    if (config.count !== undefined) {
      count = config.count
    }
    initSource()
  }
})
