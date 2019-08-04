# vim language server

> language server for viml

**Features:**

- auto completion
- function signature help
- hover document
- go to definition
- go to references
- rename
- snippets
- diagnostic

![image](https://user-images.githubusercontent.com/5492542/57384333-019b9880-71e3-11e9-9ee8-7e731944777b.png)

## Install

``` sh
yarn global add vim-language-server
```

**For coc.nvim user** install coc extension:

``` vim
:CocInstall coc-vimlsp
```

## Config

for document highlight

``` vim
let g:markdown_fenced_languages = [
      \ 'vim',
      \ 'help'
      \]
```

lsp client config example with coc.nvim

- Using node ipc

``` jsonc
"languageserver": {
  "vimls": {
    "module": "/path/to/vim-language-server/bin/index.js",
    "args": ["--node-ipc"],
    "initializationOptions": {
      "iskeyword": "vim iskeyword option",
      "vimruntime": "path/to/$VIMRUNTIME",
      "runtimepath": "vim/runtime/path",
      "diagnostic": {
        "enable": true
      },
      "indexes": {
        "runtimepath": true,      // if index runtimepath's vim files this will effect the suggest
        "gap": 100,               // index time gap between next file
        "count": 3                // count of files index at the same time
      },
      "suggest": {
        "fromVimruntime": true,   // completionItems from vimruntime's vim files
        "fromRuntimepath": false  // completionItems from runtimepath's vim files, if this is true that fromVimruntime is true
      }
    },
    "filetypes": [ "vim" ],
  }
}
```

- Using stdio

``` jsonc
"languageserver": {
  "vimls": {
    "command": "vim-language-server",
    "args": ["--stdio"],
    "initializationOptions": {
      "iskeyword": "vim iskeyword option",
      "vimruntime": "path/to/$VIMRUNTIME",
      "runtimepath": "vim/runtime/path",
      "diagnostic": {
        "enable": true
      },
      "indexes": {
        "runtimepath": true,      // if index runtimepath's vim files this will effect the suggest
        "gap": 100,               // index time gap between next file
        "count": 3                // count of files index at the same time
      },
      "suggest": {
        "fromVimruntime": true,   // completionItems from vimruntime's vim files
        "fromRuntimepath": false  // completionItems from runtimepath's vim files, if this is true that fromVimruntime is true
      }
    },
    "filetypes": [ "vim" ]
  }
}
```

**Note**:

- if you want to speed up index, change `gap` to smaller and `count` to greater, this will cause high CPU usage for some time
- if you don't want to index vim's runtimepath files, set `runtimepath` to `false` and you will not get any suggest from those files.
- while `fromRuntimepath` is true, if you have install too many plugins it will slow down the complete

## References

- [vim-vimlparser](https://github.com/vim-jp/vim-vimlparser)
- [neco-vim](https://github.com/Shougo/neco-vim)

### Buy Me A Coffee ☕️

![btc](https://img.shields.io/keybase/btc/iamcco.svg?style=popout-square)

![image](https://user-images.githubusercontent.com/5492542/42771079-962216b0-8958-11e8-81c0-520363ce1059.png)
