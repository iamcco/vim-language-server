/*
 * vim builtin command
 *
 * - xxx
 */
import { CompletionItem } from 'vscode-languageserver';
import { isSomeMatchPattern } from '../../common/util';
import { commandPattern } from '../../common/patterns';
import { builtinDocs } from '../../server/builtin';
import { commandSnippets } from '../../server/snippets';
import { useProvider } from './provider';

function provider(line: string): CompletionItem[] {
  if (isSomeMatchPattern(commandPattern, line)) {
    return builtinDocs.getVimCommands().concat(commandSnippets)
  }
  return []
}

useProvider(provider)
