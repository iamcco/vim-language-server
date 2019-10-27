/*
 * vim builtin completion items
 *
 * 1. functions
 * 2. options
 * 3. variables
 * 4. commands
 * 5. has features
 * 6. expand Keyword
 * 7. map args
 */
import fg from "fast-glob";
import { readFile } from "fs";
import path, { join } from "path";
import {
  CompletionItem,
  CompletionItemKind,
  Hover,
  InsertTextFormat,
  MarkupContent,
  MarkupKind,
  SignatureHelp,
} from "vscode-languageserver";

import logger from "../common/logger";
import {
  builtinFunctionPattern,
  builtinVariablePattern,
  commandPattern,
  expandPattern,
  featurePattern,
  optionPattern,
} from "../common/patterns";
import { IBuiltinDoc } from "../common/types";
import { isSomeMatchPattern, pcb } from "../common/util";
import buildDocs from "../docs/builtin-docs.json";
import config from "./config";

const log = logger("builtin");

class Builtin {

  // completion items
  private vimPredefinedVariablesItems: CompletionItem[] = [];
  private vimOptionItems: CompletionItem[] = [];
  private vimBuiltinFunctionItems: CompletionItem[] = [];
  private vimBuiltinFunctionMap: Record<string, boolean> = {};
  private vimCommandItems: CompletionItem[] = [];
  private vimMapArgsItems: CompletionItem[] = [];
  private vimFeatureItems: CompletionItem[] = [];
  private vimAutocmdItems: CompletionItem[] = [];
  private expandKeywordItems: CompletionItem[] = [];
  private colorschemeItems: CompletionItem[] = [];
  private highlightArgKeys: CompletionItem[] = [];
  private highlightArgValues: Record<string, CompletionItem[]> = {};

  // signature help
  private vimBuiltFunctionSignatureHelp: Record<string, string[]> = {};

  // documents
  private vimBuiltFunctionDocuments: Record<string, string[]> = {};
  private vimOptionDocuments: Record<string, string[]> = {};
  private vimPredefinedVariableDocuments: Record<string, string[]> = {};
  private vimCommandDocuments: Record<string, string[]> = {};
  private vimFeatureDocuments: Record<string, string[]> = {};
  private expandKeywordDocuments: Record<string, string[]> = {};
  constructor() {}

  public init() {
    this.start();
  }

  public getPredefinedVimVariables() {
    return this.vimPredefinedVariablesItems;
  }

  public getVimOptions() {
    return this.vimOptionItems;
  }

  public getBuiltinVimFunctions() {
    return this.vimBuiltinFunctionItems;
  }

  public isBuiltinFunction(label: string) {
    return this.vimBuiltinFunctionMap[label];
  }

  public getExpandKeywords() {
    return this.expandKeywordItems;
  }

  public getVimCommands() {
    return this.vimCommandItems;
  }

  public getVimMapArgs() {
    return this.vimMapArgsItems;
  }

  public getVimFeatures() {
    return this.vimFeatureItems;
  }

  public getVimAutocmds() {
    return this.vimAutocmdItems;
  }

  public getColorschemes() {
    return this.colorschemeItems;
  }

  public getHighlightArgKeys() {
    return this.highlightArgKeys;
  }

  public getHighlightArgValues() {
    return this.highlightArgValues;
  }

  public getSignatureHelpByName(name: string, idx: number): SignatureHelp | undefined {
    const params = this.vimBuiltFunctionSignatureHelp[name];
    if (params) {
      return {
        signatures: [{
          label: `${name}(${params[0]})${params[1] ? `: ${params[1]}` : ""}`,
          documentation: this.formatVimDocument(this.vimBuiltFunctionDocuments[name]),
          parameters: params[0].split("[")[0].split(",").map((param) => {
            return {
              label: param.trim(),
            };
          }),
        }],
        activeSignature: 0,
        activeParameter: idx,
      };
    }
    return;
  }

  public getDocumentByCompletionItem(
    params: { label: string, kind: CompletionItemKind } | CompletionItem,
  ): CompletionItem | undefined {
    const { kind } = params;
    switch (kind) {
      case CompletionItemKind.Variable:
        if (!this.vimPredefinedVariableDocuments[params.label]) {
          return;
        }
        return {
          ...params,
          documentation: this.formatVimDocument(
            this.vimPredefinedVariableDocuments[params.label],
          ),
        };
      case CompletionItemKind.Property:
        if (!this.vimOptionDocuments[params.label]) {
          return;
        }
        return {
          ...params,
          documentation: this.formatVimDocument(
            this.vimOptionDocuments[params.label],
          ),
        };
      case CompletionItemKind.Function:
        if (!this.vimBuiltFunctionDocuments[params.label]) {
          return;
        }
        return {
          ...params,
          documentation: this.formatVimDocument(
            this.vimBuiltFunctionDocuments[params.label],
          ),
        };
      case CompletionItemKind.EnumMember:
        if (!this.vimFeatureDocuments[params.label]) {
          return;
        }
        return {
          ...params,
          documentation: this.formatVimDocument(
            this.vimFeatureDocuments[params.label],
          ),
        };
      case CompletionItemKind.Operator:
        if (!this.vimCommandDocuments[params.label]) {
          return;
        }
        return {
          ...params,
          documentation: this.formatVimDocument(
            this.vimCommandDocuments[params.label],
          ),
        };
      default:
        break;
    }
  }

  public getHoverDocument(name: string, pre: string, next: string): Hover {
    // builtin variables
    if (isSomeMatchPattern(builtinVariablePattern, pre) && this.vimPredefinedVariableDocuments[name]) {
      return {
        contents: this.formatVimDocument(this.vimPredefinedVariableDocuments[name]),
      };
    // options
    } else if (isSomeMatchPattern(optionPattern, pre) && this.vimOptionDocuments[name.slice(1)]) {
      return {
        contents: this.formatVimDocument(this.vimOptionDocuments[name.slice(1)]),
      };
    // builtin functions
    } else if (builtinFunctionPattern.test(next) && this.vimBuiltFunctionDocuments[name]) {
      return {
        contents: this.formatVimDocument(this.vimBuiltFunctionDocuments[name]),
      };
    // has features
    } else if (isSomeMatchPattern(featurePattern, pre) && this.vimFeatureDocuments[name]) {
      return {
        contents: this.formatVimDocument(this.vimFeatureDocuments[name]),
      };
    // expand Keywords
    } else if (isSomeMatchPattern(expandPattern, pre) && this.expandKeywordDocuments[`<${name}>`]) {
      return {
        contents: this.formatVimDocument(this.expandKeywordDocuments[`<${name}>`]),
      };
    // command
    } if (isSomeMatchPattern(commandPattern, pre) && this.vimCommandDocuments[name]) {
      return {
        contents: this.formatVimDocument(this.vimCommandDocuments[name]),
      };
    }
  }

  private async start() {
    const { runtimepath } = config;

    // get colorschemes
    if (runtimepath) {
      this.resolveColorschemes(runtimepath);
    }

    // get map args
    this.resolveMapArgs();

    // get highlight arg keys
    this.resolveHighlightArgKeys();

    // get highlight arg values
    this.resolveHighlightArgValues();

    try {
      const data: IBuiltinDoc = buildDocs as IBuiltinDoc;
      this.vimBuiltinFunctionItems = data.completionItems.functions;
      this.vimBuiltinFunctionItems.forEach((item) => {
        if (!this.vimBuiltinFunctionMap[item.label]) {
          this.vimBuiltinFunctionMap[item.label] = true;
        }
      });
      this.vimBuiltFunctionDocuments = data.documents.functions;
      this.vimCommandItems = data.completionItems.commands;
      this.vimCommandDocuments = data.documents.commands;
      this.vimPredefinedVariablesItems = data.completionItems.variables;
      this.vimPredefinedVariableDocuments = data.documents.variables;
      this.vimOptionItems = data.completionItems.options;
      this.vimOptionDocuments = data.documents.options;
      this.vimFeatureItems = data.completionItems.features;
      this.vimAutocmdItems = data.completionItems.autocmds;
      this.vimFeatureDocuments = data.documents.features;
      this.expandKeywordItems = data.completionItems.expandKeywords;
      this.expandKeywordDocuments = data.documents.expandKeywords;

      this.vimBuiltFunctionSignatureHelp = data.signatureHelp;
    } catch (error) {
      log.error(`[vimls]: parse docs/builtin-doc.json fail => ${error.message || error}`);
    }
  }

  // format vim document to markdown
  private formatVimDocument(document: string[]): MarkupContent {
    let indent: number = 0;
    return {
      kind: MarkupKind.Markdown,
      value: [
        "``` help",
        ...document.map((line) => {
          if (indent === 0) {
            const m = line.match(/^([ \t]+)/);
            if (m) {
              indent = m[1].length;
            }
          }
          return line.replace(new RegExp(`^[ \\t]{${indent}}`, "g"), "").replace(/\t/g, "  ");
        }),
        "```",
      ].join("\n"),
    };
  }

  private resolveMapArgs() {
    this.vimMapArgsItems = [ "<buffer>", "<nowait>", "<silent>", "<script>", "<expr>", "<unique>" ]
      .map((item) => {
        return {
          label: item,
          kind: CompletionItemKind.EnumMember,
          documentation: "",
          insertText: item,
          insertTextFormat: InsertTextFormat.PlainText,
        };
      });
  }

  private async resolveColorschemes(runtimepath: string[]) {
    const list = runtimepath;
    if (config.vimruntime) {
      list.push(config.vimruntime);
    }
    const glob = runtimepath.map((p) => path.join(p.trim(), "colors/*.vim"));
    let colorschemes: string[] = [];
    try {
      colorschemes = await fg(glob, { onlyFiles: false, deep: 0 });
    } catch (error) {
      log.error(
        [
          `Index Colorschemes Error: ${JSON.stringify(glob)}`,
          `Error => ${error.stack || error.message || error}`,
        ].join("\n"),
      );
    }
    this.colorschemeItems = colorschemes.map((p) => {
      const label = path.basename(p, ".vim");
      const item: CompletionItem = {
        label,
        kind: CompletionItemKind.EnumMember,
        insertText: label,
        insertTextFormat: InsertTextFormat.PlainText,
      };
      return item;
    });
  }

  private resolveHighlightArgKeys() {
    this.highlightArgKeys = [
      "cterm",
      "start",
      "stop",
      "ctermfg",
      "ctermbg",
      "gui",
      "font",
      "guifg",
      "guibg",
      "guisp",
      "blend",
    ]
    .map((item) => {
      return {
        label: item,
        kind: CompletionItemKind.EnumMember,
        documentation: "",
        insertText: `${item}=$\{0\}`,
        insertTextFormat: InsertTextFormat.Snippet,
      };
    });
  }

  private resolveHighlightArgValues() {
    const values = {
      "cterm": ["bold", "underline", "undercurl", "reverse", "inverse", "italic", "standout", "NONE"],
      "ctermfg ctermbg": [
        "Black",
        "DarkBlue",
        "DarkGreen",
        "DarkCyan",
        "DarkRed",
        "DarkMagenta",
        "Brown", "DarkYellow",
        "LightGray", "LightGrey", "Gray", "Grey",
        "DarkGray", "DarkGrey",
        "Blue", "LightBlue",
        "Green", "LightGreen",
        "Cyan", "LightCyan",
        "Red", "LightRed",
        "Magenta", "LightMagenta",
        "Yellow", "LightYellow",
        "White",
      ],
      "guifg guibg guisp": [
        "NONE",
        "bg",
        "background",
        "fg",
        "foreground",
        "Red", "LightRed", "DarkRed",
        "Green", "LightGreen", "DarkGreen", "SeaGreen",
        "Blue", "LightBlue", "DarkBlue", "SlateBlue",
        "Cyan", "LightCyan", "DarkCyan",
        "Magenta", "LightMagenta", "DarkMagenta",
        "Yellow", "LightYellow", "Brown", "DarkYellow",
        "Gray", "LightGray", "DarkGray",
        "Black", "White",
        "Orange", "Purple", "Violet",
      ],
    };

    const argValues: Record<string, CompletionItem[]> = {};
    Object.keys(values).forEach((key) => {
      const items: CompletionItem[] = values[key].map((val: string) => ({
        label: val,
        kind: CompletionItemKind.EnumMember,
        documentation: "",
        insertText: val,
        insertTextFormat: InsertTextFormat.PlainText,
      }));
      key.split(" ").forEach((name) => {
        argValues[name] = items;
      });
    });
    this.highlightArgValues = argValues;
  }
}

export const builtinDocs = new Builtin();
