import fg from "fast-glob";
import {readFileSync} from "fs";
import os from "os";
import { join } from "path";
import { from, of, Subject } from "rxjs";
import { catchError, concatMap, filter, map, switchMap } from "rxjs/operators";
import { URI } from "vscode-uri";

import { projectRootPatterns } from "../common/constant";
import { findProjectRoot, getRealPath, handleParse } from "../common/util";

const indexes: Record<string, boolean> = {};
let queue: any[] = [];
let source$: Subject<string>;
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
        map(list => list.sort((a: string, b: string) => a.length - b.length))
      );
    }),
  ).subscribe(
    (fsPaths: string[]) => {
      process.send({
        fsPaths
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
  const { uri, config, id, text, fsPath } = mess;
  if (uri) {
    if (source$) {
      source$.next(uri);
    } else {
      queue.push(uri);
    }
  }
  if (config) {
    if (config.projectRootPatterns !== undefined) {
      customProjectRootPatterns = config.projectRootPatterns;
    }
    initSource();
  }
  // parse string
  if (id) {
    let content = text
    if (fsPath && content === undefined) {
      content = readFileSync(fsPath).toString();
    }
    process.nextTick(() => {
      handleParse(content).then(res => {
        process.send({
          id,
          res
        });
      }).catch(error => {
        process.send({
          id,
          error: `${error.stack || error.message || error}`
        });
      })
    })
  }
});
