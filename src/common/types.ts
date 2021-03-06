import { Subscription} from "rxjs";
import { ClientCapabilities, CompletionItem } from "vscode-languageserver";

export interface IParserHandles {
  [uri: string]: Subscription | undefined;
}

export interface IDiagnostic {
  enable: boolean;
}

export interface ISuggest {
  fromRuntimepath: boolean;
  fromVimruntime: boolean;
}

export interface IIndexes {
  runtimepath: boolean;
  gap: number;
  count: number;
  projectRootPatterns: string[];
}

// initialization options
export interface IConfig {
  isNeovim: boolean;
  iskeyword: string;
  vimruntime: string;
  runtimepath: string[];
  diagnostic: IDiagnostic;
  snippetSupport: boolean;
  suggest: ISuggest;
  indexes: IIndexes;
  capabilities: ClientCapabilities
}

// builtin-doc
export interface IBuiltinDoc {
  completionItems: {
    functions: CompletionItem[]
    commands: CompletionItem[]
    options: CompletionItem[]
    variables: CompletionItem[]
    features: CompletionItem[]
    expandKeywords: CompletionItem[]
    autocmds: CompletionItem[],
  };
  signatureHelp: Record<string, string[]>;
  documents: {
    functions: Record<string, string[]>
    commands: Record<string, string[]>
    options: Record<string, string[]>
    variables: Record<string, string[]>
    features: Record<string, string[]>
    expandKeywords: Record<string, string[]>,
  };
}
