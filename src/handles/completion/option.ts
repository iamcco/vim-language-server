/*
 * vim options
 *
 * - &xxxx
 */
import { isSomeMatchPattern } from '../../common/util';
import { optionPattern } from '../../common/patterns';
import { CompletionItem } from 'vscode-languageserver';
import { builtinDocs } from '../../server/builtin';
import { useProvider } from './provider';

function provider(line: string): CompletionItem[] {
  if (isSomeMatchPattern(optionPattern, line)) {
    return builtinDocs.getVimOptions()
  }
  return []
}

useProvider(provider)
