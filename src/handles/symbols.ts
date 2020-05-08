import {DocumentHighlight, TextDocumentPositionParams} from "vscode-languageserver";

import {getWordFromPosition} from "../common/util";
import { documents } from "../server/documents";
import {workspace} from "../server/workspaces";

export const documentHighlightProvider = ((params: TextDocumentPositionParams): DocumentHighlight[] => {
  const { textDocument, position } = params;
  const doc = documents.get(textDocument.uri);
  if (!doc) {
    return [];
  }
  const words = getWordFromPosition(doc, position);
  if (!words) {
    return [];
  }

  let currentName = words.word;
  if (/\./.test(words.right)) {
    const tail = words.right.replace(/^[^.]*(\.)/, "$1");
    currentName = words.word.replace(tail, "");
  }

  const defs = workspace.getLocationsByUri(currentName, doc.uri, position, "definition");
  const refs = workspace.getLocationsByUri(currentName, doc.uri, position, "references");

  return defs.locations.concat(refs.locations)
    .map<DocumentHighlight>((location) => {
      return {
        range: location.range,
      };
    });
});
