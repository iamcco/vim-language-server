export type kindPattern = RegExp[]

export const errorLinePattern = /[^:]+:\s*(.+?):\s*line\s*([0-9]+)\s*col\s*([0-9]+)/

export const commentPattern = /^[ \t]*("|')/

export const keywordPattern = /[\w#&<>.:]/

export const builtinFunctionPattern = /^((<SID>|\b(v|g|b|s|l|a):)?[\w#&]+)[ \t]*\([^)]*\)/

export const wordPrePattern = /^.*?(((<SID>|\b(v|g|b|s|l|a):)?[\w#&.]+)|(<SID>|<SID|<SI|<S|<|\b(v|g|b|s|l|a):))$/

export const wordNextPattern = /^((SID>|ID>|D>|>|<SID>|\b(v|g|b|s|l|a):)?[\w#&.]+|(:[\w#&.]+)).*?(\r\n|\r|\n)?$/

export const colorschemePattern = /\bcolorscheme[ \t]+\w*$/

export const mapCommandPattern = /^([ \t]*(\[ \t]*)?)\w*map[ \t]+/

export const builtinVariablePattern = [
  /(^|[ \t]+)v:\w*$/
]

export const optionPattern = [
  /(^|[ \t]+)&\w*$/,
  /(^|[ \t]+)set(l|local|g|global)?[ \t]+\w+$/
]

export const notFunctionPattern = [
  /^[ \t]*\w+$/,
  /^[ \t]*"/,
  /(let|set|colorscheme)[ \t][^ \t]*$/,
  /[^([,\\ \t\w#]\w*$/
]

export const commandPattern = [
  /(^|[ \t]):\w+$/,
  /^[ \t]*\w+$/,
  /:?silent!?[ \t]\w+/
]

export const featurePattern = [
  /\bhas\([ \t]*["']\w*/
]

export const expandPattern = [
  /\bexpand\(['"]<\w*$/,
  /\bexpand\([ \t]*['"]\w*$/
]

export const notIdentifierPattern = [
  commentPattern,
  /('|"|#|&|\$|<|[^ \t]:)\w*$/
]
