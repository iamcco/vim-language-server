/*
 * vim function provider
 *
 * - builtin vim function
 * - builtin neovim api function
 * - g:xxx
 * - s:xxx
 * - xx#xxx
 * - Xxx
 */
import { CompletionItem, Position } from 'vscode-languageserver';
import { workspace } from '../../server/workspaces';
import config from '../../server/config';
import { isSomeMatchPattern } from '../../common/util';
import { notFunctionPattern } from '../../common/patterns';
import { builtinDocs } from '../../server/builtin';
import { useProvider } from './provider';

function provider(line: string, uri: string, position: Position): CompletionItem[] {
  if (/\b(g:|s:|<SID>)\w*$/.test(line)) {
    let list: CompletionItem[] = []
    if (/\bg:\w*$/.test(line)) {
      list = workspace.getFunctionItems(uri)
        .filter(item => /^g:/.test(item.label))
    } else if (/\b(s:|<SID>)\w*$/i.test(line)) {
      list = workspace.getFunctionItems(uri)
        .filter(item => /^s:/.test(item.label))
    }
    return list.map(item => ({
      ...item,
      insertText: !/:/.test(config.iskeyword) ? item.insertText.slice(2) : item.insertText
    }))
  } else if (/\B:\w*$/.test(line)) {
    return workspace.getFunctionItems(uri)
      .filter(item => /:/.test(item.label))
      .map(item => {
        const m = line.match(/:[^:]*$/)
        return {
          ...item,
          // delete the `:` symbol
          textEdit: {
            range: {
              start: {
                line: position.line,
                character: line.length - m[0].length
              },
              end: {
                line: position.line,
                character: line.length - m[0].length + 1
              }
            },
            newText: item.insertText
          }
        }
      })
  } else if (isSomeMatchPattern(notFunctionPattern, line)) {
    return []
  }
  return workspace.getFunctionItems(uri)
    .filter(item => {
      return !builtinDocs.isBuiltinFunction(item.label)
    })
    .concat(
      builtinDocs.getBuiltinVimFunctions()
    )
}

useProvider(provider)
