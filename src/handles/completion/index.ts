import {
  CompletionParams,
  CompletionItem,
  Range,
  Position
} from 'vscode-languageserver';

import './function'
import './builtinVariable'
import './command'
import './option'
import './hasEnum'
import './mapEnum'
import './expandEnum'
import './colorscheme'
import './highlightArgKeys'
import './highlightArgValues'
import './identifier'
import './autocmds'
import { getProvider } from './provider';
import { documents } from '../../server/documents';

const provider = getProvider()

export const completionProvider = (params: CompletionParams): CompletionItem[] => {

  const { textDocument, position } = params
  const textDoc = documents.get(textDocument.uri)
  if (textDoc) {
    const line = textDoc.getText(Range.create(
      Position.create(position.line, 0),
      position
    ))
    return provider(line, textDoc.uri, position, [])
  }
  return []
}
