import { Subscription} from 'rxjs';
import { CompletionItem } from 'vscode-languageserver';

export interface IParserHandles {
  [uri: string]: Subscription | undefined
}

export interface IDiagnostic {
  enable: boolean
}

export interface ISuggest {
  fromRuntimepath: boolean
  fromVimruntime: boolean
}

export interface IIndexes {
  runtimepath: boolean
  gap: number
  count: number,
  workDirPatterns: string[]
}

// initialization options
export interface IConfig {
  iskeyword: string
  vimruntime: string
  runtimepath: string[]
  diagnostic: IDiagnostic
  snippetSupport: boolean
  suggest: ISuggest
  indexes: IIndexes
}

// builtin-doc
export interface BuiltinDoc {
  completionItems: {
    functions: CompletionItem[]
    commands: CompletionItem[]
    options: CompletionItem[]
    variables: CompletionItem[]
    features: CompletionItem[]
    expandKeywords: CompletionItem[]
    autocmds: CompletionItem[]
  }
  signatureHelp: Record<string, string[]>
  documents: {
    functions: Record<string, string[]>
    commands: Record<string, string[]>
    options: Record<string, string[]>
    variables: Record<string, string[]>
    features: Record<string, string[]>
    expandKeywords: Record<string, string[]>
  }
}
