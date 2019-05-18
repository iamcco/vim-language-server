import { IParserHandles} from '../common/types';
import { Subject, timer, from } from 'rxjs';
import { switchMap, map, filter } from 'rxjs/operators';
import {
  TextDocument,
  Connection,
} from 'vscode-languageserver';
import { waitMap } from 'rxjs-operators/lib/waitMap';

import { handleDiagnostic } from '../handles/diagnostic';
import { workspace } from './workspaces';
import { handleParse } from '../common/util';
import { scan } from './scan';

const parserHandles: IParserHandles = {}

const origin$: Subject<TextDocument> = new Subject<TextDocument>()

export function next(
  textDoc: TextDocument,
  con: Connection
) {
  if (!parserHandles[textDoc.uri]) {
    const { languageId, uri } = textDoc
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
        // handle diagnostic
        handleDiagnostic(textDoc, res[1])
        // handle node
        workspace.updateBuffer(uri, res[0])
        // scan project
        scan(uri)
      },
      (err: Error) => {
        con.console.error(`[${languageId}]: parse buffer error: ${err.message}`)
      }
    )
  }
  origin$.next(textDoc)
}

export function unsubscribe(textDoc: TextDocument) {
  if (parserHandles[textDoc.uri] !== undefined) {
    parserHandles[textDoc.uri]!.unsubscribe()
  }
  parserHandles[textDoc.uri] = undefined
}
