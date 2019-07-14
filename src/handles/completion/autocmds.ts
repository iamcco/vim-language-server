/*
 * autocmds
 *
 */
import { CompletionItem } from 'vscode-languageserver';
import { autocmdPattern } from '../../common/patterns';
import { builtinDocs } from '../../server/builtin';
import { useProvider } from './provider';

function provider(line: string): CompletionItem[] {
  if (autocmdPattern.test(line)) {
    return builtinDocs.getVimAutocmds().filter(item => {
      return line.indexOf(item.label) === -1
    })
  }
  return []
}

useProvider(provider)
