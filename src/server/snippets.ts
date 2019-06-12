import { CompletionItem, CompletionItemKind, InsertTextFormat } from 'vscode-languageserver';
import { markupSnippets } from '../common/util';

export const commandSnippets: CompletionItem[] = [
  {
    label: 'function',
    kind: CompletionItemKind.Snippet,
    insertText: [
      'function ${1:Name}(${2}) ${3:abort}',
      '\t${0}',
      'endfunction'
    ].join('\n'),
    insertTextFormat: InsertTextFormat.Snippet
  },
  {
    label: 'trycatch',
    kind: CompletionItemKind.Snippet,
    insertText: [
      'try',
      '\t${1}',
      'catch /.*/',
      '\t${0}',
      'endtry'
    ].join('\n'),
    insertTextFormat: InsertTextFormat.Snippet
  },
  {
    label: 'tryfinally',
    kind: CompletionItemKind.Snippet,
    insertText: [
      'try',
      '\t${1}',
      'finally',
      '\t${0}',
      'endtry'
    ].join('\n'),
    insertTextFormat: InsertTextFormat.Snippet
  },
  {
    label: 'trycatchfinally',
    kind: CompletionItemKind.Snippet,
    insertText: [
      'try',
      '\t${1}',
      'catch /.*/',
      '\t${2}',
      'finally',
      '\t${0}',
      'endtry'
    ].join('\n'),
    insertTextFormat: InsertTextFormat.Snippet
  },
  {
    label: 'augroup',
    kind: CompletionItemKind.Snippet,
    insertText: [
      'augroup ${1:Start}',
      '\tautocmd!',
      '\t${0}',
      'augroup END'
    ].join('\n'),
    insertTextFormat: InsertTextFormat.Snippet
  },
  {
    label: 'autocmd',
    kind: CompletionItemKind.Snippet,
    insertText: [
      "autocmd ${1:group} ${2:event} ${3:pat} ${4:once} ${5:nested} ${6:cmd}"
    ].join('\n'),
    insertTextFormat: InsertTextFormat.Snippet
  },
  {
    label: 'if',
    kind: CompletionItemKind.Snippet,
    insertText: [
      "if ${1:condition}",
      "\t${0}",
      "endif"
    ].join('\n'),
    insertTextFormat: InsertTextFormat.Snippet
  },
  {
    label: 'command',
    kind: CompletionItemKind.Snippet,
    insertText: [
      "command! ${1:attr} ${2:cmd} ${3:rep} ${0}",
    ].join('\n'),
    insertTextFormat: InsertTextFormat.Snippet
  },
  {
    label: 'highlight',
    kind: CompletionItemKind.Snippet,
    insertText: [
      "highlight ${1:default} ${2:group-name} ${3:key}=${4:arg} ${0}",
    ].join('\n'),
    insertTextFormat: InsertTextFormat.Snippet
  }
].map(item => ({
  ...item,
  documentation: markupSnippets(item.insertText)
}))
