import fg from "fast-glob";
import os from "os";
import { join } from "path";
import { from, Observable, of, Subject, timer } from "rxjs";
import { catchError, concatMap, filter, map, mergeMap, switchMap } from "rxjs/operators";
import { URI } from "vscode-uri";

import { readFileSync } from "fs";
import { projectRootPatterns } from "../common/constant";
import { findProjectRoot, getRealPath, handleParse } from "../common/util";

const indexes: Record<string, boolean> = {};
const indexesFiles: Record<string, boolean> = {};
let queue: any[] = [];
let source$: Subject<string>;
let gap: number = 100;
let count: number = 3;
let customProjectRootPatterns = projectRootPatterns;

function initSource() {
  if (source$) {
    return;
  }
  source$ = new Subject<string>();
  source$.pipe(
    concatMap((uri) => {
      return from(findProjectRoot(
        URI.parse(uri).fsPath,
        customProjectRootPatterns,
      )).pipe(
        switchMap((projectRoot) => {
          return from(getRealPath(projectRoot));
        }),
        filter((projectRoot) => projectRoot && projectRoot !== os.homedir()),
        map((projectRoot) => ({
          uri,
          projectRoot,
        })),
      );
    }),
    filter(({ projectRoot }) => {
      if (!indexes[projectRoot]) {
        indexes[projectRoot] = true;
        return true;
      }
      return false;
    }),
    concatMap(({ projectRoot }) => {
      const indexPath = join(projectRoot, "**/*.vim");
      return from(fg([indexPath, "!**/node_modules/**"])).pipe(
        catchError((error) => {
          process.send({
            msglog: [
              `Index Workspace Error: ${indexPath}`,
              `Error => ${error.stack || error.message || error}`,
            ].join("\n"),
          });
          return of(undefined);
        }),
        filter((list) => list && list.length > 0),
        concatMap<string[], Observable<string>>((list) => {
          return of(...list.sort((a, b) => a.length - b.length)).pipe(
            filter((fpath) => {
              if (!indexesFiles[fpath]) {
                indexesFiles[fpath] = true;
                return true;
              }
              return false;
            }),
            mergeMap((fpath) => {
              return timer(gap).pipe(
                concatMap(() => {
                  const content = readFileSync(fpath).toString();
                  return from(handleParse(content)).pipe(
                    filter((res) => res[0] !== null),
                    map((res) => ({
                      node: res[0],
                      uri: URI.file(fpath).toString(),
                    })),
                    catchError((error) => {
                      process.send({
                        msglog: `${fpath}:\n${error.stack || error.message || error}`,
                      });
                      return of(undefined);
                    }),
                  );
                }),
              );
            }, count),
          );
        }),
      );
    }),
    filter((res) => !!res),
  ).subscribe(
    (res) => {
      process.send({
        data: res,
      });
    },
    (error) => {
      process.send({
        msglog: error.stack || error.message || error,
      });
    },
  );
  if (queue.length) {
    queue.forEach((uri) => {
      source$.next(uri);
    });
    queue = [];
  }
}

process.on("message", (mess) => {
  const { uri, config } = mess;
  if (uri) {
    if (source$) {
      source$.next(uri);
    } else {
      queue.push(uri);
    }
  }
  if (config) {
    if (config.gap !== undefined) {
      gap = config.gap;
    }
    if (config.count !== undefined) {
      count = config.count;
    }
    if (config.projectRootPatterns !== undefined) {
      customProjectRootPatterns = config.projectRootPatterns;
    }
    initSource();
  }
});
