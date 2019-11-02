/*
 * vim builtin completion items
 *
 * 1. functions
 * 2. options
 * 3. variables
 * 4. commands
 * 5. has features
 * 6. expand Keyword
 */
import { readFile, writeFileSync } from "fs";
import { join } from "path";

import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
} from "vscode-languageserver";
import { sortTexts } from "../common/constant";
import { pcb } from "../common/util";

interface IConfig {
  vimruntime: string;
}

const EVAL_PATH = "/doc/eval.txt";
const OPTIONS_PATH = "/doc/options.txt";
const INDEX_PATH = "/doc/index.txt";
const API_PATH = "/doc/api.txt";
const AUTOCMD_PATH = "/doc/autocmd.txt";

class Server {

  // completion items
  public vimPredefinedVariablesItems: CompletionItem[] = [];
  public vimOptionItems: CompletionItem[] = [];
  public vimBuiltinFunctionItems: CompletionItem[] = [];
  public vimCommandItems: CompletionItem[] = [];
  public vimFeatureItems: CompletionItem[] = [];
  public vimExpandKeywordItems: CompletionItem[] = [];
  public vimAutocmdItems: CompletionItem[] = [];

  // documents
  public vimBuiltFunctionDocuments: Record<string, string[]> = {};
  public vimOptionDocuments: Record<string, string[]> = {};
  public vimPredefinedVariableDocuments: Record<string, string[]> = {};
  public vimCommandDocuments: Record<string, string[]> = {};
  public vimFeatureDocuments: Record<string, string[]> = {};
  public expandKeywordDocuments: Record<string, string[]> = {};

  // signature help
  public vimBuiltFunctionSignatureHelp: Record<string, string[]> = {};

  // raw docs
  private text: Record<string, string[]> = {};
  constructor(private config: IConfig) {}

  public async build() {
    const { vimruntime } = this.config;
    if (vimruntime) {
      const paths = [EVAL_PATH, OPTIONS_PATH, INDEX_PATH, API_PATH, AUTOCMD_PATH];
      // tslint:disable-next-line: prefer-for-of
      for (let index = 0; index < paths.length; index++) {
        const p = join(vimruntime, paths[index]);
        const [err, data]: [Error, Buffer] = await pcb(readFile)(p, "utf-8");
        if (err) {
          // tslint:disable-next-line: no-console
          console.error(`[vimls]: read ${p} error: ${ err.message}`);
        }
        this.text[paths[index]] = (data && data.toString().split("\n")) || [];
      }
      this.resolveVimPredefinedVariables();
      this.resolveVimOptions();
      this.resolveBuiltinFunctions();
      this.resolveBuiltinFunctionsDocument();
      this.resolveBuiltinNvimFunctions();
      this.resolveExpandKeywords();
      this.resolveVimCommands();
      this.resolveVimFeatures();
      this.resolveVimAutocmds();
    }
  }

  public serialize() {
    const str = JSON.stringify({
      completionItems: {
        commands: this.vimCommandItems,
        functions: this.vimBuiltinFunctionItems,
        variables: this.vimPredefinedVariablesItems,
        options: this.vimOptionItems,
        features: this.vimFeatureItems,
        expandKeywords: this.vimExpandKeywordItems,
        autocmds: this.vimAutocmdItems,
      },
      signatureHelp: this.vimBuiltFunctionSignatureHelp,
      documents: {
        commands: this.vimCommandDocuments,
        functions: this.vimBuiltFunctionDocuments,
        variables: this.vimPredefinedVariableDocuments,
        options: this.vimOptionDocuments,
        features: this.vimFeatureDocuments,
        expandKeywords: this.expandKeywordDocuments,
      },
    }, null, 2);
    writeFileSync("./src/docs/builtin-docs.json", str, "utf-8");
  }

  private formatFunctionSnippets(fname: string, snippets: string): string {
    if (snippets === "") {
      return `${fname}(\${0})`;
    }
    let idx = 0;
    if (/^\[.+\]/.test(snippets)) {
      return `${fname}(\${1})\${0}`;
    }
    const str = snippets.split("[")[0].trim().replace(/\{?(\w+)\}?/g, (m, g1) => {
      return `\${${idx += 1}:${g1}}`;
    });
    return `${fname}(${str})\${0}`;
  }

  // get vim predefined variables from vim document eval.txt
  private resolveVimPredefinedVariables() {
    const evalText = this.text[EVAL_PATH] || [];
    let isMatchLine = false;
    let completionItem: CompletionItem;
    for (const line of evalText) {
      if (!isMatchLine) {
        if (/\*vim-variable\*/.test(line)) {
          isMatchLine = true;
        }
        continue;
      } else {
        const m = line.match(/^(v:[^ \t]+)[ \t]+([^ ].*)$/);
        if (m) {
          if (completionItem) {
            this.vimPredefinedVariablesItems.push(completionItem);
            this.vimPredefinedVariableDocuments[completionItem.label].pop();
            completionItem = undefined;
          }
          const label = m[1];
          completionItem = {
            label,
            kind: CompletionItemKind.Variable,
            sortText: sortTexts.four,
            insertText: label.slice(2),
            insertTextFormat: InsertTextFormat.PlainText,
          };
          if (!this.vimPredefinedVariableDocuments[label]) {
            this.vimPredefinedVariableDocuments[label] = [];
          }
          this.vimPredefinedVariableDocuments[label].push(m[2]);

        } else if (/^\s*$/.test(line) && completionItem) {
          this.vimPredefinedVariablesItems.push(completionItem);
          completionItem = undefined;
        } else if (completionItem) {
          this.vimPredefinedVariableDocuments[completionItem.label].push(
            line,
          );
        } else if (/===============/.test(line)) {
          break;
        }
      }
    }
  }

  // get vim options from vim document options.txt
  private resolveVimOptions() {
    const optionsText: string[] = this.text[OPTIONS_PATH] || [];
    let isMatchLine = false;
    let completionItem: CompletionItem;
    for (const line of optionsText) {
      if (!isMatchLine) {
        if (/\*'aleph'\*/.test(line)) {
          isMatchLine = true;
        }
        continue;
      } else {
        const m = line.match(/^'([^']+)'[ \t]+('[^']+')?[ \t]+([^ \t].*)$/);
        if (m) {
          const label = m[1];
          completionItem = {
            label,
            kind: CompletionItemKind.Property,
            detail: m[3].trim().split(/[ \t]/)[0],
            documentation: "",
            sortText: "00004",
            insertText: m[1],
            insertTextFormat: InsertTextFormat.PlainText,
          };
          if (!this.vimOptionDocuments[label]) {
            this.vimOptionDocuments[label] = [];
          }
          this.vimOptionDocuments[label].push(m[3]);
        } else if (/^\s*$/.test(line) && completionItem) {
          this.vimOptionItems.push(completionItem);
          completionItem = undefined;
        } else if (completionItem) {
          this.vimOptionDocuments[completionItem.label].push(
            line,
          );
        }
      }
    }
  }

  // get vim builtin function from document eval.txt
  private resolveBuiltinFunctions() {
    const evalText = this.text[EVAL_PATH] || [];
    let isMatchLine = false;
    let completionItem: CompletionItem;
    for (const line of evalText) {
      if (!isMatchLine) {
        if (/\*functions\*/.test(line)) {
          isMatchLine = true;
        }
        continue;
      } else {
        const m = line.match(/^((\w+)\(([^)]*)\))[ \t]*([^ \t].*)?$/);
        if (m) {
          if (completionItem) {
            this.vimBuiltinFunctionItems.push(completionItem);
          }
          const label = m[2];
          completionItem = {
            label,
            kind: CompletionItemKind.Function,
            detail: (m[4] || "").split(/[ \t]/)[0],
            sortText: "00004",
            insertText: this.formatFunctionSnippets(m[2], m[3]),
            insertTextFormat: InsertTextFormat.Snippet,
          };
          this.vimBuiltFunctionSignatureHelp[label] = [
            m[3],
            (m[4] || "").split(/[ \t]/)[0],
          ];
        } else if (/^[ \t]*$/.test(line)) {
          if (completionItem) {
            this.vimBuiltinFunctionItems.push(completionItem);
            completionItem = undefined;
            break;
          }
        } else if (completionItem) {
          if (completionItem.detail === "") {
            completionItem.detail = line.trim().split(/[ \t]/)[0];
            if (this.vimBuiltFunctionSignatureHelp[completionItem.label]) {
              this.vimBuiltFunctionSignatureHelp[completionItem.label][1] = line.trim().split(/[ \t]/)[0];
            }
          }
        }
      }
    }
  }

  private resolveBuiltinFunctionsDocument() {
    const evalText = this.text[EVAL_PATH] || [];
    let isMatchLine = false;
    let label: string = "";
    for (let idx = 0; idx < evalText.length; idx++) {
      const line = evalText[idx];
      if (!isMatchLine) {
        if (/\*abs\(\)\*/.test(line)) {
          isMatchLine = true;
          idx -= 1;
        }
        continue;
      } else {
        const m = line.match(/^((\w+)\(([^)]*)\))[ \t]*([^ \t].*)?$/);
        if (m) {
          if (label) {
            this.vimBuiltFunctionDocuments[label].pop();
          }
          label = m[2];
          if (!this.vimBuiltFunctionDocuments[label]) {
            this.vimBuiltFunctionDocuments[label] = [];
          }
        } else if (/^[ \t]*\*string-match\*[ \t]*$/.test(line)) {
          if (label) {
            this.vimBuiltFunctionDocuments[label].pop();
          }
          break;
        } else if (label) {
          this.vimBuiltFunctionDocuments[label].push(line);
        }
      }
    }
  }

  private resolveBuiltinNvimFunctions() {
    const evalText = this.text[API_PATH] || [];
    let completionItem: CompletionItem;
    const pattern = /^((nvim_\w+)\(([^)]*)\))[ \t]*/m;
    for (let idx = 0; idx < evalText.length; idx++) {
      const line = evalText[idx];
      let m = line.match(pattern);
      if (!m && evalText[idx + 1]) {
        m = [line, evalText[idx + 1].trim()].join(" ").match(pattern);
        if (m) {
          idx++;
        }
      }
      if (m) {
        if (completionItem) {
          this.vimBuiltinFunctionItems.push(
            completionItem,
          );
          if (this.vimBuiltFunctionDocuments[completionItem.label]) {
            this.vimBuiltFunctionDocuments[completionItem.label].pop();
          }
        }
        const label = m[2];
        completionItem = {
          label,
          kind: CompletionItemKind.Function,
          detail: "",
          documentation: "",
          sortText: "00004",
          insertText: this.formatFunctionSnippets(m[2], m[3]),
          insertTextFormat: InsertTextFormat.Snippet,
        };
        if (!this.vimBuiltFunctionDocuments[label]) {
          this.vimBuiltFunctionDocuments[label] = [];
        }
        this.vimBuiltFunctionSignatureHelp[label] = [
          m[3],
          "",
        ];
      } else if (/^(================|[ \t]*vim:tw=78:ts=8:ft=help:norl:)/.test(line)) {
        if (completionItem) {
          this.vimBuiltinFunctionItems.push(
            completionItem,
          );
          if (this.vimBuiltFunctionDocuments[completionItem.label]) {
            this.vimBuiltFunctionDocuments[completionItem.label].pop();
          }
          completionItem = undefined;
        }
      } else if (completionItem && !/^[ \t]\*nvim(_\w+)+\(\)\*\s*$/.test(line)) {
        this.vimBuiltFunctionDocuments[completionItem.label].push(line);
      }
    }
  }

  private resolveVimCommands() {
    const indexText = this.text[INDEX_PATH] || [];
    let isMatchLine = false;
    let completionItem: CompletionItem;
    for (const line of indexText) {
      if (!isMatchLine) {
        if (/\*ex-cmd-index\*/.test(line)) {
          isMatchLine = true;
        }
        continue;
      } else {
        const m = line.match(/^\|?:([^ \t]+?)\|?[ \t]+:([^ \t]+)[ \t]+([^ \t].*)$/);
        if (m) {
          if (completionItem) {
            this.vimCommandItems.push(completionItem);
          }
          const label = m[1];
          completionItem = {
            label: m[1],
            kind: CompletionItemKind.Operator,
            detail: m[2],
            documentation: m[3],
            sortText: "00004",
            insertText: m[1],
            insertTextFormat: InsertTextFormat.PlainText,
          };
          if (!this.vimCommandDocuments[label]) {
            this.vimCommandDocuments[label] = [];
          }
          this.vimCommandDocuments[label].push(
            m[3],
          );
        } else if (/^[ \t]*$/.test(line)) {
          if (completionItem) {
            this.vimCommandItems.push(completionItem);
            completionItem = undefined;
            break;
          }
        } else if (completionItem) {
          completionItem.documentation += ` ${line.trim()}`;
          this.vimCommandDocuments[completionItem.label].push(
            line,
          );
        }
      }
    }
  }

  private resolveVimFeatures() {
    const text = this.text[EVAL_PATH] || [];
    let isMatchLine = false;
    let completionItem: CompletionItem;
    const features: CompletionItem[] = [];
    for (let idx = 0; idx < text.length; idx++) {
      const line = text[idx];
      if (!isMatchLine) {
        if (/^[ \t]*acl[ \t]/.test(line)) {
          isMatchLine = true;
          idx -= 1;
        }
        continue;
      } else {
        const m = line.match(/^[ \t]*\*?([^ \t]+?)\*?[ \t]+([^ \t].*)$/);
        if (m) {
          if (completionItem) {
            features.push(completionItem);
          }
          const label = m[1];
          completionItem = {
            label: m[1],
            kind: CompletionItemKind.EnumMember,
            documentation: "",
            sortText: "00004",
            insertText: m[1],
            insertTextFormat: InsertTextFormat.PlainText,
          };
          if (!this.vimFeatureDocuments[label]) {
            this.vimFeatureDocuments[label] = [];
          }
          this.vimFeatureDocuments[label].push(m[2]);
        } else if (/^[ \t]*$/.test(line)) {
          if (completionItem) {
            features.push(completionItem);
            break;
          }
        } else if (completionItem) {
          this.vimFeatureDocuments[completionItem.label].push(
            line,
          );
        }
      }
    }
    this.vimFeatureItems = features;
  }

  private resolveVimAutocmds() {
    const text = this.text[AUTOCMD_PATH] || [];
    let isMatchLine = false;
    for (let idx = 0; idx < text.length; idx++) {
      const line = text[idx];
      if (!isMatchLine) {
        if (/^\|BufNewFile\|/.test(line)) {
          isMatchLine = true;
          idx -= 1;
        }
        continue;
      } else {
        const m = line.match(/^\|([^ \t]+)\|[ \t]+([^ \t].*)$/);
        if (m) {
          this.vimAutocmdItems.push({
            label: m[1],
            kind: CompletionItemKind.EnumMember,
            documentation: m[2],
            sortText: "00004",
            insertText: m[1],
            insertTextFormat: InsertTextFormat.PlainText,
          });
          if (m[1] === "Signal") {
            break;
          }
        }
      }
    }
  }

  private resolveExpandKeywords() {
      this.vimExpandKeywordItems = [
        "<cfile>,file name under the cursor",
        "<afile>,autocmd file name",
        "<abuf>,autocmd buffer number (as a String!)",
        "<amatch>,autocmd matched name",
        "<sfile>,sourced script file or function name",
        "<slnum>,sourced script file line number",
        "<cword>,word under the cursor",
        "<cWORD>,WORD under the cursor",
        "<client>,the {clientid} of the last received message `server2client()`",
      ].map((line) => {
        const item = line.split(",");
        this.expandKeywordDocuments[item[0]] = [
          item[1],
        ];
        return {
          label: item[0],
          kind: CompletionItemKind.Keyword,
          documentation: item[1],
          sortText: "00004",
          insertText: item[0],
          insertTextFormat: InsertTextFormat.PlainText,
        };
      });
  }

}

async function main() {
  const servers: Server[] = [];
  for (let idx = 2; idx < process.argv.length; idx++) {
    servers.push(
      new Server({
        vimruntime: process.argv[idx],
      }),
    );
    await servers[servers.length - 1].build();
  }
  const server: Server = servers.reduce((pre, next) => {
    // merge functions
    next.vimBuiltinFunctionItems.forEach((item) => {
      const { label } = item;
      if (!pre.vimBuiltFunctionDocuments[label]) {
        pre.vimBuiltinFunctionItems.push(item);
        pre.vimBuiltFunctionDocuments[label] = next.vimBuiltFunctionDocuments[label];
      }
    });
    // merge commands
    next.vimCommandItems.forEach((item) => {
      const { label } = item;
      if (!pre.vimCommandDocuments[label]) {
        pre.vimCommandItems.push(item);
        pre.vimCommandDocuments[label] = next.vimCommandDocuments[label];
      }
    });
    // merge options
    next.vimOptionItems.forEach((item) => {
      const { label } = item;
      if (!pre.vimOptionDocuments[label]) {
        pre.vimOptionItems.push(item);
        pre.vimOptionDocuments[label] = next.vimOptionDocuments[label];
      }
    });
    // merge variables
    next.vimPredefinedVariablesItems.forEach((item) => {
      const { label } = item;
      if (!pre.vimPredefinedVariableDocuments[label]) {
        pre.vimPredefinedVariablesItems.push(item);
        pre.vimPredefinedVariableDocuments[label] = next.vimPredefinedVariableDocuments[label];
      }
    });
    // merge features
    next.vimFeatureItems.forEach((item) => {
      const { label } = item;
      if (!pre.vimFeatureDocuments[label]) {
        pre.vimFeatureItems.push(item);
        pre.vimFeatureDocuments[label] = next.vimFeatureDocuments[label];
      }
    });
    // merge expand key words
    next.vimExpandKeywordItems.forEach((item) => {
      const { label } = item;
      if (!pre.expandKeywordDocuments[label]) {
        pre.vimExpandKeywordItems.push(item);
        pre.expandKeywordDocuments[label] = next.expandKeywordDocuments[label];
      }
    });
    // merge autocmd
    next.vimAutocmdItems.forEach((item) => {
      const { label } = item;
      if (!pre.vimAutocmdItems.some((n) => n.label === label)) {
        pre.vimAutocmdItems.push(item);
      }
    });
    // merge signature help
    pre.vimBuiltFunctionSignatureHelp = {
      ...next.vimBuiltFunctionSignatureHelp,
      ...pre.vimBuiltFunctionSignatureHelp,
    };
    return pre;
  });

  server.serialize();
}

main();
