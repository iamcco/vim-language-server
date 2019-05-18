import {
  CompletionItem,
  Position
} from 'vscode-languageserver';

type Provider = (line: string, uri?: string, position?: Position) => CompletionItem[]

const providers: Provider[] = []

export function useProvider(p: Provider) {
  providers.push(p)
}

export function getProvider() {
  return providers.reduce((pre, next) => {
    return (
      line: string,
      uri: string,
      position: Position,
      items: CompletionItem[]
    ) => pre(
      line,
      uri,
      position,
      items.concat(next(line, uri, position))
    )

  }, (
    _line: string,
    _uri: string,
    _position: Position,
    items: CompletionItem[],
  ) => items
  )
}
