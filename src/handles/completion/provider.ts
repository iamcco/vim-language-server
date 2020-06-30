import {
  CompletionItem,
  Position,
} from "vscode-languageserver";
import fuzzy from "../../common/fuzzy";

type Provider = (line: string, uri?: string, position?: Position) => CompletionItem[];

const providers: Provider[] = [];

export function useProvider(p: Provider) {
  providers.push(p);
}

export function getProvider() {
  return providers.reduce((pre, next) => {
    return (
      line: string,
      uri: string,
      position: Position,
      word: string,
      invalidLength: number,
      items: CompletionItem[],
    ): CompletionItem[] => {
      // 200 items is enough
      if (items.length > 200) {
        return items.slice(0, 200)
      }
      const newItems = next(line, uri, position)
        .filter((item) => fuzzy(item.label, word) >= invalidLength)
      return pre(
        line,
        uri,
        position,
        word,
        invalidLength,
        items.concat(newItems),
      )
    };

  }, (
    _line: string,
    _uri: string,
    _position: Position,
    _word: string,
    _invalidLength: number,
    items: CompletionItem[],
  ): CompletionItem[] => items,
  );
}
