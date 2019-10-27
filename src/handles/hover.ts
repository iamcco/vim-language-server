import {
  Hover,
  TextDocumentPositionParams,
} from "vscode-languageserver";
import { getWordFromPosition } from "../common/util";
import { builtinDocs } from "../server/builtin";
import { documents } from "../server/documents";

export const hoverProvider = (
  params: TextDocumentPositionParams,
): Hover | undefined => {
  const { textDocument, position } = params;
  const doc = documents.get(textDocument.uri);
  if (!doc) {
    return;
  }

  const words = getWordFromPosition(doc, position);

  if (!words) {
    return;
  }

  return builtinDocs.getHoverDocument(
    words.word,
    words.wordLeft,
    words.wordRight,
  );
};
