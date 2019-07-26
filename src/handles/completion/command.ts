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
import config from '../../server/config';

function provider(line: string): CompletionItem[] {
  if (isSomeMatchPattern(commandPattern, line)) {
    // only return snippets when snippetSupport is true
    if (config.snippetSupport) {
      return builtinDocs.getVimCommands().concat(commandSnippets)
    }
    return builtinDocs.getVimCommands()
  }
  return []
}

useProvider(provider)
