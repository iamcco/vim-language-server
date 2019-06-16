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
import { readFile } from 'fs';
import path, { join, dirname } from 'path';
import fg from 'fast-glob';
import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  MarkupKind,
  MarkupContent,
  Hover,
  SignatureHelp,
} from 'vscode-languageserver';

import { BuiltinDoc } from '../common/types';
import { pcb, isSomeMatchPattern } from '../common/util';
import logger from '../common/logger';
import {
  builtinVariablePattern,
  optionPattern,
  commandPattern,
  featurePattern,
  builtinFunctionPattern,
  expandPattern
} from '../common/patterns';
import config from './config';

const log = logger('builtin')

class Builtin {
  constructor() {}

  // completion items
  private vimPredefinedVariablesItems: CompletionItem[] = []
  private vimOptionItems: CompletionItem[] = []
  private vimBuiltinFunctionItems: CompletionItem[] = []
  private vimBuiltinFunctionMap: Record<string, boolean> = {}
  private vimCommandItems: CompletionItem[] = []
  private vimMapArgsItems: CompletionItem[] = []
  private vimFeatureItems: CompletionItem[] = []
  private expandKeywordItems: CompletionItem[] = []
  private colorschemeItems: CompletionItem[] = []

  // signature help
  private vimBuiltFunctionSignatureHelp: Record<string, string[]> = {}

  // documents
  private vimBuiltFunctionDocuments: Record<string, string[]> = {}
  private vimOptionDocuments: Record<string, string[]> = {}
  private vimPredefinedVariableDocuments: Record<string, string[]> = {}
  private vimCommandDocuments: Record<string, string[]> = {}
  private vimFeatureDocuments: Record<string, string[]> = {}
  private expandKeywordDocuments: Record<string, string[]> = {}

  public init() {
    this.start()
  }

  public getPredefinedVimVariables() {
    return this.vimPredefinedVariablesItems
  }

  public getVimOptions() {
    return this.vimOptionItems
  }

  public getBuiltinVimFunctions() {
    return this.vimBuiltinFunctionItems
  }

  public isBuiltinFunction(label: string) {
    return this.vimBuiltinFunctionMap[label]
  }

  public getExpandKeywords() {
    return this.expandKeywordItems
  }

  public getVimCommands() {
    return this.vimCommandItems
  }

  public getVimMapArgs() {
    return this.vimMapArgsItems
  }

  public getVimFeatures() {
    return this.vimFeatureItems
  }

  public getColorschemes() {
    return this.colorschemeItems
  }

  public getSignatureHelpByName(name: string, idx: number): SignatureHelp | undefined {
    const params = this.vimBuiltFunctionSignatureHelp[name]
    if (params) {
      return {
        signatures: [{
          label: `${name}(${params[0]})${params[1] ? `: ${params[1]}` : ''}`,
          documentation: this.formatVimDocument(this.vimBuiltFunctionDocuments[name]),
          parameters: params[0].split('[')[0].split(',').map(param => {
            return {
              label: param.trim()
            }
          })
        }],
        activeSignature: 0,
        activeParameter: idx
      }
    }
    return
  }

  public getDocumentByCompletionItem(
    params: { label: string, kind: CompletionItemKind } | CompletionItem
  ): CompletionItem | undefined {
    const { kind } = params
    switch (kind) {
      case CompletionItemKind.Variable:
        if (!this.vimPredefinedVariableDocuments[params.label]) {
          return
        }
        return {
          ...params,
          documentation: this.formatVimDocument(
            this.vimPredefinedVariableDocuments[params.label]
          )
        }
      case CompletionItemKind.Property:
        if (!this.vimOptionDocuments[params.label]) {
          return
        }
        return {
          ...params,
          documentation: this.formatVimDocument(
            this.vimOptionDocuments[params.label]
          )
        }
      case CompletionItemKind.Function:
        if (!this.vimBuiltFunctionDocuments[params.label]) {
          return
        }
        return {
          ...params,
          documentation: this.formatVimDocument(
            this.vimBuiltFunctionDocuments[params.label]
          )
        }
      case CompletionItemKind.EnumMember:
        if (!this.vimFeatureDocuments[params.label]) {
          return
        }
        return {
          ...params,
          documentation: this.formatVimDocument(
            this.vimFeatureDocuments[params.label]
          )
        }
      case CompletionItemKind.Operator:
        if (!this.vimCommandDocuments[params.label]) {
          return
        }
        return {
          ...params,
          documentation: this.formatVimDocument(
            this.vimCommandDocuments[params.label]
          )
        }
      default:
        break;
    }
  }

  public getHoverDocument(name: string, pre: string, next: string): Hover {
    // builtin variables
    if (isSomeMatchPattern(builtinVariablePattern, pre) && this.vimPredefinedVariableDocuments[name]) {
      return {
        contents: this.formatVimDocument(this.vimPredefinedVariableDocuments[name])
      }
    // options
    } else if(isSomeMatchPattern(optionPattern, pre) && this.vimOptionDocuments[name.slice(1)]) {
      return {
        contents: this.formatVimDocument(this.vimOptionDocuments[name.slice(1)])
      }
    // builtin functions
    } else if (builtinFunctionPattern.test(next) && this.vimBuiltFunctionDocuments[name]) {
      return {
        contents: this.formatVimDocument(this.vimBuiltFunctionDocuments[name])
      }
    // has features
    } else if(isSomeMatchPattern(featurePattern, pre) && this.vimFeatureDocuments[name]) {
      return {
        contents: this.formatVimDocument(this.vimFeatureDocuments[name])
      }
    // expand Keywords
    } else if (isSomeMatchPattern(expandPattern, pre) && this.expandKeywordDocuments[`<${name}>`]) {
      return {
        contents: this.formatVimDocument(this.expandKeywordDocuments[`<${name}>`])
      }
    // command
    } if(isSomeMatchPattern(commandPattern, pre) && this.vimCommandDocuments[name]) {
      return {
        contents: this.formatVimDocument(this.vimCommandDocuments[name])
      }
    }
  }

  private async start() {
    const { runtimepath } = config

    // get colorschemes
    if (runtimepath) {
      this.resolveColorschemes(runtimepath)
    }

    // get map args
    this.resolveMapArgs()

    // builtin docs
    const [err, docs] = await pcb(readFile)(join(__dirname, '../../docs/builtin-docs.json'), 'utf-8')

    if (err) {
      log.error(`[vimls]: read docs/builtin-doc.json fail => ${err.message || err}`)
      return
    }

    try {
      const data: BuiltinDoc = JSON.parse(docs)
      this.vimBuiltinFunctionItems = data.completionItems.functions
      this.vimBuiltinFunctionItems.forEach(item => {
        if (!this.vimBuiltinFunctionMap[item.label]) {
          this.vimBuiltinFunctionMap[item.label] = true
        }
      })
      this.vimBuiltFunctionDocuments = data.documents.functions
      this.vimCommandItems = data.completionItems.commands
      this.vimCommandDocuments = data.documents.commands
      this.vimPredefinedVariablesItems = data.completionItems.variables
      this.vimPredefinedVariableDocuments = data.documents.variables
      this.vimOptionItems = data.completionItems.options
      this.vimOptionDocuments = data.documents.options
      this.vimFeatureItems = data.completionItems.features
      this.vimFeatureDocuments = data.documents.features
      this.expandKeywordItems = data.completionItems.expandKeywords
      this.expandKeywordDocuments = data.documents.expandKeywords

      this.vimBuiltFunctionSignatureHelp = data.signatureHelp
    } catch (error) {
      log.error(`[vimls]: parse docs/builtin-doc.json fail => ${error.message || error}`)
    }
  }

  // format vim document to markdown
  private formatVimDocument(document: string[]): MarkupContent {
    let indent: number = 0
    return {
      kind: MarkupKind.Markdown,
      value: [
        '``` help',
        ...document.map(line => {
          if (indent === 0) {
            const m = line.match(/^([ \t]+)/)
            if (m) {
              indent = m[1].length
            }
          }
          return line.replace(new RegExp(`^[ \\t]{${indent}}`, 'g'), '').replace(/\t/g, '  ')
        }),
        '```'
      ].join('\n')
    }
  }

  private resolveMapArgs() {
    this.vimMapArgsItems = [ "<buffer>", "<nowait>", "<silent>", "<script>", "<expr>", "<unique>" ]
      .map(item => {
        return {
          label: item,
          kind: CompletionItemKind.EnumMember,
          documentation: '',
          insertText: item,
          insertTextFormat: InsertTextFormat.PlainText
        }
      })
  }

  private async resolveColorschemes(runtimepath: string[]) {
    const list = runtimepath
    if (config.vimruntime) {
      list.push(config.vimruntime)
    }
    const glob = runtimepath.map(p => path.join(p, 'colors/*.vim'))
    const colorschemes: string[] = await fg(glob, { onlyFiles: false, deep: 0 })
    this.colorschemeItems = colorschemes.map(p => {
      const label = path.basename(p, '.vim')
      const item: CompletionItem = {
        label,
        kind: CompletionItemKind.EnumMember,
        insertText: label,
        insertTextFormat: InsertTextFormat.PlainText
      }
      return item
    })
  }
}

export const builtinDocs = new Builtin()
