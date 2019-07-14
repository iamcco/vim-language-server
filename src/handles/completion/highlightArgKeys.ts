/*
 * highlight arg keys
 *
 */
import { CompletionItem } from 'vscode-languageserver';
import { highlightLinkPattern, highlightPattern, highlightValuePattern } from '../../common/patterns';
import { builtinDocs } from '../../server/builtin';
import { useProvider } from './provider';

function provider(line: string): CompletionItem[] {
  if (
    !highlightLinkPattern.test(line) &&
    !highlightValuePattern.test(line) &&
    highlightPattern.test(line)
  ) {
    return builtinDocs.getHighlightArgKeys().filter(item => {
      return line.indexOf(item.label) === -1
    })
  }
  return []
}

useProvider(provider)
