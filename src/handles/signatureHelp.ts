import {
  TextDocumentPositionParams,
  Range,
  Position,
  SignatureHelp
} from 'vscode-languageserver';
import { builtinDocs } from '../server/builtin';
import { commentPattern } from '../common/patterns';
import { documents } from '../server/documents';

export const signatureHelpProvider =
  (params: TextDocumentPositionParams): SignatureHelp | undefined => {
    const { textDocument, position } = params
    const doc = documents.get(textDocument.uri)
    if (!doc) {
      return
    }

    const currentLine = doc.getText(
      Range.create(
        Position.create(position.line, 0),
        Position.create(position.line + 1, 0)
      )
    )

    // comment line
    if (commentPattern.test(currentLine)) {
      return
    }

    const preSegment = currentLine.slice(0, position.character)

    const m = preSegment.match(/([\w#&:]+)[ \t]*\([^)]*$/)
    if (!m) {
      return
    }
    const functionName = m['1']
    const placeIdx = m[0].split(',').length - 1
    return builtinDocs.getSignatureHelpByName(functionName, placeIdx)
  }
