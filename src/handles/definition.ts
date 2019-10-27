import { Location, TextDocumentPositionParams } from "vscode-languageserver";
import { getWordFromPosition } from "../common/util";
import { documents } from "../server/documents";
import { workspace } from "../server/workspaces";

export const definitionProvider = (params: TextDocumentPositionParams): Location[] | null => {
  const { textDocument, position } = params;
  const doc = documents.get(textDocument.uri);
  if (!doc) {
    return null;
  }
  const words = getWordFromPosition(doc, position);
  if (!words) {
    return null;
  }
  let currentName = words.word;
  if (/\./.test(words.right)) {
    const tail = words.right.replace(/^[^.]*(\.)/, "$1");
    currentName = words.word.replace(tail, "");
  }
  return workspace.getLocations(currentName, doc.uri, position, "definition").locations;
};
