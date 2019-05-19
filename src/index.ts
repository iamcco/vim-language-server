import { InitializeParams } from 'vscode-languageserver';

import { completionProvider } from './handles/completion';
import { hoverProvider } from './handles/hover';
import { completionResolveProvider } from './handles/completionResolve';
import { signatureHelpProvider } from './handles/signatureHelp';
import { documents } from './server/documents';
import { connection } from './server/connection';
import { IConfig } from './common/types';
import { next, unsubscribe } from './server/parser';
import { builtinDocs } from './server/builtin';
import config from './server/config';
import { definitionProvider } from './handles/definition';
import { referencesProvider } from './handles/references';
import { renameProvider, prepareProvider } from './handles/rename';

// lsp initialize
connection.onInitialize((param: InitializeParams) => {
  const { initializationOptions = {} } = param
  const { iskeyword, runtimepath, vimruntime }: {
    iskeyword: string
    runtimepath: string
    vimruntime: string
  } = initializationOptions

  // config by user's initializationOptions
  const conf:IConfig = {
    iskeyword: iskeyword || '',
    runtimepath: runtimepath ? runtimepath.split(',') : [],
    vimruntime: vimruntime || ''
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
