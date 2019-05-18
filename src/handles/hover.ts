import {
  TextDocumentPositionParams,
  Hover,
} from 'vscode-languageserver';
import { builtinDocs } from '../server/builtin';
import { documents } from '../server/documents';
import { getWordFromPosition } from '../common/util';

export const hoverProvider = (
  params: TextDocumentPositionParams
): Hover | undefined => {
  const { textDocument, position } = params
  const doc = documents.get(textDocument.uri)
  if (!doc) {
    return
  }

  const words = getWordFromPosition(doc, position)

  if (!words) {
    return
  }

  return builtinDocs.getHoverDocument(
    words.word,
    words.wordLeft,
    words.wordRight
  )
}
