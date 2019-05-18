/*
 * vim builtin variable
 *
 * - v:xxx
 */
import { CompletionItem } from 'vscode-languageserver';
import { isSomeMatchPattern } from '../../common/util';
import { builtinVariablePattern } from '../../common/patterns';
import { builtinDocs } from '../../server/builtin';
import { useProvider } from './provider';

function provider(line: string): CompletionItem[] {
  if (isSomeMatchPattern(builtinVariablePattern, line)) {
    return builtinDocs.getPredefinedVimVariables()
  }
  return []
}

useProvider(provider)
