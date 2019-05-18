import { CompletionItem } from 'vscode-languageserver';
import { builtinDocs } from '../server/builtin';

export const completionResolveProvider = (params: CompletionItem): CompletionItem | undefined => {
  return builtinDocs.getDocumentByCompletionItem(params)
}
