import { CompletionItem, CompletionItemKind, InsertTextFormat } from "vscode-languageserver";
import { markupSnippets } from "../common/util";

export const commandSnippets: CompletionItem[] = [
  {
    label: "func",
    kind: CompletionItemKind.Snippet,
    insertText: [
      "function ${1:Name}(${2}) ${3:abort}",
      "\t${0}",
      "endfunction",
    ].join("\n"),
    insertTextFormat: InsertTextFormat.Snippet,
  },
  {
    label: "tryc",
    kind: CompletionItemKind.Snippet,
    insertText: [
      "try",
      "\t${1}",
      "catch /.*/",
      "\t${0}",
      "endtry",
    ].join("\n"),
    insertTextFormat: InsertTextFormat.Snippet,
  },
  {
    label: "tryf",
    kind: CompletionItemKind.Snippet,
    insertText: [
      "try",
      "\t${1}",
      "finally",
      "\t${0}",
      "endtry",
    ].join("\n"),
    insertTextFormat: InsertTextFormat.Snippet,
  },
  {
    label: "trycf",
    kind: CompletionItemKind.Snippet,
    insertText: [
      "try",
      "\t${1}",
      "catch /.*/",
      "\t${2}",
      "finally",
      "\t${0}",
      "endtry",
    ].join("\n"),
    insertTextFormat: InsertTextFormat.Snippet,
  },
  {
    label: "aug",
    kind: CompletionItemKind.Snippet,
    insertText: [
      "augroup ${1:Start}",
      "\tautocmd!",
      "\t${0}",
      "augroup END",
    ].join("\n"),
    insertTextFormat: InsertTextFormat.Snippet,
  },
  {
    label: "aut",
    kind: CompletionItemKind.Snippet,
    insertText: [
      "autocmd ${1:group-event} ${2:pat} ${3:once} ${4:nested} ${5:cmd}",
    ].join("\n"),
    insertTextFormat: InsertTextFormat.Snippet,
  },
  {
    label: "if",
    kind: CompletionItemKind.Snippet,
    insertText: [
      "if ${1:condition}",
      "\t${0}",
      "endif",
    ].join("\n"),
    insertTextFormat: InsertTextFormat.Snippet,
  },
  {
    label: "cmd",
    kind: CompletionItemKind.Snippet,
    insertText: [
      "command! ${1:attr} ${2:cmd} ${3:rep} ${0}",
    ].join("\n"),
    insertTextFormat: InsertTextFormat.Snippet,
  },
  {
    label: "hi",
    kind: CompletionItemKind.Snippet,
    insertText: [
      "highlight ${1:default} ${2:group-name} ${3:args} ${0}",
    ].join("\n"),
    insertTextFormat: InsertTextFormat.Snippet,
  },
].map((item) => ({
  ...item,
  documentation: markupSnippets(item.insertText),
}));
