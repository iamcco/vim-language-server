import os from 'os';
import { Subscription, from, of } from 'rxjs';
import fg from 'fast-glob';
import { join } from 'path';
import { mergeMap, switchMap, filter, map, catchError } from 'rxjs/operators';
import vscUri from 'vscode-uri';

import { readFileSync } from 'fs';
import logger from '../common/logger';
import { workspace } from './workspaces';
import { handleParse, findWorkDirectory } from '../common/util';
import { workDirPatterns } from '../common/constant';

const log = logger('scan')

const handScans: Record<string, Subscription> = {}

export async function scan(uri: string) {
  const workDir = await findWorkDirectory(
    vscUri.parse(uri).fsPath,
    workDirPatterns
  )
  if (!workDir || workDir === os.homedir()) {
    return
  }
  if (!handScans[workDir]) {
    handScans[workDir] = from(fg<string>([join(workDir, '**/*.vim'), '!**/node_modules/**'])).pipe(
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
            log.error(`${fpath}:\n${error.stack || error.message || error}`)
            return of(undefined)
          })
        )
      }, 3),
    ).subscribe(
      (res) => {
        if (res) {
          workspace.updateBuffer(res.uri, res.node)
        }
      },
      (error) => {
        log.error(error.stack || error.message || error)
      }
    )
  }
}
