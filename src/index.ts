import { InitializeParams } from 'vscode-languageserver';
import * as shvl from 'shvl';

import { completionProvider } from './handles/completion';
import { hoverProvider } from './handles/hover';
import { completionResolveProvider } from './handles/completionResolve';
import { signatureHelpProvider } from './handles/signatureHelp';
import { documents } from './server/documents';
import { connection } from './server/connection';
import { IConfig, IDiagnostic, ISuggest, IIndexes } from './common/types';
import { next, unsubscribe } from './server/parser';
import { builtinDocs } from './server/builtin';
import config from './server/config';
import { definitionProvider } from './handles/definition';
import { referencesProvider } from './handles/references';
import { renameProvider, prepareProvider } from './handles/rename';
import { workDirPatterns } from './common/constant';

// lsp initialize
connection.onInitialize((param: InitializeParams) => {
  const { initializationOptions = {} } = param
  const {
    iskeyword,
    runtimepath,
    vimruntime,
    diagnostic,
    suggest,
    indexes
  }: {
    iskeyword: string
    runtimepath: string
    vimruntime: string
    diagnostic: IDiagnostic
    suggest: ISuggest
    indexes: IIndexes
  } = initializationOptions

  const runtimepaths = runtimepath ? runtimepath.split(',') : []

  // config by user's initializationOptions
  const conf:IConfig = {
    iskeyword: iskeyword || '',
    runtimepath: runtimepaths,
    vimruntime: (vimruntime || '').trim(),
    diagnostic: {
      enable: true,
      ...(diagnostic || {})
    },
    snippetSupport: shvl.get(param, 'capabilities.textDocument.completion.completionItem.snippetSupport'),
    suggest: {
      fromRuntimepath: false,
      fromVimruntime: true,
      ...(suggest || {})
    },
    indexes: {
      runtimepath: true,
      gap: 100,
      count: 1,
      workDirPatterns: workDirPatterns,
      ...(indexes || {})
    }
  }

  // init config
  config.init(conf)

  // init builtin docs
  builtinDocs.init()

  return {
    capabilities: {
      textDocumentSync: documents.syncKind,
      hoverProvider: true,
      completionProvider: {
        triggerCharacters: ['.', ':', '#', '[', '&', '$', '<', '"', "'"],
        resolveProvider: true
      },
      signatureHelpProvider: {
        triggerCharacters: ['(', ',']
      },
      definitionProvider: true,
      referencesProvider: true,
      renameProvider: {
        prepareProvider: true
      }
    }
  };
});

// document change or open
documents.onDidChangeContent(( change ) => {
  next(change.document)
});

documents.onDidClose((evt) => {
  unsubscribe(evt.document)
})

// listen for document's open/close/change
documents.listen(connection);

// handle completion
connection.onCompletion(completionProvider)

// handle completion resolve
connection.onCompletionResolve(completionResolveProvider)

// handle signaturehelp
connection.onSignatureHelp(signatureHelpProvider)

// handle hover
connection.onHover(hoverProvider)

// handle definition request
connection.onDefinition(definitionProvider)

// handle references
connection.onReferences(referencesProvider)

// handle rename
connection.onPrepareRename(prepareProvider)
connection.onRenameRequest(renameProvider)

// lsp start
connection.listen();
