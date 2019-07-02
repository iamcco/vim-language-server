import os from 'os';
import { from, of, Subject } from 'rxjs';
import fg from 'fast-glob';
import { join } from 'path';
import { mergeMap, switchMap, filter, map, catchError, concatMap } from 'rxjs/operators';
import vscUri from 'vscode-uri';

import { readFileSync } from 'fs';
import { handleParse, findWorkDirectory } from '../common/util';
import { workDirPatterns } from '../common/constant';

const source$ = new Subject<string>()
const indexs: Record<string, boolean> = {}

source$.pipe(
  mergeMap(uri => {
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
    if (!indexs[workDir]) {
      indexs[workDir] = true
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
      switchMap(list => {
        return of(...list)
      }),
      mergeMap((fpath) => {
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
      }, 3),
    )
  }),
  filter(res => res)
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

process.on('message', (mess) => {
  const { uri } = mess
  if (uri) {
    source$.next(uri)
  }
})
