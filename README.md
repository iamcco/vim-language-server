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
      "runtimepath": "vim/runtime/path"
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
      "runtimepath": "vim/runtime/path"
    },
    "filetypes": [ "vim" ]
  }
}
```

## TODO

- [x] filter function ref from function declare to fix double function complete item
- [x] function / funcref
- [x] start with call only return function list
- [x] autocmd/command/map function
- [ ] highlight type autocomplete
- [ ] autocmd group event autocomplete
- [ ] incremental
- [ ] function signature help parameters

## References

- [vim-vimlparser](https://github.com/vim-jp/vim-vimlparser)
- [neco-vim](https://github.com/Shougo/neco-vim)

### Buy Me A Coffee ☕️

![btc](https://img.shields.io/keybase/btc/iamcco.svg?style=popout-square)

![image](https://user-images.githubusercontent.com/5492542/42771079-962216b0-8958-11e8-81c0-520363ce1059.png)
