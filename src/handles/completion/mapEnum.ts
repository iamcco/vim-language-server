/*
 * map defined args
 *
 * <buffer>
 * ...
 */
import { CompletionItem } from 'vscode-languageserver';
import { mapCommandPattern } from '../../common/patterns';
import { builtinDocs } from '../../server/builtin';
import { useProvider } from './provider';

function provider(line: string): CompletionItem[] {
  if (mapCommandPattern.test(line)) {
    if (/<$/.test(line)) {
      return builtinDocs.getVimMapArgs().map(item => ({
        ...item,
        insertText: item.insertText!.slice(1)
      }))
    }
    return builtinDocs.getVimMapArgs()
  }
  return []
}

useProvider(provider)
