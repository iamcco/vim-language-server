# VimScript Language Server

[![CI](https://github.com/iamcco/vim-language-server/workflows/CI/badge.svg?branch=master)](https://github.com/iamcco/vim-language-server/actions?query=workflow%3ACI)
[![Npm](https://img.shields.io/github/package-json/v/iamcco/vim-language-server)](https://www.npmjs.com/package/vim-language-server)
![Type](https://img.shields.io/npm/types/vim-language-server)
![download](https://img.shields.io/npm/dm/vim-language-server)

> language server for VimScript

**Features:**

- auto completion
- function signature help
- hover document
- go to definition
- go to references
- document symbols
- document highlight
- folding range
- select range
- rename
- snippets
- diagnostic

![autocomplete](https://user-images.githubusercontent.com/5492542/81493984-909c2e80-92d7-11ea-9638-d7be3e18e1d1.gif)

## Install

**For yarn**

```sh
yarn global add vim-language-server
```

**For npm**

```sh
npm install -g vim-language-server
```

**For coc.nvim user** install coc extension:

```vim
:CocInstall coc-vimlsp
```

**For vim-easycomplete user** install lsp server via `:InstallLspServer vim` and config nothing:

```vim
:InstallLspServer vim
```

## Config

for document highlight

```vim
let g:markdown_fenced_languages = [
      \ 'vim',
      \ 'help'
      \]
```

lsp client config example with coc.nvim

- Using node ipc

```jsonc
"languageserver": {
  "vimls": {
    "module": "/path/to/vim-language-server/bin/index.js",
    "args": ["--node-ipc"],
    "initializationOptions": {
      "isNeovim": true, // is neovim, default false
      "iskeyword": "@,48-57,_,192-255,-#", // vim iskeyword option
      "vimruntime": "", // $VIMRUNTIME option
      "runtimepath": "",   // vim runtime path separate by `,`
      "diagnostic": {
        "enable": true
      },
      "indexes": {
        "runtimepath": true,      // if index runtimepath's vim files this will effect the suggest
        "gap": 100,               // index time gap between next file
        "count": 3,               // count of files index at the same time
        "projectRootPatterns" : ["strange-root-pattern", ".git", "autoload", "plugin"] // Names of files used as the mark of project root. If empty, the default value [".git", "autoload", "plugin"] will be used
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

```jsonc
"languageserver": {
  "vimls": {
    "command": "vim-language-server",
    "args": ["--stdio"],
    "initializationOptions": {
      "isNeovim": true, // is neovim, default false
      "iskeyword": "@,48-57,_,192-255,-#", // vim iskeyword option
      "vimruntime": "",                    // $VIMRUNTIME option
      "runtimepath": "",                   // vim runtime path separate by `,`
      "diagnostic": {
        "enable": true
      },
      "indexes": {
        "runtimepath": true,      // if index runtimepath's vim files this will effect the suggest
        "gap": 100,               // index time gap between next file
        "count": 3,               // count of files index at the same time
        "projectRootPatterns" : ["strange-root-pattern", ".git", "autoload", "plugin"] // Names of files used as the mark of project root. If empty, the default value [".git", "autoload", "plugin"] will be used
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

- if you set `isNeovim: true`, command like `fixdel` in vimrc which neovim does not support will report error.
- if you want to speed up index, change `gap` to smaller and `count` to greater, this will cause high CPU usage for some time
- if you don't want to index vim's runtimepath files, set `runtimepath` to `false` and you will not get any suggest from those files.

## Usage

> The screen record is using coc.nvim as LSP client.

**Auto complete and function signature help**:

![autocomplete](https://user-images.githubusercontent.com/5492542/81493984-909c2e80-92d7-11ea-9638-d7be3e18e1d1.gif)

**Hover document**:

![hover](https://user-images.githubusercontent.com/5492542/81494066-5aab7a00-92d8-11ea-9ccd-31bd6440e622.gif)

**Go to definition and references**:

![goto](https://user-images.githubusercontent.com/5492542/81494125-c261c500-92d8-11ea-83c0-fecba34ea55e.gif)

**Document symbols**:

![symbols](https://user-images.githubusercontent.com/5492542/81494183-5cc20880-92d9-11ea-9495-a7691420df39.gif)

**Document highlight**:

![highlight](https://user-images.githubusercontent.com/5492542/81494214-b1fe1a00-92d9-11ea-9cc1-0420cddc5cbc.gif)

**Folding range and selection range**:

![fold](https://user-images.githubusercontent.com/5492542/81494276-3bade780-92da-11ea-8c93-bc3d2127a19d.gif)

**Rename**:

![rename](https://user-images.githubusercontent.com/5492542/81494329-aa8b4080-92da-11ea-8a5d-ace5385445e9.gif)

**Snippets and diagnostic**:

![dia](https://user-images.githubusercontent.com/5492542/81494408-503eaf80-92db-11ea-96ac-641d46027623.gif)

## References

- [vim-vimlparser](https://github.com/vim-jp/vim-vimlparser)
- [neco-vim](https://github.com/Shougo/neco-vim)

## Similar project

- [vimscript-language-server](https://github.com/google/vimscript-language-server)

### Buy Me A Coffee ☕️

![btc](https://img.shields.io/keybase/btc/iamcco.svg?style=popout-square)

![image](https://user-images.githubusercontent.com/5492542/42771079-962216b0-8958-11e8-81c0-520363ce1059.png)
