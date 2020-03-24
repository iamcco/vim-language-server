//!/usr/bin/env nodejs
// usage: nodejs vimlparser.js [--neovim] foo.vim

var fs = require('fs');
var util = require('util');

function main() {
    var neovim = false;
    var fpath = ''
    var args = process.argv;
    if (args.length == 4) {
        if (args[2] == '--neovim') {
            neovim = true;
        }
        fpath = args[3];
    } else if (args.length == 3) {
        neovim = false;
        fpath = args[2]
    }
    var r = new StringReader(viml_readfile(fpath));
    var p = new VimLParser(neovim);
    var c = new Compiler();
    try {
        var lines = c.compile(p.parse(r));
        for (var i in lines) {
            process.stdout.write(lines[i] + "\n");
        }
    } catch (e) {
        process.stdout.write(e + '\n');
    }
}

var pat_vim2js = {
  "[0-9a-zA-Z]" : "[0-9a-zA-Z]",
  "[@*!=><&~#]" : "[@*!=><&~#]",
  "\\<ARGOPT\\>" : "\\bARGOPT\\b",
  "\\<BANG\\>" : "\\bBANG\\b",
  "\\<EDITCMD\\>" : "\\bEDITCMD\\b",
  "\\<NOTRLCOM\\>" : "\\bNOTRLCOM\\b",
  "\\<TRLBAR\\>" : "\\bTRLBAR\\b",
  "\\<USECTRLV\\>" : "\\bUSECTRLV\\b",
  "\\<USERCMD\\>" : "\\bUSERCMD\\b",
  "\\<\\(XFILE\\|FILES\\|FILE1\\)\\>" : "\\b(XFILE|FILES|FILE1)\\b",
  "\\S" : "\\S",
  "\\a" : "[A-Za-z]",
  "\\d" : "\\d",
  "\\h" : "[A-Za-z_]",
  "\\s" : "\\s",
  "\\v^d%[elete][lp]$" : "^d(elete|elet|ele|el|e)[lp]$",
  "\\v^s%(c[^sr][^i][^p]|g|i[^mlg]|I|r[^e])" : "^s(c[^sr][^i][^p]|g|i[^mlg]|I|r[^e])",
  "\\w" : "[0-9A-Za-z_]",
  "\\w\\|[:#]" : "[0-9A-Za-z_]|[:#]",
  "\\x" : "[0-9A-Fa-f]",
  "^++" : "^\+\+",
  "^++bad=\\(keep\\|drop\\|.\\)\\>" : "^\\+\\+bad=(keep|drop|.)\\b",
  "^++bad=drop" : "^\\+\\+bad=drop",
  "^++bad=keep" : "^\\+\\+bad=keep",
  "^++bin\\>" : "^\\+\\+bin\\b",
  "^++edit\\>" : "^\\+\\+edit\\b",
  "^++enc=\\S" : "^\\+\\+enc=\\S",
  "^++encoding=\\S" : "^\\+\\+encoding=\\S",
  "^++ff=\\(dos\\|unix\\|mac\\)\\>" : "^\\+\\+ff=(dos|unix|mac)\\b",
  "^++fileformat=\\(dos\\|unix\\|mac\\)\\>" : "^\\+\\+fileformat=(dos|unix|mac)\\b",
  "^++nobin\\>" : "^\\+\\+nobin\\b",
  "^[A-Z]" : "^[A-Z]",
  "^\\$\\w\\+" : "^\\$[0-9A-Za-z_]+",
  "^\\(!\\|global\\|vglobal\\)$" : "^(!|global|vglobal)$",
  "^\\(WHILE\\|FOR\\)$" : "^(WHILE|FOR)$",
  "^\\(vimgrep\\|vimgrepadd\\|lvimgrep\\|lvimgrepadd\\)$" : "^(vimgrep|vimgrepadd|lvimgrep|lvimgrepadd)$",
  "^\\d" : "^\\d",
  "^\\h" : "^[A-Za-z_]",
  "^\\s" : "^\\s",
  "^\\s*\\\\" : "^\\s*\\\\",
  "^[ \\t]$" : "^[ \\t]$",
  "^[A-Za-z]$" : "^[A-Za-z]$",
  "^[0-9A-Za-z]$" : "^[0-9A-Za-z]$",
  "^[0-9]$" : "^[0-9]$",
  "^[0-9A-Fa-f]$" : "^[0-9A-Fa-f]$",
  "^[0-9A-Za-z_]$" : "^[0-9A-Za-z_]$",
  "^[A-Za-z_]$" : "^[A-Za-z_]$",
  "^[0-9A-Za-z_:#]$" : "^[0-9A-Za-z_:#]$",
  "^[A-Za-z_][0-9A-Za-z_]*$" : "^[A-Za-z_][0-9A-Za-z_]*$",
  "^[A-Z]$" : "^[A-Z]$",
  "^[a-z]$" : "^[a-z]$",
  "^[vgslabwt]:$\\|^\\([vgslabwt]:\\)\\?[A-Za-z_][0-9A-Za-z_#]*$" : "^[vgslabwt]:$|^([vgslabwt]:)?[A-Za-z_][0-9A-Za-z_#]*$",
  "^[0-7]$" : "^[0-7]$",
  "^[0-9A-Fa-f][0-9A-Fa-f]$" : "^[0-9A-Fa-f][0-9A-Fa-f]$",
  "^\\.[0-9A-Fa-f]$" : "^\\.[0-9A-Fa-f]$",
  "^[0-9A-Fa-f][^0-9A-Fa-f]$" : "^[0-9A-Fa-f][^0-9A-Fa-f]$",
}

function viml_add(lst, item) {
    lst.push(item);
}

function viml_call(func, args) {
    return func.apply(null, args);
}

function viml_char2nr(c) {
  return c.charCodeAt(0);
}

function viml_empty(obj) {
    return obj.length == 0;
}

function viml_equalci(a, b) {
    return a.toLowerCase() == b.toLowerCase();
}

function viml_eqreg(s, reg) {
    var mx = new RegExp(pat_vim2js[reg]);
    return mx.exec(s) != null;
}

function viml_eqregh(s, reg) {
    var mx = new RegExp(pat_vim2js[reg]);
    return mx.exec(s) != null;
}

function viml_eqregq(s, reg) {
    var mx = new RegExp(pat_vim2js[reg], "i");
    return mx.exec(s) != null;
}

function viml_escape(s, chars) {
    var r = '';
    for (var i = 0; i < s.length; ++i) {
        if (chars.indexOf(s.charAt(i)) != -1) {
            r = r + "\\" + s.charAt(i);
        } else {
            r = r + s.charAt(i);
        }
    }
    return r;
}

function viml_extend(obj, item) {
    obj.push.apply(obj, item);
}

function viml_insert(lst, item) {
    var idx = arguments.length >= 3 ? arguments[2] : 0;
    lst.splice(0, 0, item);
}

function viml_join(lst, sep) {
    return lst.join(sep);
}

function viml_keys(obj) {
    return Object.keys(obj);
}

function viml_len(obj) {
    if (typeof obj === 'string') {
      var len = 0;
      for (var i = 0; i < obj.length; i++) {
          var c = obj.charCodeAt(i);
          len += c < 128 ? 1 : ((c > 127) && (c < 2048)) ? 2 : 3;
      }
      return len;
    }
    return obj.length;
}

function viml_printf() {
    var a000 = Array.prototype.slice.call(arguments, 0);
    if (a000.length == 1) {
        return a000[0];
    } else {
        return util.format.apply(null, a000);
    }
}

function viml_range(start) {
    var end = arguments.length >= 2 ? arguments[1] : null;
    if (end == null) {
        var x = [];
        for (var i = 0; i < start; ++i) {
            x.push(i);
        }
        return x;
    } else {
        var x = []
        for (var i = start; i <= end; ++i) {
            x.push(i);
        }
        return x;
    }
}

function viml_readfile(path) {
    // FIXME: newline?
    return fs.readFileSync(path, 'utf-8').split(/\r\n|\r|\n/);
}

function viml_remove(lst, idx) {
    lst.splice(idx, 1);
}

function viml_split(s, sep) {
    if (sep == "\\zs") {
        return s.split("");
    }
    throw "NotImplemented";
}

function viml_str2nr(s) {
    var base = arguments.length >= 2 ? arguments[1] : 10;
    return parseInt(s, base);
}

function viml_string(obj) {
    return obj.toString();
}

function viml_has_key(obj, key) {
    return obj[key] !== undefined;
}

function viml_stridx(a, b) {
    return a.indexOf(b);
}

var NIL = [];
var TRUE = 1;
var FALSE = 0;
var NODE_TOPLEVEL = 1;
var NODE_COMMENT = 2;
var NODE_EXCMD = 3;
var NODE_FUNCTION = 4;
var NODE_ENDFUNCTION = 5;
var NODE_DELFUNCTION = 6;
var NODE_RETURN = 7;
var NODE_EXCALL = 8;
var NODE_LET = 9;
var NODE_UNLET = 10;
var NODE_LOCKVAR = 11;
var NODE_UNLOCKVAR = 12;
var NODE_IF = 13;
var NODE_ELSEIF = 14;
var NODE_ELSE = 15;
var NODE_ENDIF = 16;
var NODE_WHILE = 17;
var NODE_ENDWHILE = 18;
var NODE_FOR = 19;
var NODE_ENDFOR = 20;
var NODE_CONTINUE = 21;
var NODE_BREAK = 22;
var NODE_TRY = 23;
var NODE_CATCH = 24;
var NODE_FINALLY = 25;
var NODE_ENDTRY = 26;
var NODE_THROW = 27;
var NODE_ECHO = 28;
var NODE_ECHON = 29;
var NODE_ECHOHL = 30;
var NODE_ECHOMSG = 31;
var NODE_ECHOERR = 32;
var NODE_EXECUTE = 33;
var NODE_TERNARY = 34;
var NODE_OR = 35;
var NODE_AND = 36;
var NODE_EQUAL = 37;
var NODE_EQUALCI = 38;
var NODE_EQUALCS = 39;
var NODE_NEQUAL = 40;
var NODE_NEQUALCI = 41;
var NODE_NEQUALCS = 42;
var NODE_GREATER = 43;
var NODE_GREATERCI = 44;
var NODE_GREATERCS = 45;
var NODE_GEQUAL = 46;
var NODE_GEQUALCI = 47;
var NODE_GEQUALCS = 48;
var NODE_SMALLER = 49;
var NODE_SMALLERCI = 50;
var NODE_SMALLERCS = 51;
var NODE_SEQUAL = 52;
var NODE_SEQUALCI = 53;
var NODE_SEQUALCS = 54;
var NODE_MATCH = 55;
var NODE_MATCHCI = 56;
var NODE_MATCHCS = 57;
var NODE_NOMATCH = 58;
var NODE_NOMATCHCI = 59;
var NODE_NOMATCHCS = 60;
var NODE_IS = 61;
var NODE_ISCI = 62;
var NODE_ISCS = 63;
var NODE_ISNOT = 64;
var NODE_ISNOTCI = 65;
var NODE_ISNOTCS = 66;
var NODE_ADD = 67;
var NODE_SUBTRACT = 68;
var NODE_CONCAT = 69;
var NODE_MULTIPLY = 70;
var NODE_DIVIDE = 71;
var NODE_REMAINDER = 72;
var NODE_NOT = 73;
var NODE_MINUS = 74;
var NODE_PLUS = 75;
var NODE_SUBSCRIPT = 76;
var NODE_SLICE = 77;
var NODE_CALL = 78;
var NODE_DOT = 79;
var NODE_NUMBER = 80;
var NODE_STRING = 81;
var NODE_LIST = 82;
var NODE_DICT = 83;
var NODE_OPTION = 85;
var NODE_IDENTIFIER = 86;
var NODE_CURLYNAME = 87;
var NODE_ENV = 88;
var NODE_REG = 89;
var NODE_CURLYNAMEPART = 90;
var NODE_CURLYNAMEEXPR = 91;
var NODE_LAMBDA = 92;
var NODE_BLOB = 93;
var NODE_CONST = 94;
var NODE_EVAL = 95;
var NODE_HEREDOC = 96;
var NODE_METHOD = 97;
var TOKEN_EOF = 1;
var TOKEN_EOL = 2;
var TOKEN_SPACE = 3;
var TOKEN_OROR = 4;
var TOKEN_ANDAND = 5;
var TOKEN_EQEQ = 6;
var TOKEN_EQEQCI = 7;
var TOKEN_EQEQCS = 8;
var TOKEN_NEQ = 9;
var TOKEN_NEQCI = 10;
var TOKEN_NEQCS = 11;
var TOKEN_GT = 12;
var TOKEN_GTCI = 13;
var TOKEN_GTCS = 14;
var TOKEN_GTEQ = 15;
var TOKEN_GTEQCI = 16;
var TOKEN_GTEQCS = 17;
var TOKEN_LT = 18;
var TOKEN_LTCI = 19;
var TOKEN_LTCS = 20;
var TOKEN_LTEQ = 21;
var TOKEN_LTEQCI = 22;
var TOKEN_LTEQCS = 23;
var TOKEN_MATCH = 24;
var TOKEN_MATCHCI = 25;
var TOKEN_MATCHCS = 26;
var TOKEN_NOMATCH = 27;
var TOKEN_NOMATCHCI = 28;
var TOKEN_NOMATCHCS = 29;
var TOKEN_IS = 30;
var TOKEN_ISCI = 31;
var TOKEN_ISCS = 32;
var TOKEN_ISNOT = 33;
var TOKEN_ISNOTCI = 34;
var TOKEN_ISNOTCS = 35;
var TOKEN_PLUS = 36;
var TOKEN_MINUS = 37;
var TOKEN_DOT = 38;
var TOKEN_STAR = 39;
var TOKEN_SLASH = 40;
var TOKEN_PERCENT = 41;
var TOKEN_NOT = 42;
var TOKEN_QUESTION = 43;
var TOKEN_COLON = 44;
var TOKEN_POPEN = 45;
var TOKEN_PCLOSE = 46;
var TOKEN_SQOPEN = 47;
var TOKEN_SQCLOSE = 48;
var TOKEN_COPEN = 49;
var TOKEN_CCLOSE = 50;
var TOKEN_COMMA = 51;
var TOKEN_NUMBER = 52;
var TOKEN_SQUOTE = 53;
var TOKEN_DQUOTE = 54;
var TOKEN_OPTION = 55;
var TOKEN_IDENTIFIER = 56;
var TOKEN_ENV = 57;
var TOKEN_REG = 58;
var TOKEN_EQ = 59;
var TOKEN_OR = 60;
var TOKEN_SEMICOLON = 61;
var TOKEN_BACKTICK = 62;
var TOKEN_DOTDOTDOT = 63;
var TOKEN_SHARP = 64;
var TOKEN_ARROW = 65;
var TOKEN_BLOB = 66;
var TOKEN_LITCOPEN = 67;
var TOKEN_DOTDOT = 68;
var TOKEN_HEREDOC = 69;
var MAX_FUNC_ARGS = 20;
function isalpha(c) {
    return viml_eqregh(c, "^[A-Za-z]$");
}

function isalnum(c) {
    return viml_eqregh(c, "^[0-9A-Za-z]$");
}

function isdigit(c) {
    return viml_eqregh(c, "^[0-9]$");
}

function isodigit(c) {
    return viml_eqregh(c, "^[0-7]$");
}

function isxdigit(c) {
    return viml_eqregh(c, "^[0-9A-Fa-f]$");
}

function iswordc(c) {
    return viml_eqregh(c, "^[0-9A-Za-z_]$");
}

function iswordc1(c) {
    return viml_eqregh(c, "^[A-Za-z_]$");
}

function iswhite(c) {
    return viml_eqregh(c, "^[ \\t]$");
}

function isnamec(c) {
    return viml_eqregh(c, "^[0-9A-Za-z_:#]$");
}

function isnamec1(c) {
    return viml_eqregh(c, "^[A-Za-z_]$");
}

function isargname(s) {
    return viml_eqregh(s, "^[A-Za-z_][0-9A-Za-z_]*$");
}

function isvarname(s) {
    return viml_eqregh(s, "^[vgslabwt]:$\\|^\\([vgslabwt]:\\)\\?[A-Za-z_][0-9A-Za-z_#]*$");
}

// FIXME:
function isidc(c) {
    return viml_eqregh(c, "^[0-9A-Za-z_]$");
}

function isupper(c) {
    return viml_eqregh(c, "^[A-Z]$");
}

function islower(c) {
    return viml_eqregh(c, "^[a-z]$");
}

function ExArg() {
    var ea = {};
    ea.forceit = FALSE;
    ea.addr_count = 0;
    ea.line1 = 0;
    ea.line2 = 0;
    ea.flags = 0;
    ea.do_ecmd_cmd = "";
    ea.do_ecmd_lnum = 0;
    ea.append = 0;
    ea.usefilter = FALSE;
    ea.amount = 0;
    ea.regname = 0;
    ea.force_bin = 0;
    ea.read_edit = 0;
    ea.force_ff = 0;
    ea.force_enc = 0;
    ea.bad_char = 0;
    ea.linepos = {};
    ea.cmdpos = [];
    ea.argpos = [];
    ea.cmd = {};
    ea.modifiers = [];
    ea.range = [];
    ea.argopt = {};
    ea.argcmd = {};
    return ea;
}

// struct node {
//   int     type
//   pos     pos
//   node    left
//   node    right
//   node    cond
//   node    rest
//   node[]  list
//   node[]  rlist
//   node[]  default_args
//   node[]  body
//   string  op
//   string  str
//   int     depth
//   variant value
// }
// TOPLEVEL .body
// COMMENT .str
// EXCMD .ea .str
// FUNCTION .ea .body .left .rlist .default_args .attr .endfunction
// ENDFUNCTION .ea
// DELFUNCTION .ea .left
// RETURN .ea .left
// EXCALL .ea .left
// LET .ea .op .left .list .rest .right
// CONST .ea .op .left .list .rest .right
// UNLET .ea .list
// LOCKVAR .ea .depth .list
// UNLOCKVAR .ea .depth .list
// IF .ea .body .cond .elseif .else .endif
// ELSEIF .ea .body .cond
// ELSE .ea .body
// ENDIF .ea
// WHILE .ea .body .cond .endwhile
// ENDWHILE .ea
// FOR .ea .body .left .list .rest .right .endfor
// ENDFOR .ea
// CONTINUE .ea
// BREAK .ea
// TRY .ea .body .catch .finally .endtry
// CATCH .ea .body .pattern
// FINALLY .ea .body
// ENDTRY .ea
// THROW .ea .left
// EVAL .ea .left
// ECHO .ea .list
// ECHON .ea .list
// ECHOHL .ea .str
// ECHOMSG .ea .list
// ECHOERR .ea .list
// EXECUTE .ea .list
// TERNARY .cond .left .right
// OR .left .right
// AND .left .right
// EQUAL .left .right
// EQUALCI .left .right
// EQUALCS .left .right
// NEQUAL .left .right
// NEQUALCI .left .right
// NEQUALCS .left .right
// GREATER .left .right
// GREATERCI .left .right
// GREATERCS .left .right
// GEQUAL .left .right
// GEQUALCI .left .right
// GEQUALCS .left .right
// SMALLER .left .right
// SMALLERCI .left .right
// SMALLERCS .left .right
// SEQUAL .left .right
// SEQUALCI .left .right
// SEQUALCS .left .right
// MATCH .left .right
// MATCHCI .left .right
// MATCHCS .left .right
// NOMATCH .left .right
// NOMATCHCI .left .right
// NOMATCHCS .left .right
// IS .left .right
// ISCI .left .right
// ISCS .left .right
// ISNOT .left .right
// ISNOTCI .left .right
// ISNOTCS .left .right
// ADD .left .right
// SUBTRACT .left .right
// CONCAT .left .right
// MULTIPLY .left .right
// DIVIDE .left .right
// REMAINDER .left .right
// NOT .left
// MINUS .left
// PLUS .left
// SUBSCRIPT .left .right
// SLICE .left .rlist
// METHOD .left .right
// CALL .left .rlist
// DOT .left .right
// NUMBER .value
// STRING .value
// LIST .value
// DICT .value
// BLOB .value
// NESTING .left
// OPTION .value
// IDENTIFIER .value
// CURLYNAME .value
// ENV .value
// REG .value
// CURLYNAMEPART .value
// CURLYNAMEEXPR .value
// LAMBDA .rlist .left
// HEREDOC .rlist .op .body
function Node(type) {
    return {"type":type};
}

function Err(msg, pos) {
    return viml_printf("vimlparser: %s: line %d col %d", msg, pos.lnum, pos.col);
}

function VimLParser() { this.__init__.apply(this, arguments); }
VimLParser.prototype.__init__ = function() {
    var a000 = Array.prototype.slice.call(arguments, 0);
    if (viml_len(a000) > 0) {
        this.neovim = a000[0];
    }
    else {
        this.neovim = 0;
    }
    this.find_command_cache = {};
}

VimLParser.prototype.push_context = function(node) {
    viml_insert(this.context, node);
}

VimLParser.prototype.pop_context = function() {
    viml_remove(this.context, 0);
}

VimLParser.prototype.find_context = function(type) {
    var i = 0;
    var __c3 = this.context;
    for (var __i3 = 0; __i3 < __c3.length; ++__i3) {
        var node = __c3[__i3];
        if (node.type == type) {
            return i;
        }
        i += 1;
    }
    return -1;
}

VimLParser.prototype.add_node = function(node) {
    viml_add(this.context[0].body, node);
}

VimLParser.prototype.check_missing_endfunction = function(ends, pos) {
    if (this.context[0].type == NODE_FUNCTION) {
        throw Err(viml_printf("E126: Missing :endfunction:    %s", ends), pos);
    }
}

VimLParser.prototype.check_missing_endif = function(ends, pos) {
    if (this.context[0].type == NODE_IF || this.context[0].type == NODE_ELSEIF || this.context[0].type == NODE_ELSE) {
        throw Err(viml_printf("E171: Missing :endif:    %s", ends), pos);
    }
}

VimLParser.prototype.check_missing_endtry = function(ends, pos) {
    if (this.context[0].type == NODE_TRY || this.context[0].type == NODE_CATCH || this.context[0].type == NODE_FINALLY) {
        throw Err(viml_printf("E600: Missing :endtry:    %s", ends), pos);
    }
}

VimLParser.prototype.check_missing_endwhile = function(ends, pos) {
    if (this.context[0].type == NODE_WHILE) {
        throw Err(viml_printf("E170: Missing :endwhile:    %s", ends), pos);
    }
}

VimLParser.prototype.check_missing_endfor = function(ends, pos) {
    if (this.context[0].type == NODE_FOR) {
        throw Err(viml_printf("E170: Missing :endfor:    %s", ends), pos);
    }
}

VimLParser.prototype.parse = function(reader) {
    this.reader = reader;
    this.context = [];
    var toplevel = Node(NODE_TOPLEVEL);
    toplevel.pos = this.reader.getpos();
    toplevel.body = [];
    this.push_context(toplevel);
    while (this.reader.peek() != "<EOF>") {
        this.parse_one_cmd();
    }
    this.check_missing_endfunction("TOPLEVEL", this.reader.getpos());
    this.check_missing_endif("TOPLEVEL", this.reader.getpos());
    this.check_missing_endtry("TOPLEVEL", this.reader.getpos());
    this.check_missing_endwhile("TOPLEVEL", this.reader.getpos());
    this.check_missing_endfor("TOPLEVEL", this.reader.getpos());
    this.pop_context();
    return toplevel;
}

VimLParser.prototype.parse_one_cmd = function() {
    this.ea = ExArg();
    if (this.reader.peekn(2) == "#!") {
        this.parse_hashbang();
        this.reader.get();
        return;
    }
    this.reader.skip_white_and_colon();
    if (this.reader.peekn(1) == "") {
        this.reader.get();
        return;
    }
    if (this.reader.peekn(1) == "\"") {
        this.parse_comment();
        this.reader.get();
        return;
    }
    this.ea.linepos = this.reader.getpos();
    this.parse_command_modifiers();
    this.parse_range();
    this.parse_command();
    this.parse_trail();
}

// FIXME:
VimLParser.prototype.parse_command_modifiers = function() {
    var modifiers = [];
    while (TRUE) {
        var pos = this.reader.tell();
        var d = "";
        if (isdigit(this.reader.peekn(1))) {
            var d = this.reader.read_digit();
            this.reader.skip_white();
        }
        var k = this.reader.read_alpha();
        var c = this.reader.peekn(1);
        this.reader.skip_white();
        if (viml_stridx("aboveleft", k) == 0 && viml_len(k) >= 3) {
            // abo\%[veleft]
            viml_add(modifiers, {"name":"aboveleft"});
        }
        else if (viml_stridx("belowright", k) == 0 && viml_len(k) >= 3) {
            // bel\%[owright]
            viml_add(modifiers, {"name":"belowright"});
        }
        else if (viml_stridx("browse", k) == 0 && viml_len(k) >= 3) {
            // bro\%[wse]
            viml_add(modifiers, {"name":"browse"});
        }
        else if (viml_stridx("botright", k) == 0 && viml_len(k) >= 2) {
            // bo\%[tright]
            viml_add(modifiers, {"name":"botright"});
        }
        else if (viml_stridx("confirm", k) == 0 && viml_len(k) >= 4) {
            // conf\%[irm]
            viml_add(modifiers, {"name":"confirm"});
        }
        else if (viml_stridx("keepmarks", k) == 0 && viml_len(k) >= 3) {
            // kee\%[pmarks]
            viml_add(modifiers, {"name":"keepmarks"});
        }
        else if (viml_stridx("keepalt", k) == 0 && viml_len(k) >= 5) {
            // keepa\%[lt]
            viml_add(modifiers, {"name":"keepalt"});
        }
        else if (viml_stridx("keepjumps", k) == 0 && viml_len(k) >= 5) {
            // keepj\%[umps]
            viml_add(modifiers, {"name":"keepjumps"});
        }
        else if (viml_stridx("keeppatterns", k) == 0 && viml_len(k) >= 5) {
            // keepp\%[atterns]
            viml_add(modifiers, {"name":"keeppatterns"});
        }
        else if (viml_stridx("hide", k) == 0 && viml_len(k) >= 3) {
            // hid\%[e]
            if (this.ends_excmds(c)) {
                break;
            }
            viml_add(modifiers, {"name":"hide"});
        }
        else if (viml_stridx("lockmarks", k) == 0 && viml_len(k) >= 3) {
            // loc\%[kmarks]
            viml_add(modifiers, {"name":"lockmarks"});
        }
        else if (viml_stridx("leftabove", k) == 0 && viml_len(k) >= 5) {
            // lefta\%[bove]
            viml_add(modifiers, {"name":"leftabove"});
        }
        else if (viml_stridx("noautocmd", k) == 0 && viml_len(k) >= 3) {
            // noa\%[utocmd]
            viml_add(modifiers, {"name":"noautocmd"});
        }
        else if (viml_stridx("noswapfile", k) == 0 && viml_len(k) >= 3) {
            // :nos\%[wapfile]
            viml_add(modifiers, {"name":"noswapfile"});
        }
        else if (viml_stridx("rightbelow", k) == 0 && viml_len(k) >= 6) {
            // rightb\%[elow]
            viml_add(modifiers, {"name":"rightbelow"});
        }
        else if (viml_stridx("sandbox", k) == 0 && viml_len(k) >= 3) {
            // san\%[dbox]
            viml_add(modifiers, {"name":"sandbox"});
        }
        else if (viml_stridx("silent", k) == 0 && viml_len(k) >= 3) {
            // sil\%[ent]
            if (c == "!") {
                this.reader.get();
                viml_add(modifiers, {"name":"silent", "bang":1});
            }
            else {
                viml_add(modifiers, {"name":"silent", "bang":0});
            }
        }
        else if (k == "tab") {
            // tab
            if (d != "") {
                viml_add(modifiers, {"name":"tab", "count":viml_str2nr(d, 10)});
            }
            else {
                viml_add(modifiers, {"name":"tab"});
            }
        }
        else if (viml_stridx("topleft", k) == 0 && viml_len(k) >= 2) {
            // to\%[pleft]
            viml_add(modifiers, {"name":"topleft"});
        }
        else if (viml_stridx("unsilent", k) == 0 && viml_len(k) >= 3) {
            // uns\%[ilent]
            viml_add(modifiers, {"name":"unsilent"});
        }
        else if (viml_stridx("vertical", k) == 0 && viml_len(k) >= 4) {
            // vert\%[ical]
            viml_add(modifiers, {"name":"vertical"});
        }
        else if (viml_stridx("verbose", k) == 0 && viml_len(k) >= 4) {
            // verb\%[ose]
            if (d != "") {
                viml_add(modifiers, {"name":"verbose", "count":viml_str2nr(d, 10)});
            }
            else {
                viml_add(modifiers, {"name":"verbose", "count":1});
            }
        }
        else {
            this.reader.seek_set(pos);
            break;
        }
    }
    this.ea.modifiers = modifiers;
}

// FIXME:
VimLParser.prototype.parse_range = function() {
    var tokens = [];
    while (TRUE) {
        while (TRUE) {
            this.reader.skip_white();
            var c = this.reader.peekn(1);
            if (c == "") {
                break;
            }
            if (c == ".") {
                viml_add(tokens, this.reader.getn(1));
            }
            else if (c == "$") {
                viml_add(tokens, this.reader.getn(1));
            }
            else if (c == "'") {
                this.reader.getn(1);
                var m = this.reader.getn(1);
                if (m == "") {
                    break;
                }
                viml_add(tokens, "'" + m);
            }
            else if (c == "/") {
                this.reader.getn(1);
                var __tmp = this.parse_pattern(c);
                var pattern = __tmp[0];
                var _ = __tmp[1];
                viml_add(tokens, pattern);
            }
            else if (c == "?") {
                this.reader.getn(1);
                var __tmp = this.parse_pattern(c);
                var pattern = __tmp[0];
                var _ = __tmp[1];
                viml_add(tokens, pattern);
            }
            else if (c == "\\") {
                var m = this.reader.p(1);
                if (m == "&" || m == "?" || m == "/") {
                    this.reader.seek_cur(2);
                    viml_add(tokens, "\\" + m);
                }
                else {
                    throw Err("E10: \\\\ should be followed by /, ? or &", this.reader.getpos());
                }
            }
            else if (isdigit(c)) {
                viml_add(tokens, this.reader.read_digit());
            }
            while (TRUE) {
                this.reader.skip_white();
                if (this.reader.peekn(1) == "") {
                    break;
                }
                var n = this.reader.read_integer();
                if (n == "") {
                    break;
                }
                viml_add(tokens, n);
            }
            if (this.reader.p(0) != "/" && this.reader.p(0) != "?") {
                break;
            }
        }
        if (this.reader.peekn(1) == "%") {
            viml_add(tokens, this.reader.getn(1));
        }
        else if (this.reader.peekn(1) == "*") {
            // && &cpoptions !~ '\*'
            viml_add(tokens, this.reader.getn(1));
        }
        if (this.reader.peekn(1) == ";") {
            viml_add(tokens, this.reader.getn(1));
            continue;
        }
        else if (this.reader.peekn(1) == ",") {
            viml_add(tokens, this.reader.getn(1));
            continue;
        }
        break;
    }
    this.ea.range = tokens;
}

// FIXME:
VimLParser.prototype.parse_pattern = function(delimiter) {
    var pattern = "";
    var endc = "";
    var inbracket = 0;
    while (TRUE) {
        var c = this.reader.getn(1);
        if (c == "") {
            break;
        }
        if (c == delimiter && inbracket == 0) {
            var endc = c;
            break;
        }
        pattern += c;
        if (c == "\\") {
            var c = this.reader.peekn(1);
            if (c == "") {
                throw Err("E682: Invalid search pattern or delimiter", this.reader.getpos());
            }
            this.reader.getn(1);
            pattern += c;
        }
        else if (c == "[") {
            inbracket += 1;
        }
        else if (c == "]") {
            inbracket -= 1;
        }
    }
    return [pattern, endc];
}

VimLParser.prototype.parse_command = function() {
    this.reader.skip_white_and_colon();
    this.ea.cmdpos = this.reader.getpos();
    if (this.reader.peekn(1) == "" || this.reader.peekn(1) == "\"") {
        if (!viml_empty(this.ea.modifiers) || !viml_empty(this.ea.range)) {
            this.parse_cmd_modifier_range();
        }
        return;
    }
    this.ea.cmd = this.find_command();
    if (this.ea.cmd === NIL) {
        this.reader.setpos(this.ea.cmdpos);
        throw Err(viml_printf("E492: Not an editor command: %s", this.reader.peekline()), this.ea.cmdpos);
    }
    if (this.reader.peekn(1) == "!" && this.ea.cmd.name != "substitute" && this.ea.cmd.name != "smagic" && this.ea.cmd.name != "snomagic") {
        this.reader.getn(1);
        this.ea.forceit = TRUE;
    }
    else {
        this.ea.forceit = FALSE;
    }
    if (!viml_eqregh(this.ea.cmd.flags, "\\<BANG\\>") && this.ea.forceit && !viml_eqregh(this.ea.cmd.flags, "\\<USERCMD\\>")) {
        throw Err("E477: No ! allowed", this.ea.cmdpos);
    }
    if (this.ea.cmd.name != "!") {
        this.reader.skip_white();
    }
    this.ea.argpos = this.reader.getpos();
    if (viml_eqregh(this.ea.cmd.flags, "\\<ARGOPT\\>")) {
        this.parse_argopt();
    }
    if (this.ea.cmd.name == "write" || this.ea.cmd.name == "update") {
        if (this.reader.p(0) == ">") {
            if (this.reader.p(1) != ">") {
                throw Err("E494: Use w or w>>", this.ea.cmdpos);
            }
            this.reader.seek_cur(2);
            this.reader.skip_white();
            this.ea.append = 1;
        }
        else if (this.reader.peekn(1) == "!" && this.ea.cmd.name == "write") {
            this.reader.getn(1);
            this.ea.usefilter = TRUE;
        }
    }
    if (this.ea.cmd.name == "read") {
        if (this.ea.forceit) {
            this.ea.usefilter = TRUE;
            this.ea.forceit = FALSE;
        }
        else if (this.reader.peekn(1) == "!") {
            this.reader.getn(1);
            this.ea.usefilter = TRUE;
        }
    }
    if (this.ea.cmd.name == "<" || this.ea.cmd.name == ">") {
        this.ea.amount = 1;
        while (this.reader.peekn(1) == this.ea.cmd.name) {
            this.reader.getn(1);
            this.ea.amount += 1;
        }
        this.reader.skip_white();
    }
    if (viml_eqregh(this.ea.cmd.flags, "\\<EDITCMD\\>") && !this.ea.usefilter) {
        this.parse_argcmd();
    }
    this._parse_command(this.ea.cmd.parser);
}

// TODO: self[a:parser]
VimLParser.prototype._parse_command = function(parser) {
    if (parser == "parse_cmd_append") {
        this.parse_cmd_append();
    }
    else if (parser == "parse_cmd_break") {
        this.parse_cmd_break();
    }
    else if (parser == "parse_cmd_call") {
        this.parse_cmd_call();
    }
    else if (parser == "parse_cmd_catch") {
        this.parse_cmd_catch();
    }
    else if (parser == "parse_cmd_common") {
        this.parse_cmd_common();
    }
    else if (parser == "parse_cmd_continue") {
        this.parse_cmd_continue();
    }
    else if (parser == "parse_cmd_delfunction") {
        this.parse_cmd_delfunction();
    }
    else if (parser == "parse_cmd_echo") {
        this.parse_cmd_echo();
    }
    else if (parser == "parse_cmd_echoerr") {
        this.parse_cmd_echoerr();
    }
    else if (parser == "parse_cmd_echohl") {
        this.parse_cmd_echohl();
    }
    else if (parser == "parse_cmd_echomsg") {
        this.parse_cmd_echomsg();
    }
    else if (parser == "parse_cmd_echon") {
        this.parse_cmd_echon();
    }
    else if (parser == "parse_cmd_else") {
        this.parse_cmd_else();
    }
    else if (parser == "parse_cmd_elseif") {
        this.parse_cmd_elseif();
    }
    else if (parser == "parse_cmd_endfor") {
        this.parse_cmd_endfor();
    }
    else if (parser == "parse_cmd_endfunction") {
        this.parse_cmd_endfunction();
    }
    else if (parser == "parse_cmd_endif") {
        this.parse_cmd_endif();
    }
    else if (parser == "parse_cmd_endtry") {
        this.parse_cmd_endtry();
    }
    else if (parser == "parse_cmd_endwhile") {
        this.parse_cmd_endwhile();
    }
    else if (parser == "parse_cmd_execute") {
        this.parse_cmd_execute();
    }
    else if (parser == "parse_cmd_finally") {
        this.parse_cmd_finally();
    }
    else if (parser == "parse_cmd_finish") {
        this.parse_cmd_finish();
    }
    else if (parser == "parse_cmd_for") {
        this.parse_cmd_for();
    }
    else if (parser == "parse_cmd_function") {
        this.parse_cmd_function();
    }
    else if (parser == "parse_cmd_if") {
        this.parse_cmd_if();
    }
    else if (parser == "parse_cmd_insert") {
        this.parse_cmd_insert();
    }
    else if (parser == "parse_cmd_let") {
        this.parse_cmd_let();
    }
    else if (parser == "parse_cmd_const") {
        this.parse_cmd_const();
    }
    else if (parser == "parse_cmd_loadkeymap") {
        this.parse_cmd_loadkeymap();
    }
    else if (parser == "parse_cmd_lockvar") {
        this.parse_cmd_lockvar();
    }
    else if (parser == "parse_cmd_lua") {
        this.parse_cmd_lua();
    }
    else if (parser == "parse_cmd_modifier_range") {
        this.parse_cmd_modifier_range();
    }
    else if (parser == "parse_cmd_mzscheme") {
        this.parse_cmd_mzscheme();
    }
    else if (parser == "parse_cmd_perl") {
        this.parse_cmd_perl();
    }
    else if (parser == "parse_cmd_python") {
        this.parse_cmd_python();
    }
    else if (parser == "parse_cmd_python3") {
        this.parse_cmd_python3();
    }
    else if (parser == "parse_cmd_return") {
        this.parse_cmd_return();
    }
    else if (parser == "parse_cmd_ruby") {
        this.parse_cmd_ruby();
    }
    else if (parser == "parse_cmd_tcl") {
        this.parse_cmd_tcl();
    }
    else if (parser == "parse_cmd_throw") {
        this.parse_cmd_throw();
    }
    else if (parser == "parse_cmd_eval") {
        this.parse_cmd_eval();
    }
    else if (parser == "parse_cmd_try") {
        this.parse_cmd_try();
    }
    else if (parser == "parse_cmd_unlet") {
        this.parse_cmd_unlet();
    }
    else if (parser == "parse_cmd_unlockvar") {
        this.parse_cmd_unlockvar();
    }
    else if (parser == "parse_cmd_usercmd") {
        this.parse_cmd_usercmd();
    }
    else if (parser == "parse_cmd_while") {
        this.parse_cmd_while();
    }
    else if (parser == "parse_wincmd") {
        this.parse_wincmd();
    }
    else if (parser == "parse_cmd_syntax") {
        this.parse_cmd_syntax();
    }
    else {
        throw viml_printf("unknown parser: %s", viml_string(parser));
    }
}

VimLParser.prototype.find_command = function() {
    var c = this.reader.peekn(1);
    var name = "";
    if (c == "k") {
        this.reader.getn(1);
        var name = "k";
    }
    else if (c == "s" && viml_eqregh(this.reader.peekn(5), "\\v^s%(c[^sr][^i][^p]|g|i[^mlg]|I|r[^e])")) {
        this.reader.getn(1);
        var name = "substitute";
    }
    else if (viml_eqregh(c, "[@*!=><&~#]")) {
        this.reader.getn(1);
        var name = c;
    }
    else if (this.reader.peekn(2) == "py") {
        var name = this.reader.read_alnum();
    }
    else {
        var pos = this.reader.tell();
        var name = this.reader.read_alpha();
        if (name != "del" && viml_eqregh(name, "\\v^d%[elete][lp]$")) {
            this.reader.seek_set(pos);
            var name = this.reader.getn(viml_len(name) - 1);
        }
    }
    if (name == "") {
        return NIL;
    }
    if (viml_has_key(this.find_command_cache, name)) {
        return this.find_command_cache[name];
    }
    var cmd = NIL;
    var __c4 = this.builtin_commands;
    for (var __i4 = 0; __i4 < __c4.length; ++__i4) {
        var x = __c4[__i4];
        if (viml_stridx(x.name, name) == 0 && viml_len(name) >= x.minlen) {
            delete cmd;
            var cmd = x;
            break;
        }
    }
    if (this.neovim) {
        var __c5 = this.neovim_additional_commands;
        for (var __i5 = 0; __i5 < __c5.length; ++__i5) {
            var x = __c5[__i5];
            if (viml_stridx(x.name, name) == 0 && viml_len(name) >= x.minlen) {
                delete cmd;
                var cmd = x;
                break;
            }
        }
        var __c6 = this.neovim_removed_commands;
        for (var __i6 = 0; __i6 < __c6.length; ++__i6) {
            var x = __c6[__i6];
            if (viml_stridx(x.name, name) == 0 && viml_len(name) >= x.minlen) {
                delete cmd;
                var cmd = NIL;
                break;
            }
        }
    }
    // FIXME: user defined command
    if ((cmd === NIL || cmd.name == "Print") && viml_eqregh(name, "^[A-Z]")) {
        name += this.reader.read_alnum();
        delete cmd;
        var cmd = {"name":name, "flags":"USERCMD", "parser":"parse_cmd_usercmd"};
    }
    this.find_command_cache[name] = cmd;
    return cmd;
}

// TODO:
VimLParser.prototype.parse_hashbang = function() {
    this.reader.getn(-1);
}

// TODO:
// ++opt=val
VimLParser.prototype.parse_argopt = function() {
    while (this.reader.p(0) == "+" && this.reader.p(1) == "+") {
        var s = this.reader.peekn(20);
        if (viml_eqregh(s, "^++bin\\>")) {
            this.reader.getn(5);
            this.ea.force_bin = 1;
        }
        else if (viml_eqregh(s, "^++nobin\\>")) {
            this.reader.getn(7);
            this.ea.force_bin = 2;
        }
        else if (viml_eqregh(s, "^++edit\\>")) {
            this.reader.getn(6);
            this.ea.read_edit = 1;
        }
        else if (viml_eqregh(s, "^++ff=\\(dos\\|unix\\|mac\\)\\>")) {
            this.reader.getn(5);
            this.ea.force_ff = this.reader.read_alpha();
        }
        else if (viml_eqregh(s, "^++fileformat=\\(dos\\|unix\\|mac\\)\\>")) {
            this.reader.getn(13);
            this.ea.force_ff = this.reader.read_alpha();
        }
        else if (viml_eqregh(s, "^++enc=\\S")) {
            this.reader.getn(6);
            this.ea.force_enc = this.reader.read_nonwhite();
        }
        else if (viml_eqregh(s, "^++encoding=\\S")) {
            this.reader.getn(11);
            this.ea.force_enc = this.reader.read_nonwhite();
        }
        else if (viml_eqregh(s, "^++bad=\\(keep\\|drop\\|.\\)\\>")) {
            this.reader.getn(6);
            if (viml_eqregh(s, "^++bad=keep")) {
                this.ea.bad_char = this.reader.getn(4);
            }
            else if (viml_eqregh(s, "^++bad=drop")) {
                this.ea.bad_char = this.reader.getn(4);
            }
            else {
                this.ea.bad_char = this.reader.getn(1);
            }
        }
        else if (viml_eqregh(s, "^++")) {
            throw Err("E474: Invalid Argument", this.reader.getpos());
        }
        else {
            break;
        }
        this.reader.skip_white();
    }
}

// TODO:
// +command
VimLParser.prototype.parse_argcmd = function() {
    if (this.reader.peekn(1) == "+") {
        this.reader.getn(1);
        if (this.reader.peekn(1) == " ") {
            this.ea.do_ecmd_cmd = "$";
        }
        else {
            this.ea.do_ecmd_cmd = this.read_cmdarg();
        }
    }
}

VimLParser.prototype.read_cmdarg = function() {
    var r = "";
    while (TRUE) {
        var c = this.reader.peekn(1);
        if (c == "" || iswhite(c)) {
            break;
        }
        this.reader.getn(1);
        if (c == "\\") {
            var c = this.reader.getn(1);
        }
        r += c;
    }
    return r;
}

VimLParser.prototype.parse_comment = function() {
    var npos = this.reader.getpos();
    var c = this.reader.get();
    if (c != "\"") {
        throw Err(viml_printf("unexpected character: %s", c), npos);
    }
    var node = Node(NODE_COMMENT);
    node.pos = npos;
    node.str = this.reader.getn(-1);
    this.add_node(node);
}

VimLParser.prototype.parse_trail = function() {
    this.reader.skip_white();
    var c = this.reader.peek();
    if (c == "<EOF>") {
        // pass
    }
    else if (c == "<EOL>") {
        this.reader.get();
    }
    else if (c == "|") {
        this.reader.get();
    }
    else if (c == "\"") {
        this.parse_comment();
        this.reader.get();
    }
    else {
        throw Err(viml_printf("E488: Trailing characters: %s", c), this.reader.getpos());
    }
}

// modifier or range only command line
VimLParser.prototype.parse_cmd_modifier_range = function() {
    var node = Node(NODE_EXCMD);
    node.pos = this.ea.cmdpos;
    node.ea = this.ea;
    node.str = this.reader.getstr(this.ea.linepos, this.reader.getpos());
    this.add_node(node);
}

// TODO:
VimLParser.prototype.parse_cmd_common = function() {
    var end = this.reader.getpos();
    if (viml_eqregh(this.ea.cmd.flags, "\\<TRLBAR\\>") && !this.ea.usefilter) {
        var end = this.separate_nextcmd();
    }
    else if (this.ea.cmd.name == "!" || this.ea.cmd.name == "global" || this.ea.cmd.name == "vglobal" || this.ea.usefilter) {
        while (TRUE) {
            var end = this.reader.getpos();
            if (this.reader.getn(1) == "") {
                break;
            }
        }
    }
    else {
        while (TRUE) {
            var end = this.reader.getpos();
            if (this.reader.getn(1) == "") {
                break;
            }
        }
    }
    var node = Node(NODE_EXCMD);
    node.pos = this.ea.cmdpos;
    node.ea = this.ea;
    node.str = this.reader.getstr(this.ea.linepos, end);
    this.add_node(node);
}

VimLParser.prototype.separate_nextcmd = function() {
    if (this.ea.cmd.name == "vimgrep" || this.ea.cmd.name == "vimgrepadd" || this.ea.cmd.name == "lvimgrep" || this.ea.cmd.name == "lvimgrepadd") {
        this.skip_vimgrep_pat();
    }
    var pc = "";
    var end = this.reader.getpos();
    var nospend = end;
    while (TRUE) {
        var end = this.reader.getpos();
        if (!iswhite(pc)) {
            var nospend = end;
        }
        var c = this.reader.peek();
        if (c == "<EOF>" || c == "<EOL>") {
            break;
        }
        else if (c == "\x16") {
            // <C-V>
            this.reader.get();
            var end = this.reader.getpos();
            var nospend = this.reader.getpos();
            var c = this.reader.peek();
            if (c == "<EOF>" || c == "<EOL>") {
                break;
            }
            this.reader.get();
        }
        else if (this.reader.peekn(2) == "`=" && viml_eqregh(this.ea.cmd.flags, "\\<\\(XFILE\\|FILES\\|FILE1\\)\\>")) {
            this.reader.getn(2);
            this.parse_expr();
            var c = this.reader.peekn(1);
            if (c != "`") {
                throw Err(viml_printf("unexpected character: %s", c), this.reader.getpos());
            }
            this.reader.getn(1);
        }
        else if (c == "|" || c == "\n" || c == "\"" && !viml_eqregh(this.ea.cmd.flags, "\\<NOTRLCOM\\>") && (this.ea.cmd.name != "@" && this.ea.cmd.name != "*" || this.reader.getpos() != this.ea.argpos) && (this.ea.cmd.name != "redir" || this.reader.getpos().i != this.ea.argpos.i + 1 || pc != "@")) {
            var has_cpo_bar = FALSE;
            // &cpoptions =~ 'b'
            if ((!has_cpo_bar || !viml_eqregh(this.ea.cmd.flags, "\\<USECTRLV\\>")) && pc == "\\") {
                this.reader.get();
            }
            else {
                break;
            }
        }
        else {
            this.reader.get();
        }
        var pc = c;
    }
    if (!viml_eqregh(this.ea.cmd.flags, "\\<NOTRLCOM\\>")) {
        var end = nospend;
    }
    return end;
}

// FIXME
VimLParser.prototype.skip_vimgrep_pat = function() {
    if (this.reader.peekn(1) == "") {
        // pass
    }
    else if (isidc(this.reader.peekn(1))) {
        // :vimgrep pattern fname
        this.reader.read_nonwhite();
    }
    else {
        // :vimgrep /pattern/[g][j] fname
        var c = this.reader.getn(1);
        var __tmp = this.parse_pattern(c);
        var _ = __tmp[0];
        var endc = __tmp[1];
        if (c != endc) {
            return;
        }
        while (this.reader.p(0) == "g" || this.reader.p(0) == "j") {
            this.reader.getn(1);
        }
    }
}

VimLParser.prototype.parse_cmd_append = function() {
    this.reader.setpos(this.ea.linepos);
    var cmdline = this.reader.readline();
    var lines = [cmdline];
    var m = ".";
    while (TRUE) {
        if (this.reader.peek() == "<EOF>") {
            break;
        }
        var line = this.reader.getn(-1);
        viml_add(lines, line);
        if (line == m) {
            break;
        }
        this.reader.get();
    }
    var node = Node(NODE_EXCMD);
    node.pos = this.ea.cmdpos;
    node.ea = this.ea;
    node.str = viml_join(lines, "\n");
    this.add_node(node);
}

VimLParser.prototype.parse_cmd_insert = function() {
    this.parse_cmd_append();
}

VimLParser.prototype.parse_cmd_loadkeymap = function() {
    this.reader.setpos(this.ea.linepos);
    var cmdline = this.reader.readline();
    var lines = [cmdline];
    while (TRUE) {
        if (this.reader.peek() == "<EOF>") {
            break;
        }
        var line = this.reader.readline();
        viml_add(lines, line);
    }
    var node = Node(NODE_EXCMD);
    node.pos = this.ea.cmdpos;
    node.ea = this.ea;
    node.str = viml_join(lines, "\n");
    this.add_node(node);
}

VimLParser.prototype.parse_cmd_lua = function() {
    var lines = [];
    this.reader.skip_white();
    if (this.reader.peekn(2) == "<<") {
        this.reader.getn(2);
        this.reader.skip_white();
        var m = this.reader.readline();
        if (m == "") {
            var m = ".";
        }
        this.reader.setpos(this.ea.linepos);
        var cmdline = this.reader.getn(-1);
        var lines = [cmdline];
        this.reader.get();
        while (TRUE) {
            if (this.reader.peek() == "<EOF>") {
                break;
            }
            var line = this.reader.getn(-1);
            viml_add(lines, line);
            if (line == m) {
                break;
            }
            this.reader.get();
        }
    }
    else {
        this.reader.setpos(this.ea.linepos);
        var cmdline = this.reader.getn(-1);
        var lines = [cmdline];
    }
    var node = Node(NODE_EXCMD);
    node.pos = this.ea.cmdpos;
    node.ea = this.ea;
    node.str = viml_join(lines, "\n");
    this.add_node(node);
}

VimLParser.prototype.parse_cmd_mzscheme = function() {
    this.parse_cmd_lua();
}

VimLParser.prototype.parse_cmd_perl = function() {
    this.parse_cmd_lua();
}

VimLParser.prototype.parse_cmd_python = function() {
    this.parse_cmd_lua();
}

VimLParser.prototype.parse_cmd_python3 = function() {
    this.parse_cmd_lua();
}

VimLParser.prototype.parse_cmd_ruby = function() {
    this.parse_cmd_lua();
}

VimLParser.prototype.parse_cmd_tcl = function() {
    this.parse_cmd_lua();
}

VimLParser.prototype.parse_cmd_finish = function() {
    this.parse_cmd_common();
    if (this.context[0].type == NODE_TOPLEVEL) {
        this.reader.seek_end(0);
    }
}

// FIXME
VimLParser.prototype.parse_cmd_usercmd = function() {
    this.parse_cmd_common();
}

VimLParser.prototype.parse_cmd_function = function() {
    var pos = this.reader.tell();
    this.reader.skip_white();
    // :function
    if (this.ends_excmds(this.reader.peek())) {
        this.reader.seek_set(pos);
        this.parse_cmd_common();
        return;
    }
    // :function /pattern
    if (this.reader.peekn(1) == "/") {
        this.reader.seek_set(pos);
        this.parse_cmd_common();
        return;
    }
    var left = this.parse_lvalue_func();
    this.reader.skip_white();
    if (left.type == NODE_IDENTIFIER) {
        var s = left.value;
        var ss = viml_split(s, "\\zs");
        if (ss[0] != "<" && ss[0] != "_" && !isupper(ss[0]) && viml_stridx(s, ":") == -1 && viml_stridx(s, "#") == -1) {
            throw Err(viml_printf("E128: Function name must start with a capital or contain a colon: %s", s), left.pos);
        }
    }
    // :function {name}
    if (this.reader.peekn(1) != "(") {
        this.reader.seek_set(pos);
        this.parse_cmd_common();
        return;
    }
    // :function[!] {name}([arguments]) [range] [abort] [dict] [closure]
    var node = Node(NODE_FUNCTION);
    node.pos = this.ea.cmdpos;
    node.body = [];
    node.ea = this.ea;
    node.left = left;
    node.rlist = [];
    node.default_args = [];
    node.attr = {"range":0, "abort":0, "dict":0, "closure":0};
    node.endfunction = NIL;
    this.reader.getn(1);
    var tokenizer = new ExprTokenizer(this.reader);
    if (tokenizer.peek().type == TOKEN_PCLOSE) {
        tokenizer.get();
    }
    else {
        var named = {};
        while (TRUE) {
            var varnode = Node(NODE_IDENTIFIER);
            var token = tokenizer.get();
            if (token.type == TOKEN_IDENTIFIER) {
                if (!isargname(token.value) || token.value == "firstline" || token.value == "lastline") {
                    throw Err(viml_printf("E125: Illegal argument: %s", token.value), token.pos);
                }
                else if (viml_has_key(named, token.value)) {
                    throw Err(viml_printf("E853: Duplicate argument name: %s", token.value), token.pos);
                }
                named[token.value] = 1;
                varnode.pos = token.pos;
                varnode.value = token.value;
                viml_add(node.rlist, varnode);
                if (tokenizer.peek().type == TOKEN_EQ) {
                    tokenizer.get();
                    viml_add(node.default_args, this.parse_expr());
                }
                else if (viml_len(node.default_args) > 0) {
                    throw Err("E989: Non-default argument follows default argument", varnode.pos);
                }
                // XXX: Vim doesn't skip white space before comma.  F(a ,b) => E475
                if (iswhite(this.reader.p(0)) && tokenizer.peek().type == TOKEN_COMMA) {
                    throw Err("E475: Invalid argument: White space is not allowed before comma", this.reader.getpos());
                }
                var token = tokenizer.get();
                if (token.type == TOKEN_COMMA) {
                    // XXX: Vim allows last comma.  F(a, b, ) => OK
                    if (tokenizer.peek().type == TOKEN_PCLOSE) {
                        tokenizer.get();
                        break;
                    }
                }
                else if (token.type == TOKEN_PCLOSE) {
                    break;
                }
                else {
                    throw Err(viml_printf("unexpected token: %s", token.value), token.pos);
                }
            }
            else if (token.type == TOKEN_DOTDOTDOT) {
                varnode.pos = token.pos;
                varnode.value = token.value;
                viml_add(node.rlist, varnode);
                var token = tokenizer.get();
                if (token.type == TOKEN_PCLOSE) {
                    break;
                }
                else {
                    throw Err(viml_printf("unexpected token: %s", token.value), token.pos);
                }
            }
            else {
                throw Err(viml_printf("unexpected token: %s", token.value), token.pos);
            }
        }
    }
    while (TRUE) {
        this.reader.skip_white();
        var epos = this.reader.getpos();
        var key = this.reader.read_alpha();
        if (key == "") {
            break;
        }
        else if (key == "range") {
            node.attr.range = TRUE;
        }
        else if (key == "abort") {
            node.attr.abort = TRUE;
        }
        else if (key == "dict") {
            node.attr.dict = TRUE;
        }
        else if (key == "closure") {
            node.attr.closure = TRUE;
        }
        else {
            throw Err(viml_printf("unexpected token: %s", key), epos);
        }
    }
    this.add_node(node);
    this.push_context(node);
}

VimLParser.prototype.parse_cmd_endfunction = function() {
    this.check_missing_endif("ENDFUNCTION", this.ea.cmdpos);
    this.check_missing_endtry("ENDFUNCTION", this.ea.cmdpos);
    this.check_missing_endwhile("ENDFUNCTION", this.ea.cmdpos);
    this.check_missing_endfor("ENDFUNCTION", this.ea.cmdpos);
    if (this.context[0].type != NODE_FUNCTION) {
        throw Err("E193: :endfunction not inside a function", this.ea.cmdpos);
    }
    this.reader.getn(-1);
    var node = Node(NODE_ENDFUNCTION);
    node.pos = this.ea.cmdpos;
    node.ea = this.ea;
    this.context[0].endfunction = node;
    this.pop_context();
}

VimLParser.prototype.parse_cmd_delfunction = function() {
    var node = Node(NODE_DELFUNCTION);
    node.pos = this.ea.cmdpos;
    node.ea = this.ea;
    node.left = this.parse_lvalue_func();
    this.add_node(node);
}

VimLParser.prototype.parse_cmd_return = function() {
    if (this.find_context(NODE_FUNCTION) == -1) {
        throw Err("E133: :return not inside a function", this.ea.cmdpos);
    }
    var node = Node(NODE_RETURN);
    node.pos = this.ea.cmdpos;
    node.ea = this.ea;
    node.left = NIL;
    this.reader.skip_white();
    var c = this.reader.peek();
    if (c == "\"" || !this.ends_excmds(c)) {
        node.left = this.parse_expr();
    }
    this.add_node(node);
}

VimLParser.prototype.parse_cmd_call = function() {
    var node = Node(NODE_EXCALL);
    node.pos = this.ea.cmdpos;
    node.ea = this.ea;
    this.reader.skip_white();
    var c = this.reader.peek();
    if (this.ends_excmds(c)) {
        throw Err("E471: Argument required", this.reader.getpos());
    }
    node.left = this.parse_expr();
    if (node.left.type != NODE_CALL) {
        throw Err("Not an function call", node.left.pos);
    }
    this.add_node(node);
}

VimLParser.prototype.parse_heredoc = function() {
    var node = Node(NODE_HEREDOC);
    node.pos = this.ea.cmdpos;
    node.op = "";
    node.rlist = [];
    node.body = [];
    while (TRUE) {
        this.reader.skip_white();
        var key = this.reader.read_word();
        if (key == "") {
            break;
        }
        if (!islower(key[0])) {
            node.op = key;
            break;
        }
        else {
            viml_add(node.rlist, key);
        }
    }
    if (node.op == "") {
        throw Err("E172: Missing marker", this.reader.getpos());
    }
    this.parse_trail();
    while (TRUE) {
        if (this.reader.peek() == "<EOF>") {
            break;
        }
        var line = this.reader.getn(-1);
        if (line == node.op) {
            return node;
        }
        viml_add(node.body, line);
        this.reader.get();
    }
    throw Err(viml_printf("E990: Missing end marker '%s'", node.op), this.reader.getpos());
}

VimLParser.prototype.parse_cmd_let = function() {
    var pos = this.reader.tell();
    this.reader.skip_white();
    // :let
    if (this.ends_excmds(this.reader.peek())) {
        this.reader.seek_set(pos);
        this.parse_cmd_common();
        return;
    }
    var lhs = this.parse_letlhs();
    this.reader.skip_white();
    var s1 = this.reader.peekn(1);
    var s2 = this.reader.peekn(2);
    // TODO check scriptversion?
    if (s2 == "..") {
        var s2 = this.reader.peekn(3);
    }
    else if (s2 == "=<") {
        var s2 = this.reader.peekn(3);
    }
    // :let {var-name} ..
    if (this.ends_excmds(s1) || s2 != "+=" && s2 != "-=" && s2 != ".=" && s2 != "..=" && s2 != "*=" && s2 != "/=" && s2 != "%=" && s2 != "=<<" && s1 != "=") {
        this.reader.seek_set(pos);
        this.parse_cmd_common();
        return;
    }
    // :let left op right
    var node = Node(NODE_LET);
    node.pos = this.ea.cmdpos;
    node.ea = this.ea;
    node.op = "";
    node.left = lhs.left;
    node.list = lhs.list;
    node.rest = lhs.rest;
    node.right = NIL;
    if (s2 == "+=" || s2 == "-=" || s2 == ".=" || s2 == "..=" || s2 == "*=" || s2 == "/=" || s2 == "%=") {
        this.reader.getn(viml_len(s2));
        node.op = s2;
    }
    else if (s2 == "=<<") {
        this.reader.getn(viml_len(s2));
        this.reader.skip_white();
        node.op = s2;
        node.right = this.parse_heredoc();
        this.add_node(node);
        return;
    }
    else if (s1 == "=") {
        this.reader.getn(1);
        node.op = s1;
    }
    else {
        throw "NOT REACHED";
    }
    node.right = this.parse_expr();
    this.add_node(node);
}

VimLParser.prototype.parse_cmd_const = function() {
    var pos = this.reader.tell();
    this.reader.skip_white();
    // :const
    if (this.ends_excmds(this.reader.peek())) {
        this.reader.seek_set(pos);
        this.parse_cmd_common();
        return;
    }
    var lhs = this.parse_constlhs();
    this.reader.skip_white();
    var s1 = this.reader.peekn(1);
    // :const {var-name}
    if (this.ends_excmds(s1) || s1 != "=") {
        this.reader.seek_set(pos);
        this.parse_cmd_common();
        return;
    }
    // :const left op right
    var node = Node(NODE_CONST);
    node.pos = this.ea.cmdpos;
    node.ea = this.ea;
    this.reader.getn(1);
    node.op = s1;
    node.left = lhs.left;
    node.list = lhs.list;
    node.rest = lhs.rest;
    node.right = this.parse_expr();
    this.add_node(node);
}

VimLParser.prototype.parse_cmd_unlet = function() {
    var node = Node(NODE_UNLET);
    node.pos = this.ea.cmdpos;
    node.ea = this.ea;
    node.list = this.parse_lvaluelist();
    this.add_node(node);
}

VimLParser.prototype.parse_cmd_lockvar = function() {
    var node = Node(NODE_LOCKVAR);
    node.pos = this.ea.cmdpos;
    node.ea = this.ea;
    node.depth = NIL;
    node.list = [];
    this.reader.skip_white();
    if (isdigit(this.reader.peekn(1))) {
        node.depth = viml_str2nr(this.reader.read_digit(), 10);
    }
    node.list = this.parse_lvaluelist();
    this.add_node(node);
}

VimLParser.prototype.parse_cmd_unlockvar = function() {
    var node = Node(NODE_UNLOCKVAR);
    node.pos = this.ea.cmdpos;
    node.ea = this.ea;
    node.depth = NIL;
    node.list = [];
    this.reader.skip_white();
    if (isdigit(this.reader.peekn(1))) {
        node.depth = viml_str2nr(this.reader.read_digit(), 10);
    }
    node.list = this.parse_lvaluelist();
    this.add_node(node);
}

VimLParser.prototype.parse_cmd_if = function() {
    var node = Node(NODE_IF);
    node.pos = this.ea.cmdpos;
    node.body = [];
    node.ea = this.ea;
    node.cond = this.parse_expr();
    node.elseif = [];
    node._else = NIL;
    node.endif = NIL;
    this.add_node(node);
    this.push_context(node);
}

VimLParser.prototype.parse_cmd_elseif = function() {
    if (this.context[0].type != NODE_IF && this.context[0].type != NODE_ELSEIF) {
        throw Err("E582: :elseif without :if", this.ea.cmdpos);
    }
    if (this.context[0].type != NODE_IF) {
        this.pop_context();
    }
    var node = Node(NODE_ELSEIF);
    node.pos = this.ea.cmdpos;
    node.body = [];
    node.ea = this.ea;
    node.cond = this.parse_expr();
    viml_add(this.context[0].elseif, node);
    this.push_context(node);
}

VimLParser.prototype.parse_cmd_else = function() {
    if (this.context[0].type != NODE_IF && this.context[0].type != NODE_ELSEIF) {
        throw Err("E581: :else without :if", this.ea.cmdpos);
    }
    if (this.context[0].type != NODE_IF) {
        this.pop_context();
    }
    var node = Node(NODE_ELSE);
    node.pos = this.ea.cmdpos;
    node.body = [];
    node.ea = this.ea;
    this.context[0]._else = node;
    this.push_context(node);
}

VimLParser.prototype.parse_cmd_endif = function() {
    if (this.context[0].type != NODE_IF && this.context[0].type != NODE_ELSEIF && this.context[0].type != NODE_ELSE) {
        throw Err("E580: :endif without :if", this.ea.cmdpos);
    }
    if (this.context[0].type != NODE_IF) {
        this.pop_context();
    }
    var node = Node(NODE_ENDIF);
    node.pos = this.ea.cmdpos;
    node.ea = this.ea;
    this.context[0].endif = node;
    this.pop_context();
}

VimLParser.prototype.parse_cmd_while = function() {
    var node = Node(NODE_WHILE);
    node.pos = this.ea.cmdpos;
    node.body = [];
    node.ea = this.ea;
    node.cond = this.parse_expr();
    node.endwhile = NIL;
    this.add_node(node);
    this.push_context(node);
}

VimLParser.prototype.parse_cmd_endwhile = function() {
    if (this.context[0].type != NODE_WHILE) {
        throw Err("E588: :endwhile without :while", this.ea.cmdpos);
    }
    var node = Node(NODE_ENDWHILE);
    node.pos = this.ea.cmdpos;
    node.ea = this.ea;
    this.context[0].endwhile = node;
    this.pop_context();
}

VimLParser.prototype.parse_cmd_for = function() {
    var node = Node(NODE_FOR);
    node.pos = this.ea.cmdpos;
    node.body = [];
    node.ea = this.ea;
    node.left = NIL;
    node.right = NIL;
    node.endfor = NIL;
    var lhs = this.parse_letlhs();
    node.left = lhs.left;
    node.list = lhs.list;
    node.rest = lhs.rest;
    this.reader.skip_white();
    var epos = this.reader.getpos();
    if (this.reader.read_alpha() != "in") {
        throw Err("Missing \"in\" after :for", epos);
    }
    node.right = this.parse_expr();
    this.add_node(node);
    this.push_context(node);
}

VimLParser.prototype.parse_cmd_endfor = function() {
    if (this.context[0].type != NODE_FOR) {
        throw Err("E588: :endfor without :for", this.ea.cmdpos);
    }
    var node = Node(NODE_ENDFOR);
    node.pos = this.ea.cmdpos;
    node.ea = this.ea;
    this.context[0].endfor = node;
    this.pop_context();
}

VimLParser.prototype.parse_cmd_continue = function() {
    if (this.find_context(NODE_WHILE) == -1 && this.find_context(NODE_FOR) == -1) {
        throw Err("E586: :continue without :while or :for", this.ea.cmdpos);
    }
    var node = Node(NODE_CONTINUE);
    node.pos = this.ea.cmdpos;
    node.ea = this.ea;
    this.add_node(node);
}

VimLParser.prototype.parse_cmd_break = function() {
    if (this.find_context(NODE_WHILE) == -1 && this.find_context(NODE_FOR) == -1) {
        throw Err("E587: :break without :while or :for", this.ea.cmdpos);
    }
    var node = Node(NODE_BREAK);
    node.pos = this.ea.cmdpos;
    node.ea = this.ea;
    this.add_node(node);
}

VimLParser.prototype.parse_cmd_try = function() {
    var node = Node(NODE_TRY);
    node.pos = this.ea.cmdpos;
    node.body = [];
    node.ea = this.ea;
    node.catch = [];
    node._finally = NIL;
    node.endtry = NIL;
    this.add_node(node);
    this.push_context(node);
}

VimLParser.prototype.parse_cmd_catch = function() {
    if (this.context[0].type == NODE_FINALLY) {
        throw Err("E604: :catch after :finally", this.ea.cmdpos);
    }
    else if (this.context[0].type != NODE_TRY && this.context[0].type != NODE_CATCH) {
        throw Err("E603: :catch without :try", this.ea.cmdpos);
    }
    if (this.context[0].type != NODE_TRY) {
        this.pop_context();
    }
    var node = Node(NODE_CATCH);
    node.pos = this.ea.cmdpos;
    node.body = [];
    node.ea = this.ea;
    node.pattern = NIL;
    this.reader.skip_white();
    if (!this.ends_excmds(this.reader.peek())) {
        var __tmp = this.parse_pattern(this.reader.get());
        node.pattern = __tmp[0];
        var _ = __tmp[1];
    }
    viml_add(this.context[0].catch, node);
    this.push_context(node);
}

VimLParser.prototype.parse_cmd_finally = function() {
    if (this.context[0].type != NODE_TRY && this.context[0].type != NODE_CATCH) {
        throw Err("E606: :finally without :try", this.ea.cmdpos);
    }
    if (this.context[0].type != NODE_TRY) {
        this.pop_context();
    }
    var node = Node(NODE_FINALLY);
    node.pos = this.ea.cmdpos;
    node.body = [];
    node.ea = this.ea;
    this.context[0]._finally = node;
    this.push_context(node);
}

VimLParser.prototype.parse_cmd_endtry = function() {
    if (this.context[0].type != NODE_TRY && this.context[0].type != NODE_CATCH && this.context[0].type != NODE_FINALLY) {
        throw Err("E602: :endtry without :try", this.ea.cmdpos);
    }
    if (this.context[0].type != NODE_TRY) {
        this.pop_context();
    }
    var node = Node(NODE_ENDTRY);
    node.pos = this.ea.cmdpos;
    node.ea = this.ea;
    this.context[0].endtry = node;
    this.pop_context();
}

VimLParser.prototype.parse_cmd_throw = function() {
    var node = Node(NODE_THROW);
    node.pos = this.ea.cmdpos;
    node.ea = this.ea;
    node.left = this.parse_expr();
    this.add_node(node);
}

VimLParser.prototype.parse_cmd_eval = function() {
    var node = Node(NODE_EVAL);
    node.pos = this.ea.cmdpos;
    node.ea = this.ea;
    node.left = this.parse_expr();
    this.add_node(node);
}

VimLParser.prototype.parse_cmd_echo = function() {
    var node = Node(NODE_ECHO);
    node.pos = this.ea.cmdpos;
    node.ea = this.ea;
    node.list = this.parse_exprlist();
    this.add_node(node);
}

VimLParser.prototype.parse_cmd_echon = function() {
    var node = Node(NODE_ECHON);
    node.pos = this.ea.cmdpos;
    node.ea = this.ea;
    node.list = this.parse_exprlist();
    this.add_node(node);
}

VimLParser.prototype.parse_cmd_echohl = function() {
    var node = Node(NODE_ECHOHL);
    node.pos = this.ea.cmdpos;
    node.ea = this.ea;
    node.str = "";
    while (!this.ends_excmds(this.reader.peek())) {
        node.str += this.reader.get();
    }
    this.add_node(node);
}

VimLParser.prototype.parse_cmd_echomsg = function() {
    var node = Node(NODE_ECHOMSG);
    node.pos = this.ea.cmdpos;
    node.ea = this.ea;
    node.list = this.parse_exprlist();
    this.add_node(node);
}

VimLParser.prototype.parse_cmd_echoerr = function() {
    var node = Node(NODE_ECHOERR);
    node.pos = this.ea.cmdpos;
    node.ea = this.ea;
    node.list = this.parse_exprlist();
    this.add_node(node);
}

VimLParser.prototype.parse_cmd_execute = function() {
    var node = Node(NODE_EXECUTE);
    node.pos = this.ea.cmdpos;
    node.ea = this.ea;
    node.list = this.parse_exprlist();
    this.add_node(node);
}

VimLParser.prototype.parse_expr = function() {
    return new ExprParser(this.reader).parse();
}

VimLParser.prototype.parse_exprlist = function() {
    var list = [];
    while (TRUE) {
        this.reader.skip_white();
        var c = this.reader.peek();
        if (c != "\"" && this.ends_excmds(c)) {
            break;
        }
        var node = this.parse_expr();
        viml_add(list, node);
    }
    return list;
}

VimLParser.prototype.parse_lvalue_func = function() {
    var p = new LvalueParser(this.reader);
    var node = p.parse();
    if (node.type == NODE_IDENTIFIER || node.type == NODE_CURLYNAME || node.type == NODE_SUBSCRIPT || node.type == NODE_DOT || node.type == NODE_OPTION || node.type == NODE_ENV || node.type == NODE_REG) {
        return node;
    }
    throw Err("Invalid Expression", node.pos);
}

// FIXME:
VimLParser.prototype.parse_lvalue = function() {
    var p = new LvalueParser(this.reader);
    var node = p.parse();
    if (node.type == NODE_IDENTIFIER) {
        if (!isvarname(node.value)) {
            throw Err(viml_printf("E461: Illegal variable name: %s", node.value), node.pos);
        }
    }
    if (node.type == NODE_IDENTIFIER || node.type == NODE_CURLYNAME || node.type == NODE_SUBSCRIPT || node.type == NODE_SLICE || node.type == NODE_DOT || node.type == NODE_OPTION || node.type == NODE_ENV || node.type == NODE_REG) {
        return node;
    }
    throw Err("Invalid Expression", node.pos);
}

// TODO: merge with s:VimLParser.parse_lvalue()
VimLParser.prototype.parse_constlvalue = function() {
    var p = new LvalueParser(this.reader);
    var node = p.parse();
    if (node.type == NODE_IDENTIFIER) {
        if (!isvarname(node.value)) {
            throw Err(viml_printf("E461: Illegal variable name: %s", node.value), node.pos);
        }
    }
    if (node.type == NODE_IDENTIFIER || node.type == NODE_CURLYNAME) {
        return node;
    }
    else if (node.type == NODE_SUBSCRIPT || node.type == NODE_SLICE || node.type == NODE_DOT) {
        throw Err("E996: Cannot lock a list or dict", node.pos);
    }
    else if (node.type == NODE_OPTION) {
        throw Err("E996: Cannot lock an option", node.pos);
    }
    else if (node.type == NODE_ENV) {
        throw Err("E996: Cannot lock an environment variable", node.pos);
    }
    else if (node.type == NODE_REG) {
        throw Err("E996: Cannot lock a register", node.pos);
    }
    throw Err("Invalid Expression", node.pos);
}

VimLParser.prototype.parse_lvaluelist = function() {
    var list = [];
    var node = this.parse_expr();
    viml_add(list, node);
    while (TRUE) {
        this.reader.skip_white();
        if (this.ends_excmds(this.reader.peek())) {
            break;
        }
        var node = this.parse_lvalue();
        viml_add(list, node);
    }
    return list;
}

// FIXME:
VimLParser.prototype.parse_letlhs = function() {
    var lhs = {"left":NIL, "list":NIL, "rest":NIL};
    var tokenizer = new ExprTokenizer(this.reader);
    if (tokenizer.peek().type == TOKEN_SQOPEN) {
        tokenizer.get();
        lhs.list = [];
        while (TRUE) {
            var node = this.parse_lvalue();
            viml_add(lhs.list, node);
            var token = tokenizer.get();
            if (token.type == TOKEN_SQCLOSE) {
                break;
            }
            else if (token.type == TOKEN_COMMA) {
                continue;
            }
            else if (token.type == TOKEN_SEMICOLON) {
                var node = this.parse_lvalue();
                lhs.rest = node;
                var token = tokenizer.get();
                if (token.type == TOKEN_SQCLOSE) {
                    break;
                }
                else {
                    throw Err(viml_printf("E475 Invalid argument: %s", token.value), token.pos);
                }
            }
            else {
                throw Err(viml_printf("E475 Invalid argument: %s", token.value), token.pos);
            }
        }
    }
    else {
        lhs.left = this.parse_lvalue();
    }
    return lhs;
}

// TODO: merge with s:VimLParser.parse_letlhs() ?
VimLParser.prototype.parse_constlhs = function() {
    var lhs = {"left":NIL, "list":NIL, "rest":NIL};
    var tokenizer = new ExprTokenizer(this.reader);
    if (tokenizer.peek().type == TOKEN_SQOPEN) {
        tokenizer.get();
        lhs.list = [];
        while (TRUE) {
            var node = this.parse_lvalue();
            viml_add(lhs.list, node);
            var token = tokenizer.get();
            if (token.type == TOKEN_SQCLOSE) {
                break;
            }
            else if (token.type == TOKEN_COMMA) {
                continue;
            }
            else if (token.type == TOKEN_SEMICOLON) {
                var node = this.parse_lvalue();
                lhs.rest = node;
                var token = tokenizer.get();
                if (token.type == TOKEN_SQCLOSE) {
                    break;
                }
                else {
                    throw Err(viml_printf("E475 Invalid argument: %s", token.value), token.pos);
                }
            }
            else {
                throw Err(viml_printf("E475 Invalid argument: %s", token.value), token.pos);
            }
        }
    }
    else {
        lhs.left = this.parse_constlvalue();
    }
    return lhs;
}

VimLParser.prototype.ends_excmds = function(c) {
    return c == "" || c == "|" || c == "\"" || c == "<EOF>" || c == "<EOL>";
}

// FIXME: validate argument
VimLParser.prototype.parse_wincmd = function() {
    var c = this.reader.getn(1);
    if (c == "") {
        throw Err("E471: Argument required", this.reader.getpos());
    }
    else if (c == "g" || c == "\x07") {
        // <C-G>
        var c2 = this.reader.getn(1);
        if (c2 == "" || iswhite(c2)) {
            throw Err("E474: Invalid Argument", this.reader.getpos());
        }
    }
    var end = this.reader.getpos();
    this.reader.skip_white();
    if (!this.ends_excmds(this.reader.peek())) {
        throw Err("E474: Invalid Argument", this.reader.getpos());
    }
    var node = Node(NODE_EXCMD);
    node.pos = this.ea.cmdpos;
    node.ea = this.ea;
    node.str = this.reader.getstr(this.ea.linepos, end);
    this.add_node(node);
}

// FIXME: validate argument
VimLParser.prototype.parse_cmd_syntax = function() {
    var end = this.reader.getpos();
    while (TRUE) {
        var end = this.reader.getpos();
        var c = this.reader.peek();
        if (c == "/" || c == "'" || c == "\"") {
            this.reader.getn(1);
            this.parse_pattern(c);
        }
        else if (c == "=") {
            this.reader.getn(1);
            this.parse_pattern(" ");
        }
        else if (this.ends_excmds(c)) {
            break;
        }
        this.reader.getn(1);
    }
    var node = Node(NODE_EXCMD);
    node.pos = this.ea.cmdpos;
    node.ea = this.ea;
    node.str = this.reader.getstr(this.ea.linepos, end);
    this.add_node(node);
}

VimLParser.prototype.neovim_additional_commands = [{"name":"rshada", "minlen":3, "flags":"BANG|FILE1|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"wshada", "minlen":3, "flags":"BANG|FILE1|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}];
VimLParser.prototype.neovim_removed_commands = [{"name":"Print", "minlen":1, "flags":"RANGE|WHOLEFOLD|COUNT|EXFLAGS|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"fixdel", "minlen":3, "flags":"TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"helpfind", "minlen":5, "flags":"EXTRA|NOTRLCOM", "parser":"parse_cmd_common"}, {"name":"open", "minlen":1, "flags":"RANGE|BANG|EXTRA", "parser":"parse_cmd_common"}, {"name":"shell", "minlen":2, "flags":"TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"tearoff", "minlen":2, "flags":"NEEDARG|EXTRA|TRLBAR|NOTRLCOM|CMDWIN", "parser":"parse_cmd_common"}, {"name":"gvim", "minlen":2, "flags":"BANG|FILES|EDITCMD|ARGOPT|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}];
// To find new builtin_commands, run the below script.
// $ scripts/update_builtin_commands.sh /path/to/vim/src/ex_cmds.h
VimLParser.prototype.builtin_commands = [{"name":"append", "minlen":1, "flags":"BANG|RANGE|ZEROR|TRLBAR|CMDWIN|MODIFY", "parser":"parse_cmd_append"}, {"name":"abbreviate", "minlen":2, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"abclear", "minlen":3, "flags":"EXTRA|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"aboveleft", "minlen":3, "flags":"NEEDARG|EXTRA|NOTRLCOM", "parser":"parse_cmd_common"}, {"name":"all", "minlen":2, "flags":"BANG|RANGE|NOTADR|COUNT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"amenu", "minlen":2, "flags":"RANGE|NOTADR|ZEROR|EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"anoremenu", "minlen":2, "flags":"RANGE|NOTADR|ZEROR|EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"args", "minlen":2, "flags":"BANG|FILES|EDITCMD|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"argadd", "minlen":4, "flags":"BANG|NEEDARG|RANGE|NOTADR|ZEROR|FILES|TRLBAR", "parser":"parse_cmd_common"}, {"name":"argdelete", "minlen":4, "flags":"BANG|RANGE|NOTADR|FILES|TRLBAR", "parser":"parse_cmd_common"}, {"name":"argedit", "minlen":4, "flags":"BANG|NEEDARG|RANGE|NOTADR|FILE1|EDITCMD|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"argdo", "minlen":5, "flags":"BANG|NEEDARG|EXTRA|NOTRLCOM", "parser":"parse_cmd_common"}, {"name":"argglobal", "minlen":4, "flags":"BANG|FILES|EDITCMD|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"arglocal", "minlen":4, "flags":"BANG|FILES|EDITCMD|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"argument", "minlen":4, "flags":"BANG|RANGE|NOTADR|COUNT|EXTRA|EDITCMD|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"ascii", "minlen":2, "flags":"TRLBAR|SBOXOK|CMDWIN", "parser":"parse_cmd_common"}, {"name":"autocmd", "minlen":2, "flags":"BANG|EXTRA|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"augroup", "minlen":3, "flags":"BANG|WORD1|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"aunmenu", "minlen":3, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"buffer", "minlen":1, "flags":"BANG|RANGE|NOTADR|BUFNAME|BUFUNL|COUNT|EXTRA|TRLBAR", "parser":"parse_cmd_common"}, {"name":"bNext", "minlen":2, "flags":"BANG|RANGE|NOTADR|COUNT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"ball", "minlen":2, "flags":"RANGE|NOTADR|COUNT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"badd", "minlen":3, "flags":"NEEDARG|FILE1|EDITCMD|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"bdelete", "minlen":2, "flags":"BANG|RANGE|NOTADR|BUFNAME|COUNT|EXTRA|TRLBAR", "parser":"parse_cmd_common"}, {"name":"behave", "minlen":2, "flags":"NEEDARG|WORD1|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"belowright", "minlen":3, "flags":"NEEDARG|EXTRA|NOTRLCOM", "parser":"parse_cmd_common"}, {"name":"bfirst", "minlen":2, "flags":"BANG|RANGE|NOTADR|TRLBAR", "parser":"parse_cmd_common"}, {"name":"blast", "minlen":2, "flags":"BANG|RANGE|NOTADR|TRLBAR", "parser":"parse_cmd_common"}, {"name":"bmodified", "minlen":2, "flags":"BANG|RANGE|NOTADR|COUNT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"bnext", "minlen":2, "flags":"BANG|RANGE|NOTADR|COUNT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"botright", "minlen":2, "flags":"NEEDARG|EXTRA|NOTRLCOM", "parser":"parse_cmd_common"}, {"name":"bprevious", "minlen":2, "flags":"BANG|RANGE|NOTADR|COUNT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"brewind", "minlen":2, "flags":"BANG|RANGE|NOTADR|TRLBAR", "parser":"parse_cmd_common"}, {"name":"break", "minlen":4, "flags":"TRLBAR|SBOXOK|CMDWIN", "parser":"parse_cmd_break"}, {"name":"breakadd", "minlen":6, "flags":"EXTRA|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"breakdel", "minlen":6, "flags":"EXTRA|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"breaklist", "minlen":6, "flags":"EXTRA|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"browse", "minlen":3, "flags":"NEEDARG|EXTRA|NOTRLCOM|CMDWIN", "parser":"parse_cmd_common"}, {"name":"bufdo", "minlen":5, "flags":"BANG|NEEDARG|EXTRA|NOTRLCOM", "parser":"parse_cmd_common"}, {"name":"buffers", "minlen":7, "flags":"BANG|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"bunload", "minlen":3, "flags":"BANG|RANGE|NOTADR|BUFNAME|COUNT|EXTRA|TRLBAR", "parser":"parse_cmd_common"}, {"name":"bwipeout", "minlen":2, "flags":"BANG|RANGE|NOTADR|BUFNAME|BUFUNL|COUNT|EXTRA|TRLBAR", "parser":"parse_cmd_common"}, {"name":"change", "minlen":1, "flags":"BANG|WHOLEFOLD|RANGE|COUNT|TRLBAR|CMDWIN|MODIFY", "parser":"parse_cmd_common"}, {"name":"cNext", "minlen":2, "flags":"RANGE|NOTADR|COUNT|TRLBAR|BANG", "parser":"parse_cmd_common"}, {"name":"cNfile", "minlen":3, "flags":"RANGE|NOTADR|COUNT|TRLBAR|BANG", "parser":"parse_cmd_common"}, {"name":"cabbrev", "minlen":2, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"cabclear", "minlen":4, "flags":"EXTRA|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"caddbuffer", "minlen":3, "flags":"RANGE|NOTADR|WORD1|TRLBAR", "parser":"parse_cmd_common"}, {"name":"caddexpr", "minlen":5, "flags":"NEEDARG|WORD1|NOTRLCOM|TRLBAR", "parser":"parse_cmd_common"}, {"name":"caddfile", "minlen":5, "flags":"TRLBAR|FILE1", "parser":"parse_cmd_common"}, {"name":"call", "minlen":3, "flags":"RANGE|NEEDARG|EXTRA|NOTRLCOM|SBOXOK|CMDWIN", "parser":"parse_cmd_call"}, {"name":"catch", "minlen":3, "flags":"EXTRA|SBOXOK|CMDWIN", "parser":"parse_cmd_catch"}, {"name":"cbuffer", "minlen":2, "flags":"BANG|RANGE|NOTADR|WORD1|TRLBAR", "parser":"parse_cmd_common"}, {"name":"cc", "minlen":2, "flags":"RANGE|NOTADR|COUNT|TRLBAR|BANG", "parser":"parse_cmd_common"}, {"name":"cclose", "minlen":3, "flags":"RANGE|NOTADR|COUNT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"cd", "minlen":2, "flags":"BANG|FILE1|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"center", "minlen":2, "flags":"TRLBAR|RANGE|WHOLEFOLD|EXTRA|CMDWIN|MODIFY", "parser":"parse_cmd_common"}, {"name":"cexpr", "minlen":3, "flags":"NEEDARG|WORD1|NOTRLCOM|TRLBAR|BANG", "parser":"parse_cmd_common"}, {"name":"cfile", "minlen":2, "flags":"TRLBAR|FILE1|BANG", "parser":"parse_cmd_common"}, {"name":"cfirst", "minlen":4, "flags":"RANGE|NOTADR|COUNT|TRLBAR|BANG", "parser":"parse_cmd_common"}, {"name":"cgetbuffer", "minlen":5, "flags":"RANGE|NOTADR|WORD1|TRLBAR", "parser":"parse_cmd_common"}, {"name":"cgetexpr", "minlen":5, "flags":"NEEDARG|WORD1|NOTRLCOM|TRLBAR", "parser":"parse_cmd_common"}, {"name":"cgetfile", "minlen":2, "flags":"TRLBAR|FILE1", "parser":"parse_cmd_common"}, {"name":"changes", "minlen":7, "flags":"TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"chdir", "minlen":3, "flags":"BANG|FILE1|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"checkpath", "minlen":3, "flags":"TRLBAR|BANG|CMDWIN", "parser":"parse_cmd_common"}, {"name":"checktime", "minlen":6, "flags":"RANGE|NOTADR|BUFNAME|COUNT|EXTRA|TRLBAR", "parser":"parse_cmd_common"}, {"name":"clist", "minlen":2, "flags":"BANG|EXTRA|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"clast", "minlen":3, "flags":"RANGE|NOTADR|COUNT|TRLBAR|BANG", "parser":"parse_cmd_common"}, {"name":"close", "minlen":3, "flags":"BANG|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"cmap", "minlen":2, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"cmapclear", "minlen":5, "flags":"EXTRA|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"cmenu", "minlen":3, "flags":"RANGE|NOTADR|ZEROR|EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"cnext", "minlen":2, "flags":"RANGE|NOTADR|COUNT|TRLBAR|BANG", "parser":"parse_cmd_common"}, {"name":"cnewer", "minlen":4, "flags":"RANGE|NOTADR|COUNT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"cnfile", "minlen":3, "flags":"RANGE|NOTADR|COUNT|TRLBAR|BANG", "parser":"parse_cmd_common"}, {"name":"cnoremap", "minlen":3, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"cnoreabbrev", "minlen":6, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"cnoremenu", "minlen":7, "flags":"RANGE|NOTADR|ZEROR|EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"copy", "minlen":2, "flags":"RANGE|WHOLEFOLD|EXTRA|TRLBAR|CMDWIN|MODIFY", "parser":"parse_cmd_common"}, {"name":"colder", "minlen":3, "flags":"RANGE|NOTADR|COUNT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"colorscheme", "minlen":4, "flags":"WORD1|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"command", "minlen":3, "flags":"EXTRA|BANG|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"comclear", "minlen":4, "flags":"TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"compiler", "minlen":4, "flags":"BANG|TRLBAR|WORD1|CMDWIN", "parser":"parse_cmd_common"}, {"name":"continue", "minlen":3, "flags":"TRLBAR|SBOXOK|CMDWIN", "parser":"parse_cmd_continue"}, {"name":"confirm", "minlen":4, "flags":"NEEDARG|EXTRA|NOTRLCOM|CMDWIN", "parser":"parse_cmd_common"}, {"name":"copen", "minlen":4, "flags":"RANGE|NOTADR|COUNT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"cprevious", "minlen":2, "flags":"RANGE|NOTADR|COUNT|TRLBAR|BANG", "parser":"parse_cmd_common"}, {"name":"cpfile", "minlen":3, "flags":"RANGE|NOTADR|COUNT|TRLBAR|BANG", "parser":"parse_cmd_common"}, {"name":"cquit", "minlen":2, "flags":"TRLBAR|BANG", "parser":"parse_cmd_common"}, {"name":"crewind", "minlen":2, "flags":"RANGE|NOTADR|COUNT|TRLBAR|BANG", "parser":"parse_cmd_common"}, {"name":"cscope", "minlen":2, "flags":"EXTRA|NOTRLCOM|XFILE", "parser":"parse_cmd_common"}, {"name":"cstag", "minlen":3, "flags":"BANG|TRLBAR|WORD1", "parser":"parse_cmd_common"}, {"name":"cunmap", "minlen":2, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"cunabbrev", "minlen":4, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"cunmenu", "minlen":5, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"cwindow", "minlen":2, "flags":"RANGE|NOTADR|COUNT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"delete", "minlen":1, "flags":"RANGE|WHOLEFOLD|REGSTR|COUNT|TRLBAR|CMDWIN|MODIFY", "parser":"parse_cmd_common"}, {"name":"delmarks", "minlen":4, "flags":"BANG|EXTRA|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"debug", "minlen":3, "flags":"NEEDARG|EXTRA|NOTRLCOM|SBOXOK|CMDWIN", "parser":"parse_cmd_common"}, {"name":"debuggreedy", "minlen":6, "flags":"RANGE|NOTADR|ZEROR|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"delcommand", "minlen":4, "flags":"NEEDARG|WORD1|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"delfunction", "minlen":4, "flags":"BANG|NEEDARG|WORD1|CMDWIN", "parser":"parse_cmd_delfunction"}, {"name":"diffupdate", "minlen":3, "flags":"BANG|TRLBAR", "parser":"parse_cmd_common"}, {"name":"diffget", "minlen":5, "flags":"RANGE|EXTRA|TRLBAR|MODIFY", "parser":"parse_cmd_common"}, {"name":"diffoff", "minlen":5, "flags":"BANG|TRLBAR", "parser":"parse_cmd_common"}, {"name":"diffpatch", "minlen":5, "flags":"EXTRA|FILE1|TRLBAR|MODIFY", "parser":"parse_cmd_common"}, {"name":"diffput", "minlen":6, "flags":"RANGE|EXTRA|TRLBAR", "parser":"parse_cmd_common"}, {"name":"diffsplit", "minlen":5, "flags":"EXTRA|FILE1|TRLBAR", "parser":"parse_cmd_common"}, {"name":"diffthis", "minlen":5, "flags":"TRLBAR", "parser":"parse_cmd_common"}, {"name":"digraphs", "minlen":3, "flags":"EXTRA|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"display", "minlen":2, "flags":"EXTRA|NOTRLCOM|TRLBAR|SBOXOK|CMDWIN", "parser":"parse_cmd_common"}, {"name":"djump", "minlen":2, "flags":"BANG|RANGE|DFLALL|WHOLEFOLD|EXTRA", "parser":"parse_cmd_common"}, {"name":"dlist", "minlen":2, "flags":"BANG|RANGE|DFLALL|WHOLEFOLD|EXTRA|CMDWIN", "parser":"parse_cmd_common"}, {"name":"doautocmd", "minlen":2, "flags":"EXTRA|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"doautoall", "minlen":7, "flags":"EXTRA|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"drop", "minlen":2, "flags":"FILES|EDITCMD|NEEDARG|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"dsearch", "minlen":2, "flags":"BANG|RANGE|DFLALL|WHOLEFOLD|EXTRA|CMDWIN", "parser":"parse_cmd_common"}, {"name":"dsplit", "minlen":3, "flags":"BANG|RANGE|DFLALL|WHOLEFOLD|EXTRA", "parser":"parse_cmd_common"}, {"name":"edit", "minlen":1, "flags":"BANG|FILE1|EDITCMD|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"earlier", "minlen":2, "flags":"TRLBAR|EXTRA|NOSPC|CMDWIN", "parser":"parse_cmd_common"}, {"name":"echo", "minlen":2, "flags":"EXTRA|NOTRLCOM|SBOXOK|CMDWIN", "parser":"parse_cmd_echo"}, {"name":"echoerr", "minlen":5, "flags":"EXTRA|NOTRLCOM|SBOXOK|CMDWIN", "parser":"parse_cmd_echoerr"}, {"name":"echohl", "minlen":5, "flags":"EXTRA|TRLBAR|SBOXOK|CMDWIN", "parser":"parse_cmd_echohl"}, {"name":"echomsg", "minlen":5, "flags":"EXTRA|NOTRLCOM|SBOXOK|CMDWIN", "parser":"parse_cmd_echomsg"}, {"name":"echon", "minlen":5, "flags":"EXTRA|NOTRLCOM|SBOXOK|CMDWIN", "parser":"parse_cmd_echon"}, {"name":"else", "minlen":2, "flags":"TRLBAR|SBOXOK|CMDWIN", "parser":"parse_cmd_else"}, {"name":"elseif", "minlen":5, "flags":"EXTRA|NOTRLCOM|SBOXOK|CMDWIN", "parser":"parse_cmd_elseif"}, {"name":"emenu", "minlen":2, "flags":"NEEDARG|EXTRA|TRLBAR|NOTRLCOM|RANGE|NOTADR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"endif", "minlen":2, "flags":"TRLBAR|SBOXOK|CMDWIN", "parser":"parse_cmd_endif"}, {"name":"endfor", "minlen":5, "flags":"TRLBAR|SBOXOK|CMDWIN", "parser":"parse_cmd_endfor"}, {"name":"endfunction", "minlen":4, "flags":"TRLBAR|CMDWIN", "parser":"parse_cmd_endfunction"}, {"name":"endtry", "minlen":4, "flags":"TRLBAR|SBOXOK|CMDWIN", "parser":"parse_cmd_endtry"}, {"name":"endwhile", "minlen":4, "flags":"TRLBAR|SBOXOK|CMDWIN", "parser":"parse_cmd_endwhile"}, {"name":"enew", "minlen":3, "flags":"BANG|TRLBAR", "parser":"parse_cmd_common"}, {"name":"eval", "minlen":2, "flags":"EXTRA|NOTRLCOM|SBOXOK|CMDWIN", "parser":"parse_cmd_eval"}, {"name":"ex", "minlen":2, "flags":"BANG|FILE1|EDITCMD|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"execute", "minlen":3, "flags":"EXTRA|NOTRLCOM|SBOXOK|CMDWIN", "parser":"parse_cmd_execute"}, {"name":"exit", "minlen":3, "flags":"RANGE|WHOLEFOLD|BANG|FILE1|ARGOPT|DFLALL|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"exusage", "minlen":3, "flags":"TRLBAR", "parser":"parse_cmd_common"}, {"name":"file", "minlen":1, "flags":"RANGE|NOTADR|ZEROR|BANG|FILE1|TRLBAR", "parser":"parse_cmd_common"}, {"name":"files", "minlen":5, "flags":"BANG|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"filetype", "minlen":5, "flags":"EXTRA|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"find", "minlen":3, "flags":"RANGE|NOTADR|BANG|FILE1|EDITCMD|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"finally", "minlen":4, "flags":"TRLBAR|SBOXOK|CMDWIN", "parser":"parse_cmd_finally"}, {"name":"finish", "minlen":4, "flags":"TRLBAR|SBOXOK|CMDWIN", "parser":"parse_cmd_finish"}, {"name":"first", "minlen":3, "flags":"EXTRA|BANG|EDITCMD|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"fixdel", "minlen":3, "flags":"TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"fold", "minlen":2, "flags":"RANGE|WHOLEFOLD|TRLBAR|SBOXOK|CMDWIN", "parser":"parse_cmd_common"}, {"name":"foldclose", "minlen":5, "flags":"RANGE|BANG|WHOLEFOLD|TRLBAR|SBOXOK|CMDWIN", "parser":"parse_cmd_common"}, {"name":"folddoopen", "minlen":5, "flags":"RANGE|DFLALL|NEEDARG|EXTRA|NOTRLCOM", "parser":"parse_cmd_common"}, {"name":"folddoclosed", "minlen":7, "flags":"RANGE|DFLALL|NEEDARG|EXTRA|NOTRLCOM", "parser":"parse_cmd_common"}, {"name":"foldopen", "minlen":5, "flags":"RANGE|BANG|WHOLEFOLD|TRLBAR|SBOXOK|CMDWIN", "parser":"parse_cmd_common"}, {"name":"for", "minlen":3, "flags":"EXTRA|NOTRLCOM|SBOXOK|CMDWIN", "parser":"parse_cmd_for"}, {"name":"function", "minlen":2, "flags":"EXTRA|BANG|CMDWIN", "parser":"parse_cmd_function"}, {"name":"global", "minlen":1, "flags":"RANGE|WHOLEFOLD|BANG|EXTRA|DFLALL|SBOXOK|CMDWIN", "parser":"parse_cmd_common"}, {"name":"goto", "minlen":2, "flags":"RANGE|NOTADR|COUNT|TRLBAR|SBOXOK|CMDWIN", "parser":"parse_cmd_common"}, {"name":"grep", "minlen":2, "flags":"RANGE|NOTADR|BANG|NEEDARG|EXTRA|NOTRLCOM|TRLBAR|XFILE", "parser":"parse_cmd_common"}, {"name":"grepadd", "minlen":5, "flags":"RANGE|NOTADR|BANG|NEEDARG|EXTRA|NOTRLCOM|TRLBAR|XFILE", "parser":"parse_cmd_common"}, {"name":"gui", "minlen":2, "flags":"BANG|FILES|EDITCMD|ARGOPT|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"gvim", "minlen":2, "flags":"BANG|FILES|EDITCMD|ARGOPT|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"hardcopy", "minlen":2, "flags":"RANGE|COUNT|EXTRA|TRLBAR|DFLALL|BANG", "parser":"parse_cmd_common"}, {"name":"help", "minlen":1, "flags":"BANG|EXTRA|NOTRLCOM", "parser":"parse_cmd_common"}, {"name":"helpfind", "minlen":5, "flags":"EXTRA|NOTRLCOM", "parser":"parse_cmd_common"}, {"name":"helpgrep", "minlen":5, "flags":"EXTRA|NOTRLCOM|NEEDARG", "parser":"parse_cmd_common"}, {"name":"helptags", "minlen":5, "flags":"NEEDARG|FILES|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"highlight", "minlen":2, "flags":"BANG|EXTRA|TRLBAR|SBOXOK|CMDWIN", "parser":"parse_cmd_common"}, {"name":"hide", "minlen":3, "flags":"BANG|EXTRA|NOTRLCOM", "parser":"parse_cmd_common"}, {"name":"history", "minlen":3, "flags":"EXTRA|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"insert", "minlen":1, "flags":"BANG|RANGE|TRLBAR|CMDWIN|MODIFY", "parser":"parse_cmd_insert"}, {"name":"iabbrev", "minlen":2, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"iabclear", "minlen":4, "flags":"EXTRA|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"if", "minlen":2, "flags":"EXTRA|NOTRLCOM|SBOXOK|CMDWIN", "parser":"parse_cmd_if"}, {"name":"ijump", "minlen":2, "flags":"BANG|RANGE|DFLALL|WHOLEFOLD|EXTRA", "parser":"parse_cmd_common"}, {"name":"ilist", "minlen":2, "flags":"BANG|RANGE|DFLALL|WHOLEFOLD|EXTRA|CMDWIN", "parser":"parse_cmd_common"}, {"name":"imap", "minlen":2, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"imapclear", "minlen":5, "flags":"EXTRA|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"imenu", "minlen":3, "flags":"RANGE|NOTADR|ZEROR|EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"inoremap", "minlen":3, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"inoreabbrev", "minlen":6, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"inoremenu", "minlen":7, "flags":"RANGE|NOTADR|ZEROR|EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"intro", "minlen":3, "flags":"TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"isearch", "minlen":2, "flags":"BANG|RANGE|DFLALL|WHOLEFOLD|EXTRA|CMDWIN", "parser":"parse_cmd_common"}, {"name":"isplit", "minlen":3, "flags":"BANG|RANGE|DFLALL|WHOLEFOLD|EXTRA", "parser":"parse_cmd_common"}, {"name":"iunmap", "minlen":2, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"iunabbrev", "minlen":4, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"iunmenu", "minlen":5, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"join", "minlen":1, "flags":"BANG|RANGE|WHOLEFOLD|COUNT|EXFLAGS|TRLBAR|CMDWIN|MODIFY", "parser":"parse_cmd_common"}, {"name":"jumps", "minlen":2, "flags":"TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"k", "minlen":1, "flags":"RANGE|WORD1|TRLBAR|SBOXOK|CMDWIN", "parser":"parse_cmd_common"}, {"name":"keepalt", "minlen":5, "flags":"NEEDARG|EXTRA|NOTRLCOM", "parser":"parse_cmd_common"}, {"name":"keepmarks", "minlen":3, "flags":"NEEDARG|EXTRA|NOTRLCOM", "parser":"parse_cmd_common"}, {"name":"keepjumps", "minlen":5, "flags":"NEEDARG|EXTRA|NOTRLCOM", "parser":"parse_cmd_common"}, {"name":"keeppatterns", "minlen":5, "flags":"NEEDARG|EXTRA|NOTRLCOM", "parser":"parse_cmd_common"}, {"name":"lNext", "minlen":2, "flags":"RANGE|NOTADR|COUNT|TRLBAR|BANG", "parser":"parse_cmd_common"}, {"name":"lNfile", "minlen":3, "flags":"RANGE|NOTADR|COUNT|TRLBAR|BANG", "parser":"parse_cmd_common"}, {"name":"list", "minlen":1, "flags":"RANGE|WHOLEFOLD|COUNT|EXFLAGS|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"laddexpr", "minlen":3, "flags":"NEEDARG|WORD1|NOTRLCOM|TRLBAR", "parser":"parse_cmd_common"}, {"name":"laddbuffer", "minlen":5, "flags":"RANGE|NOTADR|WORD1|TRLBAR", "parser":"parse_cmd_common"}, {"name":"laddfile", "minlen":5, "flags":"TRLBAR|FILE1", "parser":"parse_cmd_common"}, {"name":"last", "minlen":2, "flags":"EXTRA|BANG|EDITCMD|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"language", "minlen":3, "flags":"EXTRA|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"later", "minlen":3, "flags":"TRLBAR|EXTRA|NOSPC|CMDWIN", "parser":"parse_cmd_common"}, {"name":"lbuffer", "minlen":2, "flags":"BANG|RANGE|NOTADR|WORD1|TRLBAR", "parser":"parse_cmd_common"}, {"name":"lcd", "minlen":2, "flags":"BANG|FILE1|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"lchdir", "minlen":3, "flags":"BANG|FILE1|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"lclose", "minlen":3, "flags":"RANGE|NOTADR|COUNT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"lcscope", "minlen":3, "flags":"EXTRA|NOTRLCOM|XFILE", "parser":"parse_cmd_common"}, {"name":"left", "minlen":2, "flags":"TRLBAR|RANGE|WHOLEFOLD|EXTRA|CMDWIN|MODIFY", "parser":"parse_cmd_common"}, {"name":"leftabove", "minlen":5, "flags":"NEEDARG|EXTRA|NOTRLCOM", "parser":"parse_cmd_common"}, {"name":"let", "minlen":3, "flags":"EXTRA|NOTRLCOM|SBOXOK|CMDWIN", "parser":"parse_cmd_let"}, {"name":"const", "minlen":4, "flags":"EXTRA|NOTRLCOM|SBOXOK|CMDWIN", "parser":"parse_cmd_const"}, {"name":"lexpr", "minlen":3, "flags":"NEEDARG|WORD1|NOTRLCOM|TRLBAR|BANG", "parser":"parse_cmd_common"}, {"name":"lfile", "minlen":2, "flags":"TRLBAR|FILE1|BANG", "parser":"parse_cmd_common"}, {"name":"lfirst", "minlen":4, "flags":"RANGE|NOTADR|COUNT|TRLBAR|BANG", "parser":"parse_cmd_common"}, {"name":"lgetbuffer", "minlen":5, "flags":"RANGE|NOTADR|WORD1|TRLBAR", "parser":"parse_cmd_common"}, {"name":"lgetexpr", "minlen":5, "flags":"NEEDARG|WORD1|NOTRLCOM|TRLBAR", "parser":"parse_cmd_common"}, {"name":"lgetfile", "minlen":2, "flags":"TRLBAR|FILE1", "parser":"parse_cmd_common"}, {"name":"lgrep", "minlen":3, "flags":"RANGE|NOTADR|BANG|NEEDARG|EXTRA|NOTRLCOM|TRLBAR|XFILE", "parser":"parse_cmd_common"}, {"name":"lgrepadd", "minlen":6, "flags":"RANGE|NOTADR|BANG|NEEDARG|EXTRA|NOTRLCOM|TRLBAR|XFILE", "parser":"parse_cmd_common"}, {"name":"lhelpgrep", "minlen":2, "flags":"EXTRA|NOTRLCOM|NEEDARG", "parser":"parse_cmd_common"}, {"name":"ll", "minlen":2, "flags":"RANGE|NOTADR|COUNT|TRLBAR|BANG", "parser":"parse_cmd_common"}, {"name":"llast", "minlen":3, "flags":"RANGE|NOTADR|COUNT|TRLBAR|BANG", "parser":"parse_cmd_common"}, {"name":"list", "minlen":3, "flags":"BANG|EXTRA|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"lmake", "minlen":4, "flags":"BANG|EXTRA|NOTRLCOM|TRLBAR|XFILE", "parser":"parse_cmd_common"}, {"name":"lmap", "minlen":2, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"lmapclear", "minlen":5, "flags":"EXTRA|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"lnext", "minlen":3, "flags":"RANGE|NOTADR|COUNT|TRLBAR|BANG", "parser":"parse_cmd_common"}, {"name":"lnewer", "minlen":4, "flags":"RANGE|NOTADR|COUNT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"lnfile", "minlen":3, "flags":"RANGE|NOTADR|COUNT|TRLBAR|BANG", "parser":"parse_cmd_common"}, {"name":"lnoremap", "minlen":2, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"loadkeymap", "minlen":5, "flags":"CMDWIN", "parser":"parse_cmd_loadkeymap"}, {"name":"loadview", "minlen":2, "flags":"FILE1|TRLBAR", "parser":"parse_cmd_common"}, {"name":"lockmarks", "minlen":3, "flags":"NEEDARG|EXTRA|NOTRLCOM", "parser":"parse_cmd_common"}, {"name":"lockvar", "minlen":5, "flags":"BANG|EXTRA|NEEDARG|SBOXOK|CMDWIN", "parser":"parse_cmd_lockvar"}, {"name":"lolder", "minlen":3, "flags":"RANGE|NOTADR|COUNT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"lopen", "minlen":3, "flags":"RANGE|NOTADR|COUNT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"lprevious", "minlen":2, "flags":"RANGE|NOTADR|COUNT|TRLBAR|BANG", "parser":"parse_cmd_common"}, {"name":"lpfile", "minlen":3, "flags":"RANGE|NOTADR|COUNT|TRLBAR|BANG", "parser":"parse_cmd_common"}, {"name":"lrewind", "minlen":2, "flags":"RANGE|NOTADR|COUNT|TRLBAR|BANG", "parser":"parse_cmd_common"}, {"name":"ls", "minlen":2, "flags":"BANG|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"ltag", "minlen":2, "flags":"NOTADR|TRLBAR|BANG|WORD1", "parser":"parse_cmd_common"}, {"name":"lunmap", "minlen":2, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"lua", "minlen":3, "flags":"RANGE|EXTRA|NEEDARG|CMDWIN", "parser":"parse_cmd_lua"}, {"name":"luado", "minlen":4, "flags":"RANGE|DFLALL|EXTRA|NEEDARG|CMDWIN", "parser":"parse_cmd_common"}, {"name":"luafile", "minlen":4, "flags":"RANGE|FILE1|NEEDARG|CMDWIN", "parser":"parse_cmd_common"}, {"name":"lvimgrep", "minlen":2, "flags":"RANGE|NOTADR|BANG|NEEDARG|EXTRA|NOTRLCOM|TRLBAR|XFILE", "parser":"parse_cmd_common"}, {"name":"lvimgrepadd", "minlen":9, "flags":"RANGE|NOTADR|BANG|NEEDARG|EXTRA|NOTRLCOM|TRLBAR|XFILE", "parser":"parse_cmd_common"}, {"name":"lwindow", "minlen":2, "flags":"RANGE|NOTADR|COUNT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"move", "minlen":1, "flags":"RANGE|WHOLEFOLD|EXTRA|TRLBAR|CMDWIN|MODIFY", "parser":"parse_cmd_common"}, {"name":"mark", "minlen":2, "flags":"RANGE|WORD1|TRLBAR|SBOXOK|CMDWIN", "parser":"parse_cmd_common"}, {"name":"make", "minlen":3, "flags":"BANG|EXTRA|NOTRLCOM|TRLBAR|XFILE", "parser":"parse_cmd_common"}, {"name":"map", "minlen":3, "flags":"BANG|EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"mapclear", "minlen":4, "flags":"EXTRA|BANG|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"marks", "minlen":5, "flags":"EXTRA|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"match", "minlen":3, "flags":"RANGE|NOTADR|EXTRA|CMDWIN", "parser":"parse_cmd_common"}, {"name":"menu", "minlen":2, "flags":"RANGE|NOTADR|ZEROR|BANG|EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"menutranslate", "minlen":5, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"messages", "minlen":3, "flags":"TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"mkexrc", "minlen":2, "flags":"BANG|FILE1|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"mksession", "minlen":3, "flags":"BANG|FILE1|TRLBAR", "parser":"parse_cmd_common"}, {"name":"mkspell", "minlen":4, "flags":"BANG|NEEDARG|EXTRA|NOTRLCOM|TRLBAR|XFILE", "parser":"parse_cmd_common"}, {"name":"mkvimrc", "minlen":3, "flags":"BANG|FILE1|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"mkview", "minlen":5, "flags":"BANG|FILE1|TRLBAR", "parser":"parse_cmd_common"}, {"name":"mode", "minlen":3, "flags":"WORD1|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"mzscheme", "minlen":2, "flags":"RANGE|EXTRA|DFLALL|NEEDARG|CMDWIN|SBOXOK", "parser":"parse_cmd_mzscheme"}, {"name":"mzfile", "minlen":3, "flags":"RANGE|FILE1|NEEDARG|CMDWIN", "parser":"parse_cmd_common"}, {"name":"nbclose", "minlen":3, "flags":"TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"nbkey", "minlen":2, "flags":"EXTRA|NOTADR|NEEDARG", "parser":"parse_cmd_common"}, {"name":"nbstart", "minlen":3, "flags":"WORD1|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"next", "minlen":1, "flags":"RANGE|NOTADR|BANG|FILES|EDITCMD|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"new", "minlen":3, "flags":"BANG|FILE1|RANGE|NOTADR|EDITCMD|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"nmap", "minlen":2, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"nmapclear", "minlen":5, "flags":"EXTRA|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"nmenu", "minlen":3, "flags":"RANGE|NOTADR|ZEROR|EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"nnoremap", "minlen":2, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"nnoremenu", "minlen":7, "flags":"RANGE|NOTADR|ZEROR|EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"noautocmd", "minlen":3, "flags":"NEEDARG|EXTRA|NOTRLCOM", "parser":"parse_cmd_common"}, {"name":"noremap", "minlen":2, "flags":"BANG|EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"nohlsearch", "minlen":3, "flags":"TRLBAR|SBOXOK|CMDWIN", "parser":"parse_cmd_common"}, {"name":"noreabbrev", "minlen":5, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"noremenu", "minlen":6, "flags":"RANGE|NOTADR|ZEROR|BANG|EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"normal", "minlen":4, "flags":"RANGE|BANG|EXTRA|NEEDARG|NOTRLCOM|USECTRLV|SBOXOK|CMDWIN", "parser":"parse_cmd_common"}, {"name":"number", "minlen":2, "flags":"RANGE|WHOLEFOLD|COUNT|EXFLAGS|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"nunmap", "minlen":3, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"nunmenu", "minlen":5, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"oldfiles", "minlen":2, "flags":"BANG|TRLBAR|SBOXOK|CMDWIN", "parser":"parse_cmd_common"}, {"name":"open", "minlen":1, "flags":"RANGE|BANG|EXTRA", "parser":"parse_cmd_common"}, {"name":"omap", "minlen":2, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"omapclear", "minlen":5, "flags":"EXTRA|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"omenu", "minlen":3, "flags":"RANGE|NOTADR|ZEROR|EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"only", "minlen":2, "flags":"BANG|TRLBAR", "parser":"parse_cmd_common"}, {"name":"onoremap", "minlen":3, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"onoremenu", "minlen":7, "flags":"RANGE|NOTADR|ZEROR|EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"options", "minlen":3, "flags":"TRLBAR", "parser":"parse_cmd_common"}, {"name":"ounmap", "minlen":2, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"ounmenu", "minlen":5, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"ownsyntax", "minlen":2, "flags":"EXTRA|NOTRLCOM|SBOXOK|CMDWIN", "parser":"parse_cmd_common"}, {"name":"pclose", "minlen":2, "flags":"BANG|TRLBAR", "parser":"parse_cmd_common"}, {"name":"pedit", "minlen":3, "flags":"BANG|FILE1|EDITCMD|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"perl", "minlen":2, "flags":"RANGE|EXTRA|DFLALL|NEEDARG|SBOXOK|CMDWIN", "parser":"parse_cmd_perl"}, {"name":"print", "minlen":1, "flags":"RANGE|WHOLEFOLD|COUNT|EXFLAGS|TRLBAR|CMDWIN|SBOXOK", "parser":"parse_cmd_common"}, {"name":"profdel", "minlen":5, "flags":"EXTRA|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"profile", "minlen":4, "flags":"BANG|EXTRA|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"promptfind", "minlen":3, "flags":"EXTRA|NOTRLCOM|CMDWIN", "parser":"parse_cmd_common"}, {"name":"promptrepl", "minlen":7, "flags":"EXTRA|NOTRLCOM|CMDWIN", "parser":"parse_cmd_common"}, {"name":"perldo", "minlen":5, "flags":"RANGE|EXTRA|DFLALL|NEEDARG|CMDWIN", "parser":"parse_cmd_common"}, {"name":"pop", "minlen":2, "flags":"RANGE|NOTADR|BANG|COUNT|TRLBAR|ZEROR", "parser":"parse_cmd_common"}, {"name":"popup", "minlen":4, "flags":"NEEDARG|EXTRA|BANG|TRLBAR|NOTRLCOM|CMDWIN", "parser":"parse_cmd_common"}, {"name":"ppop", "minlen":2, "flags":"RANGE|NOTADR|BANG|COUNT|TRLBAR|ZEROR", "parser":"parse_cmd_common"}, {"name":"preserve", "minlen":3, "flags":"TRLBAR", "parser":"parse_cmd_common"}, {"name":"previous", "minlen":4, "flags":"EXTRA|RANGE|NOTADR|COUNT|BANG|EDITCMD|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"psearch", "minlen":2, "flags":"BANG|RANGE|WHOLEFOLD|DFLALL|EXTRA", "parser":"parse_cmd_common"}, {"name":"ptag", "minlen":2, "flags":"RANGE|NOTADR|BANG|WORD1|TRLBAR|ZEROR", "parser":"parse_cmd_common"}, {"name":"ptNext", "minlen":3, "flags":"RANGE|NOTADR|BANG|TRLBAR|ZEROR", "parser":"parse_cmd_common"}, {"name":"ptfirst", "minlen":3, "flags":"RANGE|NOTADR|BANG|TRLBAR|ZEROR", "parser":"parse_cmd_common"}, {"name":"ptjump", "minlen":3, "flags":"BANG|TRLBAR|WORD1", "parser":"parse_cmd_common"}, {"name":"ptlast", "minlen":3, "flags":"BANG|TRLBAR", "parser":"parse_cmd_common"}, {"name":"ptnext", "minlen":3, "flags":"RANGE|NOTADR|BANG|TRLBAR|ZEROR", "parser":"parse_cmd_common"}, {"name":"ptprevious", "minlen":3, "flags":"RANGE|NOTADR|BANG|TRLBAR|ZEROR", "parser":"parse_cmd_common"}, {"name":"ptrewind", "minlen":3, "flags":"RANGE|NOTADR|BANG|TRLBAR|ZEROR", "parser":"parse_cmd_common"}, {"name":"ptselect", "minlen":3, "flags":"BANG|TRLBAR|WORD1", "parser":"parse_cmd_common"}, {"name":"put", "minlen":2, "flags":"RANGE|WHOLEFOLD|BANG|REGSTR|TRLBAR|ZEROR|CMDWIN|MODIFY", "parser":"parse_cmd_common"}, {"name":"pwd", "minlen":2, "flags":"TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"py3", "minlen":3, "flags":"RANGE|EXTRA|NEEDARG|CMDWIN", "parser":"parse_cmd_python3"}, {"name":"python3", "minlen":7, "flags":"RANGE|EXTRA|NEEDARG|CMDWIN", "parser":"parse_cmd_python3"}, {"name":"py3file", "minlen":4, "flags":"RANGE|FILE1|NEEDARG|CMDWIN", "parser":"parse_cmd_common"}, {"name":"python", "minlen":2, "flags":"RANGE|EXTRA|NEEDARG|CMDWIN", "parser":"parse_cmd_python"}, {"name":"pyfile", "minlen":3, "flags":"RANGE|FILE1|NEEDARG|CMDWIN", "parser":"parse_cmd_common"}, {"name":"pydo", "minlen":3, "flags":"RANGE|DFLALL|EXTRA|NEEDARG|CMDWIN", "parser":"parse_cmd_common"}, {"name":"py3do", "minlen":4, "flags":"RANGE|DFLALL|EXTRA|NEEDARG|CMDWIN", "parser":"parse_cmd_common"}, {"name":"quit", "minlen":1, "flags":"BANG|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"quitall", "minlen":5, "flags":"BANG|TRLBAR", "parser":"parse_cmd_common"}, {"name":"qall", "minlen":2, "flags":"BANG|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"read", "minlen":1, "flags":"BANG|RANGE|WHOLEFOLD|FILE1|ARGOPT|TRLBAR|ZEROR|CMDWIN|MODIFY", "parser":"parse_cmd_common"}, {"name":"recover", "minlen":3, "flags":"BANG|FILE1|TRLBAR", "parser":"parse_cmd_common"}, {"name":"redo", "minlen":3, "flags":"TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"redir", "minlen":4, "flags":"BANG|FILES|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"redraw", "minlen":4, "flags":"BANG|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"redrawstatus", "minlen":7, "flags":"BANG|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"registers", "minlen":3, "flags":"EXTRA|NOTRLCOM|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"resize", "minlen":3, "flags":"RANGE|NOTADR|TRLBAR|WORD1", "parser":"parse_cmd_common"}, {"name":"retab", "minlen":3, "flags":"TRLBAR|RANGE|WHOLEFOLD|DFLALL|BANG|WORD1|CMDWIN|MODIFY", "parser":"parse_cmd_common"}, {"name":"return", "minlen":4, "flags":"EXTRA|NOTRLCOM|SBOXOK|CMDWIN", "parser":"parse_cmd_return"}, {"name":"rewind", "minlen":3, "flags":"EXTRA|BANG|EDITCMD|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"right", "minlen":2, "flags":"TRLBAR|RANGE|WHOLEFOLD|EXTRA|CMDWIN|MODIFY", "parser":"parse_cmd_common"}, {"name":"rightbelow", "minlen":6, "flags":"NEEDARG|EXTRA|NOTRLCOM", "parser":"parse_cmd_common"}, {"name":"ruby", "minlen":3, "flags":"RANGE|EXTRA|NEEDARG|CMDWIN", "parser":"parse_cmd_ruby"}, {"name":"rubydo", "minlen":5, "flags":"RANGE|DFLALL|EXTRA|NEEDARG|CMDWIN", "parser":"parse_cmd_common"}, {"name":"rubyfile", "minlen":5, "flags":"RANGE|FILE1|NEEDARG|CMDWIN", "parser":"parse_cmd_common"}, {"name":"rundo", "minlen":4, "flags":"NEEDARG|FILE1", "parser":"parse_cmd_common"}, {"name":"runtime", "minlen":2, "flags":"BANG|NEEDARG|FILES|TRLBAR|SBOXOK|CMDWIN", "parser":"parse_cmd_common"}, {"name":"rviminfo", "minlen":2, "flags":"BANG|FILE1|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"substitute", "minlen":1, "flags":"RANGE|WHOLEFOLD|EXTRA|CMDWIN", "parser":"parse_cmd_common"}, {"name":"sNext", "minlen":2, "flags":"EXTRA|RANGE|NOTADR|COUNT|BANG|EDITCMD|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"sandbox", "minlen":3, "flags":"NEEDARG|EXTRA|NOTRLCOM", "parser":"parse_cmd_common"}, {"name":"sargument", "minlen":2, "flags":"BANG|RANGE|NOTADR|COUNT|EXTRA|EDITCMD|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"sall", "minlen":3, "flags":"BANG|RANGE|NOTADR|COUNT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"saveas", "minlen":3, "flags":"BANG|DFLALL|FILE1|ARGOPT|CMDWIN|TRLBAR", "parser":"parse_cmd_common"}, {"name":"sbuffer", "minlen":2, "flags":"BANG|RANGE|NOTADR|BUFNAME|BUFUNL|COUNT|EXTRA|TRLBAR", "parser":"parse_cmd_common"}, {"name":"sbNext", "minlen":3, "flags":"RANGE|NOTADR|COUNT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"sball", "minlen":3, "flags":"RANGE|NOTADR|COUNT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"sbfirst", "minlen":3, "flags":"TRLBAR", "parser":"parse_cmd_common"}, {"name":"sblast", "minlen":3, "flags":"TRLBAR", "parser":"parse_cmd_common"}, {"name":"sbmodified", "minlen":3, "flags":"RANGE|NOTADR|COUNT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"sbnext", "minlen":3, "flags":"RANGE|NOTADR|COUNT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"sbprevious", "minlen":3, "flags":"RANGE|NOTADR|COUNT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"sbrewind", "minlen":3, "flags":"TRLBAR", "parser":"parse_cmd_common"}, {"name":"scriptnames", "minlen":3, "flags":"TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"scriptencoding", "minlen":7, "flags":"WORD1|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"scscope", "minlen":3, "flags":"EXTRA|NOTRLCOM", "parser":"parse_cmd_common"}, {"name":"set", "minlen":2, "flags":"TRLBAR|EXTRA|CMDWIN|SBOXOK", "parser":"parse_cmd_common"}, {"name":"setfiletype", "minlen":4, "flags":"TRLBAR|EXTRA|NEEDARG|CMDWIN", "parser":"parse_cmd_common"}, {"name":"setglobal", "minlen":4, "flags":"TRLBAR|EXTRA|CMDWIN|SBOXOK", "parser":"parse_cmd_common"}, {"name":"setlocal", "minlen":4, "flags":"TRLBAR|EXTRA|CMDWIN|SBOXOK", "parser":"parse_cmd_common"}, {"name":"sfind", "minlen":2, "flags":"BANG|FILE1|RANGE|NOTADR|EDITCMD|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"sfirst", "minlen":4, "flags":"EXTRA|BANG|EDITCMD|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"shell", "minlen":2, "flags":"TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"simalt", "minlen":3, "flags":"NEEDARG|WORD1|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"sign", "minlen":3, "flags":"NEEDARG|RANGE|NOTADR|EXTRA|CMDWIN", "parser":"parse_cmd_common"}, {"name":"silent", "minlen":3, "flags":"NEEDARG|EXTRA|BANG|NOTRLCOM|SBOXOK|CMDWIN", "parser":"parse_cmd_common"}, {"name":"sleep", "minlen":2, "flags":"RANGE|NOTADR|COUNT|EXTRA|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"slast", "minlen":3, "flags":"EXTRA|BANG|EDITCMD|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"smagic", "minlen":2, "flags":"RANGE|WHOLEFOLD|EXTRA|CMDWIN", "parser":"parse_cmd_common"}, {"name":"smap", "minlen":4, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"smapclear", "minlen":5, "flags":"EXTRA|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"smenu", "minlen":3, "flags":"RANGE|NOTADR|ZEROR|EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"snext", "minlen":2, "flags":"RANGE|NOTADR|BANG|FILES|EDITCMD|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"sniff", "minlen":3, "flags":"EXTRA|TRLBAR", "parser":"parse_cmd_common"}, {"name":"snomagic", "minlen":3, "flags":"RANGE|WHOLEFOLD|EXTRA|CMDWIN", "parser":"parse_cmd_common"}, {"name":"snoremap", "minlen":4, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"snoremenu", "minlen":7, "flags":"RANGE|NOTADR|ZEROR|EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"sort", "minlen":3, "flags":"RANGE|DFLALL|WHOLEFOLD|BANG|EXTRA|NOTRLCOM|MODIFY", "parser":"parse_cmd_common"}, {"name":"source", "minlen":2, "flags":"BANG|FILE1|TRLBAR|SBOXOK|CMDWIN", "parser":"parse_cmd_common"}, {"name":"spelldump", "minlen":6, "flags":"BANG|TRLBAR", "parser":"parse_cmd_common"}, {"name":"spellgood", "minlen":3, "flags":"BANG|RANGE|NOTADR|NEEDARG|EXTRA|TRLBAR", "parser":"parse_cmd_common"}, {"name":"spellinfo", "minlen":6, "flags":"TRLBAR", "parser":"parse_cmd_common"}, {"name":"spellrepall", "minlen":6, "flags":"TRLBAR", "parser":"parse_cmd_common"}, {"name":"spellundo", "minlen":6, "flags":"BANG|RANGE|NOTADR|NEEDARG|EXTRA|TRLBAR", "parser":"parse_cmd_common"}, {"name":"spellwrong", "minlen":6, "flags":"BANG|RANGE|NOTADR|NEEDARG|EXTRA|TRLBAR", "parser":"parse_cmd_common"}, {"name":"split", "minlen":2, "flags":"BANG|FILE1|RANGE|NOTADR|EDITCMD|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"sprevious", "minlen":3, "flags":"EXTRA|RANGE|NOTADR|COUNT|BANG|EDITCMD|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"srewind", "minlen":3, "flags":"EXTRA|BANG|EDITCMD|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"stop", "minlen":2, "flags":"TRLBAR|BANG|CMDWIN", "parser":"parse_cmd_common"}, {"name":"stag", "minlen":3, "flags":"RANGE|NOTADR|BANG|WORD1|TRLBAR|ZEROR", "parser":"parse_cmd_common"}, {"name":"startinsert", "minlen":4, "flags":"BANG|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"startgreplace", "minlen":6, "flags":"BANG|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"startreplace", "minlen":6, "flags":"BANG|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"stopinsert", "minlen":5, "flags":"BANG|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"stjump", "minlen":3, "flags":"BANG|TRLBAR|WORD1", "parser":"parse_cmd_common"}, {"name":"stselect", "minlen":3, "flags":"BANG|TRLBAR|WORD1", "parser":"parse_cmd_common"}, {"name":"sunhide", "minlen":3, "flags":"RANGE|NOTADR|COUNT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"sunmap", "minlen":4, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"sunmenu", "minlen":5, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"suspend", "minlen":3, "flags":"TRLBAR|BANG|CMDWIN", "parser":"parse_cmd_common"}, {"name":"sview", "minlen":2, "flags":"BANG|FILE1|RANGE|NOTADR|EDITCMD|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"swapname", "minlen":2, "flags":"TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"syntax", "minlen":2, "flags":"EXTRA|NOTRLCOM|CMDWIN", "parser":"parse_cmd_syntax"}, {"name":"syntime", "minlen":5, "flags":"NEEDARG|WORD1|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"syncbind", "minlen":4, "flags":"TRLBAR", "parser":"parse_cmd_common"}, {"name":"t", "minlen":1, "flags":"RANGE|WHOLEFOLD|EXTRA|TRLBAR|CMDWIN|MODIFY", "parser":"parse_cmd_common"}, {"name":"tNext", "minlen":2, "flags":"RANGE|NOTADR|BANG|TRLBAR|ZEROR", "parser":"parse_cmd_common"}, {"name":"tabNext", "minlen":4, "flags":"RANGE|NOTADR|COUNT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"tabclose", "minlen":4, "flags":"RANGE|NOTADR|COUNT|BANG|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"tabdo", "minlen":4, "flags":"NEEDARG|EXTRA|NOTRLCOM", "parser":"parse_cmd_common"}, {"name":"tabedit", "minlen":4, "flags":"BANG|FILE1|RANGE|NOTADR|ZEROR|EDITCMD|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"tabfind", "minlen":4, "flags":"BANG|FILE1|RANGE|NOTADR|ZEROR|EDITCMD|ARGOPT|NEEDARG|TRLBAR", "parser":"parse_cmd_common"}, {"name":"tabfirst", "minlen":6, "flags":"TRLBAR", "parser":"parse_cmd_common"}, {"name":"tablast", "minlen":4, "flags":"TRLBAR", "parser":"parse_cmd_common"}, {"name":"tabmove", "minlen":4, "flags":"RANGE|NOTADR|ZEROR|EXTRA|NOSPC|TRLBAR", "parser":"parse_cmd_common"}, {"name":"tabnew", "minlen":6, "flags":"BANG|FILE1|RANGE|NOTADR|ZEROR|EDITCMD|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"tabnext", "minlen":4, "flags":"RANGE|NOTADR|COUNT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"tabonly", "minlen":4, "flags":"BANG|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"tabprevious", "minlen":4, "flags":"RANGE|NOTADR|COUNT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"tabrewind", "minlen":4, "flags":"TRLBAR", "parser":"parse_cmd_common"}, {"name":"tabs", "minlen":4, "flags":"TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"tab", "minlen":3, "flags":"NEEDARG|EXTRA|NOTRLCOM", "parser":"parse_cmd_common"}, {"name":"tag", "minlen":2, "flags":"RANGE|NOTADR|BANG|WORD1|TRLBAR|ZEROR", "parser":"parse_cmd_common"}, {"name":"tags", "minlen":4, "flags":"TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"tcl", "minlen":2, "flags":"RANGE|EXTRA|NEEDARG|CMDWIN", "parser":"parse_cmd_tcl"}, {"name":"tcldo", "minlen":4, "flags":"RANGE|DFLALL|EXTRA|NEEDARG|CMDWIN", "parser":"parse_cmd_common"}, {"name":"tclfile", "minlen":4, "flags":"RANGE|FILE1|NEEDARG|CMDWIN", "parser":"parse_cmd_common"}, {"name":"tearoff", "minlen":2, "flags":"NEEDARG|EXTRA|TRLBAR|NOTRLCOM|CMDWIN", "parser":"parse_cmd_common"}, {"name":"tfirst", "minlen":2, "flags":"RANGE|NOTADR|BANG|TRLBAR|ZEROR", "parser":"parse_cmd_common"}, {"name":"throw", "minlen":2, "flags":"EXTRA|NEEDARG|SBOXOK|CMDWIN", "parser":"parse_cmd_throw"}, {"name":"tjump", "minlen":2, "flags":"BANG|TRLBAR|WORD1", "parser":"parse_cmd_common"}, {"name":"tlast", "minlen":2, "flags":"BANG|TRLBAR", "parser":"parse_cmd_common"}, {"name":"tmenu", "minlen":2, "flags":"RANGE|NOTADR|ZEROR|EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"tnext", "minlen":2, "flags":"RANGE|NOTADR|BANG|TRLBAR|ZEROR", "parser":"parse_cmd_common"}, {"name":"topleft", "minlen":2, "flags":"NEEDARG|EXTRA|NOTRLCOM", "parser":"parse_cmd_common"}, {"name":"tprevious", "minlen":2, "flags":"RANGE|NOTADR|BANG|TRLBAR|ZEROR", "parser":"parse_cmd_common"}, {"name":"trewind", "minlen":2, "flags":"RANGE|NOTADR|BANG|TRLBAR|ZEROR", "parser":"parse_cmd_common"}, {"name":"try", "minlen":3, "flags":"TRLBAR|SBOXOK|CMDWIN", "parser":"parse_cmd_try"}, {"name":"tselect", "minlen":2, "flags":"BANG|TRLBAR|WORD1", "parser":"parse_cmd_common"}, {"name":"tunmenu", "minlen":2, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"undo", "minlen":1, "flags":"RANGE|NOTADR|COUNT|ZEROR|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"undojoin", "minlen":5, "flags":"TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"undolist", "minlen":5, "flags":"TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"unabbreviate", "minlen":3, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"unhide", "minlen":3, "flags":"RANGE|NOTADR|COUNT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"unlet", "minlen":3, "flags":"BANG|EXTRA|NEEDARG|SBOXOK|CMDWIN", "parser":"parse_cmd_unlet"}, {"name":"unlockvar", "minlen":4, "flags":"BANG|EXTRA|NEEDARG|SBOXOK|CMDWIN", "parser":"parse_cmd_unlockvar"}, {"name":"unmap", "minlen":3, "flags":"BANG|EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"unmenu", "minlen":4, "flags":"BANG|EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"unsilent", "minlen":3, "flags":"NEEDARG|EXTRA|NOTRLCOM|SBOXOK|CMDWIN", "parser":"parse_cmd_common"}, {"name":"update", "minlen":2, "flags":"RANGE|WHOLEFOLD|BANG|FILE1|ARGOPT|DFLALL|TRLBAR", "parser":"parse_cmd_common"}, {"name":"vglobal", "minlen":1, "flags":"RANGE|WHOLEFOLD|EXTRA|DFLALL|CMDWIN", "parser":"parse_cmd_common"}, {"name":"version", "minlen":2, "flags":"EXTRA|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"verbose", "minlen":4, "flags":"NEEDARG|RANGE|NOTADR|EXTRA|NOTRLCOM|SBOXOK|CMDWIN", "parser":"parse_cmd_common"}, {"name":"vertical", "minlen":4, "flags":"NEEDARG|EXTRA|NOTRLCOM", "parser":"parse_cmd_common"}, {"name":"vimgrep", "minlen":3, "flags":"RANGE|NOTADR|BANG|NEEDARG|EXTRA|NOTRLCOM|TRLBAR|XFILE", "parser":"parse_cmd_common"}, {"name":"vimgrepadd", "minlen":8, "flags":"RANGE|NOTADR|BANG|NEEDARG|EXTRA|NOTRLCOM|TRLBAR|XFILE", "parser":"parse_cmd_common"}, {"name":"visual", "minlen":2, "flags":"BANG|FILE1|EDITCMD|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"viusage", "minlen":3, "flags":"TRLBAR", "parser":"parse_cmd_common"}, {"name":"view", "minlen":3, "flags":"BANG|FILE1|EDITCMD|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"vmap", "minlen":2, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"vmapclear", "minlen":5, "flags":"EXTRA|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"vmenu", "minlen":3, "flags":"RANGE|NOTADR|ZEROR|EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"vnew", "minlen":3, "flags":"BANG|FILE1|RANGE|NOTADR|EDITCMD|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"vnoremap", "minlen":2, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"vnoremenu", "minlen":7, "flags":"RANGE|NOTADR|ZEROR|EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"vsplit", "minlen":2, "flags":"BANG|FILE1|RANGE|NOTADR|EDITCMD|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"vunmap", "minlen":2, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"vunmenu", "minlen":5, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"windo", "minlen":5, "flags":"BANG|NEEDARG|EXTRA|NOTRLCOM", "parser":"parse_cmd_common"}, {"name":"write", "minlen":1, "flags":"RANGE|WHOLEFOLD|BANG|FILE1|ARGOPT|DFLALL|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"wNext", "minlen":2, "flags":"RANGE|WHOLEFOLD|NOTADR|BANG|FILE1|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"wall", "minlen":2, "flags":"BANG|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"while", "minlen":2, "flags":"EXTRA|NOTRLCOM|SBOXOK|CMDWIN", "parser":"parse_cmd_while"}, {"name":"winsize", "minlen":2, "flags":"EXTRA|NEEDARG|TRLBAR", "parser":"parse_cmd_common"}, {"name":"wincmd", "minlen":4, "flags":"NEEDARG|WORD1|RANGE|NOTADR", "parser":"parse_wincmd"}, {"name":"winpos", "minlen":4, "flags":"EXTRA|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"wnext", "minlen":2, "flags":"RANGE|NOTADR|BANG|FILE1|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"wprevious", "minlen":2, "flags":"RANGE|NOTADR|BANG|FILE1|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"wq", "minlen":2, "flags":"RANGE|WHOLEFOLD|BANG|FILE1|ARGOPT|DFLALL|TRLBAR", "parser":"parse_cmd_common"}, {"name":"wqall", "minlen":3, "flags":"BANG|FILE1|ARGOPT|DFLALL|TRLBAR", "parser":"parse_cmd_common"}, {"name":"wsverb", "minlen":2, "flags":"EXTRA|NOTADR|NEEDARG", "parser":"parse_cmd_common"}, {"name":"wundo", "minlen":2, "flags":"BANG|NEEDARG|FILE1", "parser":"parse_cmd_common"}, {"name":"wviminfo", "minlen":2, "flags":"BANG|FILE1|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"xit", "minlen":1, "flags":"RANGE|WHOLEFOLD|BANG|FILE1|ARGOPT|DFLALL|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"xall", "minlen":2, "flags":"BANG|TRLBAR", "parser":"parse_cmd_common"}, {"name":"xmapclear", "minlen":5, "flags":"EXTRA|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"xmap", "minlen":2, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"xmenu", "minlen":3, "flags":"RANGE|NOTADR|ZEROR|EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"xnoremap", "minlen":2, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"xnoremenu", "minlen":7, "flags":"RANGE|NOTADR|ZEROR|EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"xunmap", "minlen":2, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"xunmenu", "minlen":5, "flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "parser":"parse_cmd_common"}, {"name":"yank", "minlen":1, "flags":"RANGE|WHOLEFOLD|REGSTR|COUNT|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"z", "minlen":1, "flags":"RANGE|WHOLEFOLD|EXTRA|EXFLAGS|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"!", "minlen":1, "flags":"RANGE|WHOLEFOLD|BANG|FILES|CMDWIN", "parser":"parse_cmd_common"}, {"name":"#", "minlen":1, "flags":"RANGE|WHOLEFOLD|COUNT|EXFLAGS|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"&", "minlen":1, "flags":"RANGE|WHOLEFOLD|EXTRA|CMDWIN|MODIFY", "parser":"parse_cmd_common"}, {"name":"*", "minlen":1, "flags":"RANGE|WHOLEFOLD|EXTRA|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"<", "minlen":1, "flags":"RANGE|WHOLEFOLD|COUNT|EXFLAGS|TRLBAR|CMDWIN|MODIFY", "parser":"parse_cmd_common"}, {"name":"=", "minlen":1, "flags":"RANGE|TRLBAR|DFLALL|EXFLAGS|CMDWIN", "parser":"parse_cmd_common"}, {"name":">", "minlen":1, "flags":"RANGE|WHOLEFOLD|COUNT|EXFLAGS|TRLBAR|CMDWIN|MODIFY", "parser":"parse_cmd_common"}, {"name":"@", "minlen":1, "flags":"RANGE|WHOLEFOLD|EXTRA|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"Next", "minlen":1, "flags":"EXTRA|RANGE|NOTADR|COUNT|BANG|EDITCMD|ARGOPT|TRLBAR", "parser":"parse_cmd_common"}, {"name":"Print", "minlen":1, "flags":"RANGE|WHOLEFOLD|COUNT|EXFLAGS|TRLBAR|CMDWIN", "parser":"parse_cmd_common"}, {"name":"X", "minlen":1, "flags":"TRLBAR", "parser":"parse_cmd_common"}, {"name":"~", "minlen":1, "flags":"RANGE|WHOLEFOLD|EXTRA|CMDWIN|MODIFY", "parser":"parse_cmd_common"}, {"flags":"TRLBAR", "minlen":3, "name":"cbottom", "parser":"parse_cmd_common"}, {"flags":"BANG|NEEDARG|EXTRA|NOTRLCOM|RANGE|NOTADR|DFLALL", "minlen":3, "name":"cdo", "parser":"parse_cmd_common"}, {"flags":"BANG|NEEDARG|EXTRA|NOTRLCOM|RANGE|NOTADR|DFLALL", "minlen":3, "name":"cfdo", "parser":"parse_cmd_common"}, {"flags":"TRLBAR", "minlen":3, "name":"chistory", "parser":"parse_cmd_common"}, {"flags":"TRLBAR|CMDWIN", "minlen":3, "name":"clearjumps", "parser":"parse_cmd_common"}, {"flags":"BANG|NEEDARG|EXTRA|NOTRLCOM", "minlen":4, "name":"filter", "parser":"parse_cmd_common"}, {"flags":"RANGE|NOTADR|COUNT|TRLBAR", "minlen":5, "name":"helpclose", "parser":"parse_cmd_common"}, {"flags":"TRLBAR", "minlen":3, "name":"lbottom", "parser":"parse_cmd_common"}, {"flags":"BANG|NEEDARG|EXTRA|NOTRLCOM|RANGE|NOTADR|DFLALL", "minlen":2, "name":"ldo", "parser":"parse_cmd_common"}, {"flags":"BANG|NEEDARG|EXTRA|NOTRLCOM|RANGE|NOTADR|DFLALL", "minlen":3, "name":"lfdo", "parser":"parse_cmd_common"}, {"flags":"TRLBAR", "minlen":3, "name":"lhistory", "parser":"parse_cmd_common"}, {"flags":"BANG|EXTRA|TRLBAR|CMDWIN", "minlen":3, "name":"llist", "parser":"parse_cmd_common"}, {"flags":"NEEDARG|EXTRA|NOTRLCOM", "minlen":3, "name":"noswapfile", "parser":"parse_cmd_common"}, {"flags":"BANG|FILE1|NEEDARG|TRLBAR|SBOXOK|CMDWIN", "minlen":2, "name":"packadd", "parser":"parse_cmd_common"}, {"flags":"BANG|TRLBAR|SBOXOK|CMDWIN", "minlen":5, "name":"packloadall", "parser":"parse_cmd_common"}, {"flags":"TRLBAR|CMDWIN|SBOXOK", "minlen":3, "name":"smile", "parser":"parse_cmd_common"}, {"flags":"RANGE|EXTRA|NEEDARG|CMDWIN", "minlen":3, "name":"pyx", "parser":"parse_cmd_common"}, {"flags":"RANGE|DFLALL|EXTRA|NEEDARG|CMDWIN", "minlen":4, "name":"pyxdo", "parser":"parse_cmd_common"}, {"flags":"RANGE|EXTRA|NEEDARG|CMDWIN", "minlen":7, "name":"pythonx", "parser":"parse_cmd_common"}, {"flags":"RANGE|FILE1|NEEDARG|CMDWIN", "minlen":4, "name":"pyxfile", "parser":"parse_cmd_common"}, {"flags":"RANGE|BANG|FILES|CMDWIN", "minlen":3, "name":"terminal", "parser":"parse_cmd_common"}, {"flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "minlen":3, "name":"tmap", "parser":"parse_cmd_common"}, {"flags":"EXTRA|TRLBAR|CMDWIN", "minlen":5, "name":"tmapclear", "parser":"parse_cmd_common"}, {"flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "minlen":3, "name":"tnoremap", "parser":"parse_cmd_common"}, {"flags":"EXTRA|TRLBAR|NOTRLCOM|USECTRLV|CMDWIN", "minlen":5, "name":"tunmap", "parser":"parse_cmd_common"}, {"flags":"RANGE|COUNT|TRLBAR", "minlen":4, "name":"cabove", "parser":"parse_cmd_common"}, {"flags":"RANGE|COUNT|TRLBAR", "minlen":3, "name":"cafter", "parser":"parse_cmd_common"}, {"flags":"RANGE|COUNT|TRLBAR", "minlen":3, "name":"cbefore", "parser":"parse_cmd_common"}, {"flags":"RANGE|COUNT|TRLBAR", "minlen":4, "name":"cbelow", "parser":"parse_cmd_common"}, {"flags":"EXTRA|NOTRLCOM|SBOXOK|CMDWIN", "minlen":4, "name":"const", "parser":"parse_cmd_common"}, {"flags":"RANGE|COUNT|TRLBAR", "minlen":3, "name":"labove", "parser":"parse_cmd_common"}, {"flags":"RANGE|COUNT|TRLBAR", "minlen":3, "name":"lafter", "parser":"parse_cmd_common"}, {"flags":"RANGE|COUNT|TRLBAR", "minlen":3, "name":"lbefore", "parser":"parse_cmd_common"}, {"flags":"RANGE|COUNT|TRLBAR", "minlen":4, "name":"lbelow", "parser":"parse_cmd_common"}, {"flags":"TRLBAR|CMDWIN", "minlen":7, "name":"redrawtabline", "parser":"parse_cmd_common"}, {"flags":"WORD1|TRLBAR|CMDWIN", "minlen":7, "name":"scriptversion", "parser":"parse_cmd_common"}, {"flags":"BANG|FILE1|TRLBAR|CMDWIN", "minlen":2, "name":"tcd", "parser":"parse_cmd_common"}, {"flags":"BANG|FILE1|TRLBAR|CMDWIN", "minlen":3, "name":"tchdir", "parser":"parse_cmd_common"}, {"flags":"RANGE|ZEROR|EXTRA|TRLBAR|NOTRLCOM|CTRLV|CMDWIN", "minlen":3, "name":"tlmenu", "parser":"parse_cmd_common"}, {"flags":"RANGE|ZEROR|EXTRA|TRLBAR|NOTRLCOM|CTRLV|CMDWIN", "minlen":3, "name":"tlnoremenu", "parser":"parse_cmd_common"}, {"flags":"RANGE|ZEROR|EXTRA|TRLBAR|NOTRLCOM|CTRLV|CMDWIN", "minlen":3, "name":"tlunmenu", "parser":"parse_cmd_common"}, {"flags":"EXTRA|TRLBAR|CMDWIN", "minlen":2, "name":"xrestore", "parser":"parse_cmd_common"}, {"flags":"EXTRA|BANG|SBOXOK|CMDWIN", "minlen":3, "name":"def", "parser":"parse_cmd_common"}, {"flags":"EXTRA|NEEDARG|TRLBAR|CMDWIN", "minlen":4, "name":"disassemble", "parser":"parse_cmd_common"}, {"flags":"TRLBAR|CMDWIN", "minlen":4, "name":"enddef", "parser":"parse_cmd_common"}, {"flags":"EXTRA|NOTRLCOM", "minlen":3, "name":"export", "parser":"parse_cmd_common"}, {"flags":"EXTRA|NOTRLCOM", "minlen":3, "name":"import", "parser":"parse_cmd_common"}, {"flags":"BANG|RANGE|NEEDARG|EXTRA|TRLBAR", "minlen":7, "name":"spellrare", "parser":"parse_cmd_common"}, {"flags":"", "minlen":4, "name":"vim9script", "parser":"parse_cmd_common"}];
// To find new builtin_functions, run the below script.
// $ scripts/update_builtin_functions.sh /path/to/vim/src/evalfunc.c
VimLParser.prototype.builtin_functions = [{"name":"abs", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"acos", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"add", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"and", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"append", "min_argc":2, "max_argc":2, "argtype":"FEARG_LAST"}, {"name":"appendbufline", "min_argc":3, "max_argc":3, "argtype":"FEARG_LAST"}, {"name":"argc", "min_argc":0, "max_argc":1, "argtype":"0"}, {"name":"argidx", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"arglistid", "min_argc":0, "max_argc":2, "argtype":"0"}, {"name":"argv", "min_argc":0, "max_argc":2, "argtype":"0"}, {"name":"asin", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"assert_beeps", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"assert_equal", "min_argc":2, "max_argc":3, "argtype":"FEARG_2"}, {"name":"assert_equalfile", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"assert_exception", "min_argc":1, "max_argc":2, "argtype":"0"}, {"name":"assert_fails", "min_argc":1, "max_argc":3, "argtype":"FEARG_1"}, {"name":"assert_false", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"assert_inrange", "min_argc":3, "max_argc":4, "argtype":"FEARG_3"}, {"name":"assert_match", "min_argc":2, "max_argc":3, "argtype":"FEARG_2"}, {"name":"assert_notequal", "min_argc":2, "max_argc":3, "argtype":"FEARG_2"}, {"name":"assert_notmatch", "min_argc":2, "max_argc":3, "argtype":"FEARG_2"}, {"name":"assert_report", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"assert_true", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"atan", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"atan2", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"balloon_gettext", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"balloon_show", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"balloon_split", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"browse", "min_argc":4, "max_argc":4, "argtype":"0"}, {"name":"browsedir", "min_argc":2, "max_argc":2, "argtype":"0"}, {"name":"bufadd", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"bufexists", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"buffer_exists", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"buffer_name", "min_argc":0, "max_argc":1, "argtype":"FEARG_1"}, {"name":"buffer_number", "min_argc":0, "max_argc":1, "argtype":"FEARG_1"}, {"name":"buflisted", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"bufload", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"bufloaded", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"bufname", "min_argc":0, "max_argc":1, "argtype":"FEARG_1"}, {"name":"bufnr", "min_argc":0, "max_argc":2, "argtype":"FEARG_1"}, {"name":"bufwinid", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"bufwinnr", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"byte2line", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"byteidx", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"byteidxcomp", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"call", "min_argc":2, "max_argc":3, "argtype":"FEARG_1"}, {"name":"ceil", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"ch_canread", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"ch_close", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"ch_close_in", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"ch_evalexpr", "min_argc":2, "max_argc":3, "argtype":"FEARG_1"}, {"name":"ch_evalraw", "min_argc":2, "max_argc":3, "argtype":"FEARG_1"}, {"name":"ch_getbufnr", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"ch_getjob", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"ch_info", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"ch_log", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"ch_logfile", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"ch_open", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"ch_read", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"ch_readblob", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"ch_readraw", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"ch_sendexpr", "min_argc":2, "max_argc":3, "argtype":"FEARG_1"}, {"name":"ch_sendraw", "min_argc":2, "max_argc":3, "argtype":"FEARG_1"}, {"name":"ch_setoptions", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"ch_status", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"changenr", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"char2nr", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"chdir", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"cindent", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"clearmatches", "min_argc":0, "max_argc":1, "argtype":"FEARG_1"}, {"name":"col", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"complete", "min_argc":2, "max_argc":2, "argtype":"FEARG_2"}, {"name":"complete_add", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"complete_check", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"complete_info", "min_argc":0, "max_argc":1, "argtype":"FEARG_1"}, {"name":"confirm", "min_argc":1, "max_argc":4, "argtype":"FEARG_1"}, {"name":"copy", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"cos", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"cosh", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"count", "min_argc":2, "max_argc":4, "argtype":"FEARG_1"}, {"name":"cscope_connection", "min_argc":0, "max_argc":3, "argtype":"0"}, {"name":"cursor", "min_argc":1, "max_argc":3, "argtype":"FEARG_1"}, {"name":"debugbreak", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"deepcopy", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"delete", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"deletebufline", "min_argc":2, "max_argc":3, "argtype":"FEARG_1"}, {"name":"did_filetype", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"diff_filler", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"diff_hlID", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"echoraw", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"empty", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"environ", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"escape", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"eval", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"eventhandler", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"executable", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"execute", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"exepath", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"exists", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"exp", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"expand", "min_argc":1, "max_argc":3, "argtype":"FEARG_1"}, {"name":"expandcmd", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"extend", "min_argc":2, "max_argc":3, "argtype":"FEARG_1"}, {"name":"feedkeys", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"file_readable", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"filereadable", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"filewritable", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"filter", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"finddir", "min_argc":1, "max_argc":3, "argtype":"FEARG_1"}, {"name":"findfile", "min_argc":1, "max_argc":3, "argtype":"FEARG_1"}, {"name":"float2nr", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"floor", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"fmod", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"fnameescape", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"fnamemodify", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"foldclosed", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"foldclosedend", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"foldlevel", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"foldtext", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"foldtextresult", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"foreground", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"funcref", "min_argc":1, "max_argc":3, "argtype":"FEARG_1"}, {"name":"function", "min_argc":1, "max_argc":3, "argtype":"FEARG_1"}, {"name":"garbagecollect", "min_argc":0, "max_argc":1, "argtype":"0"}, {"name":"get", "min_argc":2, "max_argc":3, "argtype":"FEARG_1"}, {"name":"getbufinfo", "min_argc":0, "max_argc":1, "argtype":"0"}, {"name":"getbufline", "min_argc":2, "max_argc":3, "argtype":"FEARG_1"}, {"name":"getbufvar", "min_argc":2, "max_argc":3, "argtype":"FEARG_1"}, {"name":"getchangelist", "min_argc":0, "max_argc":1, "argtype":"FEARG_1"}, {"name":"getchar", "min_argc":0, "max_argc":1, "argtype":"0"}, {"name":"getcharmod", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"getcharsearch", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"getcmdline", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"getcmdpos", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"getcmdtype", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"getcmdwintype", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"getcompletion", "min_argc":2, "max_argc":3, "argtype":"FEARG_1"}, {"name":"getcurpos", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"getcwd", "min_argc":0, "max_argc":2, "argtype":"FEARG_1"}, {"name":"getenv", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"getfontname", "min_argc":0, "max_argc":1, "argtype":"0"}, {"name":"getfperm", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"getfsize", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"getftime", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"getftype", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"getimstatus", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"getjumplist", "min_argc":0, "max_argc":2, "argtype":"FEARG_1"}, {"name":"getline", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"getloclist", "min_argc":1, "max_argc":2, "argtype":"0"}, {"name":"getmatches", "min_argc":0, "max_argc":1, "argtype":"0"}, {"name":"getmousepos", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"getpid", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"getpos", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"getqflist", "min_argc":0, "max_argc":1, "argtype":"0"}, {"name":"getreg", "min_argc":0, "max_argc":3, "argtype":"FEARG_1"}, {"name":"getregtype", "min_argc":0, "max_argc":1, "argtype":"FEARG_1"}, {"name":"gettabinfo", "min_argc":0, "max_argc":1, "argtype":"FEARG_1"}, {"name":"gettabvar", "min_argc":2, "max_argc":3, "argtype":"FEARG_1"}, {"name":"gettabwinvar", "min_argc":3, "max_argc":4, "argtype":"FEARG_1"}, {"name":"gettagstack", "min_argc":0, "max_argc":1, "argtype":"FEARG_1"}, {"name":"getwininfo", "min_argc":0, "max_argc":1, "argtype":"FEARG_1"}, {"name":"getwinpos", "min_argc":0, "max_argc":1, "argtype":"FEARG_1"}, {"name":"getwinposx", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"getwinposy", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"getwinvar", "min_argc":2, "max_argc":3, "argtype":"FEARG_1"}, {"name":"glob", "min_argc":1, "max_argc":4, "argtype":"FEARG_1"}, {"name":"glob2regpat", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"globpath", "min_argc":2, "max_argc":5, "argtype":"FEARG_2"}, {"name":"has", "min_argc":1, "max_argc":1, "argtype":"0"}, {"name":"has_key", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"haslocaldir", "min_argc":0, "max_argc":2, "argtype":"FEARG_1"}, {"name":"hasmapto", "min_argc":1, "max_argc":3, "argtype":"FEARG_1"}, {"name":"highlightID", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"highlight_exists", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"histadd", "min_argc":2, "max_argc":2, "argtype":"FEARG_2"}, {"name":"histdel", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"histget", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"histnr", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"hlID", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"hlexists", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"hostname", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"iconv", "min_argc":3, "max_argc":3, "argtype":"FEARG_1"}, {"name":"indent", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"index", "min_argc":2, "max_argc":4, "argtype":"FEARG_1"}, {"name":"input", "min_argc":1, "max_argc":3, "argtype":"FEARG_1"}, {"name":"inputdialog", "min_argc":1, "max_argc":3, "argtype":"FEARG_1"}, {"name":"inputlist", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"inputrestore", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"inputsave", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"inputsecret", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"insert", "min_argc":2, "max_argc":3, "argtype":"FEARG_1"}, {"name":"interrupt", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"invert", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"isdirectory", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"isinf", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"islocked", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"isnan", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"items", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"job_getchannel", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"job_info", "min_argc":0, "max_argc":1, "argtype":"FEARG_1"}, {"name":"job_setoptions", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"job_start", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"job_status", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"job_stop", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"join", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"js_decode", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"js_encode", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"json_decode", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"json_encode", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"keys", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"last_buffer_nr", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"len", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"libcall", "min_argc":3, "max_argc":3, "argtype":"FEARG_3"}, {"name":"libcallnr", "min_argc":3, "max_argc":3, "argtype":"FEARG_3"}, {"name":"line", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"line2byte", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"lispindent", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"list2str", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"listener_add", "min_argc":1, "max_argc":2, "argtype":"FEARG_2"}, {"name":"listener_flush", "min_argc":0, "max_argc":1, "argtype":"FEARG_1"}, {"name":"listener_remove", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"localtime", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"log", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"log10", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"luaeval", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"map", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"maparg", "min_argc":1, "max_argc":4, "argtype":"FEARG_1"}, {"name":"mapcheck", "min_argc":1, "max_argc":3, "argtype":"FEARG_1"}, {"name":"match", "min_argc":2, "max_argc":4, "argtype":"FEARG_1"}, {"name":"matchadd", "min_argc":2, "max_argc":5, "argtype":"FEARG_1"}, {"name":"matchaddpos", "min_argc":2, "max_argc":5, "argtype":"FEARG_1"}, {"name":"matcharg", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"matchdelete", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"matchend", "min_argc":2, "max_argc":4, "argtype":"FEARG_1"}, {"name":"matchlist", "min_argc":2, "max_argc":4, "argtype":"FEARG_1"}, {"name":"matchstr", "min_argc":2, "max_argc":4, "argtype":"FEARG_1"}, {"name":"matchstrpos", "min_argc":2, "max_argc":4, "argtype":"FEARG_1"}, {"name":"max", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"min", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"mkdir", "min_argc":1, "max_argc":3, "argtype":"FEARG_1"}, {"name":"mode", "min_argc":0, "max_argc":1, "argtype":"FEARG_1"}, {"name":"mzeval", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"nextnonblank", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"nr2char", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"or", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"pathshorten", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"perleval", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"popup_atcursor", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"popup_beval", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"popup_clear", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"popup_close", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"popup_create", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"popup_dialog", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"popup_filter_menu", "min_argc":2, "max_argc":2, "argtype":"0"}, {"name":"popup_filter_yesno", "min_argc":2, "max_argc":2, "argtype":"0"}, {"name":"popup_findinfo", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"popup_findpreview", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"popup_getoptions", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"popup_getpos", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"popup_hide", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"popup_locate", "min_argc":2, "max_argc":2, "argtype":"0"}, {"name":"popup_menu", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"popup_move", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"popup_notification", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"popup_setoptions", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"popup_settext", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"popup_show", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"pow", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"prevnonblank", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"printf", "min_argc":1, "max_argc":19, "argtype":"FEARG_2"}, {"name":"prompt_setcallback", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"prompt_setinterrupt", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"prompt_setprompt", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"prop_add", "min_argc":3, "max_argc":3, "argtype":"FEARG_1"}, {"name":"prop_clear", "min_argc":1, "max_argc":3, "argtype":"FEARG_1"}, {"name":"prop_find", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"prop_list", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"prop_remove", "min_argc":1, "max_argc":3, "argtype":"FEARG_1"}, {"name":"prop_type_add", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"prop_type_change", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"prop_type_delete", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"prop_type_get", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"prop_type_list", "min_argc":0, "max_argc":1, "argtype":"FEARG_1"}, {"name":"pum_getpos", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"pumvisible", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"py3eval", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"pyeval", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"pyxeval", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"rand", "min_argc":0, "max_argc":1, "argtype":"FEARG_1"}, {"name":"range", "min_argc":1, "max_argc":3, "argtype":"FEARG_1"}, {"name":"readdir", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"readfile", "min_argc":1, "max_argc":3, "argtype":"FEARG_1"}, {"name":"reg_executing", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"reg_recording", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"reltime", "min_argc":0, "max_argc":2, "argtype":"FEARG_1"}, {"name":"reltimefloat", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"reltimestr", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"remote_expr", "min_argc":2, "max_argc":4, "argtype":"FEARG_1"}, {"name":"remote_foreground", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"remote_peek", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"remote_read", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"remote_send", "min_argc":2, "max_argc":3, "argtype":"FEARG_1"}, {"name":"remote_startserver", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"remove", "min_argc":2, "max_argc":3, "argtype":"FEARG_1"}, {"name":"rename", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"repeat", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"resolve", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"reverse", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"round", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"rubyeval", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"screenattr", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"screenchar", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"screenchars", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"screencol", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"screenpos", "min_argc":3, "max_argc":3, "argtype":"FEARG_1"}, {"name":"screenrow", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"screenstring", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"search", "min_argc":1, "max_argc":4, "argtype":"FEARG_1"}, {"name":"searchdecl", "min_argc":1, "max_argc":3, "argtype":"FEARG_1"}, {"name":"searchpair", "min_argc":3, "max_argc":7, "argtype":"0"}, {"name":"searchpairpos", "min_argc":3, "max_argc":7, "argtype":"0"}, {"name":"searchpos", "min_argc":1, "max_argc":4, "argtype":"FEARG_1"}, {"name":"server2client", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"serverlist", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"setbufline", "min_argc":3, "max_argc":3, "argtype":"FEARG_3"}, {"name":"setbufvar", "min_argc":3, "max_argc":3, "argtype":"FEARG_3"}, {"name":"setcharsearch", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"setcmdpos", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"setenv", "min_argc":2, "max_argc":2, "argtype":"FEARG_2"}, {"name":"setfperm", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"setline", "min_argc":2, "max_argc":2, "argtype":"FEARG_2"}, {"name":"setloclist", "min_argc":2, "max_argc":4, "argtype":"FEARG_2"}, {"name":"setmatches", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"setpos", "min_argc":2, "max_argc":2, "argtype":"FEARG_2"}, {"name":"setqflist", "min_argc":1, "max_argc":3, "argtype":"FEARG_1"}, {"name":"setreg", "min_argc":2, "max_argc":3, "argtype":"FEARG_2"}, {"name":"settabvar", "min_argc":3, "max_argc":3, "argtype":"FEARG_3"}, {"name":"settabwinvar", "min_argc":4, "max_argc":4, "argtype":"FEARG_4"}, {"name":"settagstack", "min_argc":2, "max_argc":3, "argtype":"FEARG_2"}, {"name":"setwinvar", "min_argc":3, "max_argc":3, "argtype":"FEARG_3"}, {"name":"sha256", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"shellescape", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"shiftwidth", "min_argc":0, "max_argc":1, "argtype":"FEARG_1"}, {"name":"sign_define", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"sign_getdefined", "min_argc":0, "max_argc":1, "argtype":"FEARG_1"}, {"name":"sign_getplaced", "min_argc":0, "max_argc":2, "argtype":"FEARG_1"}, {"name":"sign_jump", "min_argc":3, "max_argc":3, "argtype":"FEARG_1"}, {"name":"sign_place", "min_argc":4, "max_argc":5, "argtype":"FEARG_1"}, {"name":"sign_placelist", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"sign_undefine", "min_argc":0, "max_argc":1, "argtype":"FEARG_1"}, {"name":"sign_unplace", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"sign_unplacelist", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"simplify", "min_argc":1, "max_argc":1, "argtype":"0"}, {"name":"sin", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"sinh", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"sort", "min_argc":1, "max_argc":3, "argtype":"FEARG_1"}, {"name":"sound_clear", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"sound_playevent", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"sound_playfile", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"sound_stop", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"soundfold", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"spellbadword", "min_argc":0, "max_argc":1, "argtype":"FEARG_1"}, {"name":"spellsuggest", "min_argc":1, "max_argc":3, "argtype":"FEARG_1"}, {"name":"split", "min_argc":1, "max_argc":3, "argtype":"FEARG_1"}, {"name":"sqrt", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"srand", "min_argc":0, "max_argc":1, "argtype":"FEARG_1"}, {"name":"state", "min_argc":0, "max_argc":1, "argtype":"FEARG_1"}, {"name":"str2float", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"str2list", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"str2nr", "min_argc":1, "max_argc":3, "argtype":"FEARG_1"}, {"name":"strcharpart", "min_argc":2, "max_argc":3, "argtype":"FEARG_1"}, {"name":"strchars", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"strdisplaywidth", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"strftime", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"strgetchar", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"stridx", "min_argc":2, "max_argc":3, "argtype":"FEARG_1"}, {"name":"string", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"strlen", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"strpart", "min_argc":2, "max_argc":3, "argtype":"FEARG_1"}, {"name":"strptime", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"strridx", "min_argc":2, "max_argc":3, "argtype":"FEARG_1"}, {"name":"strtrans", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"strwidth", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"submatch", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"substitute", "min_argc":4, "max_argc":4, "argtype":"FEARG_1"}, {"name":"swapinfo", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"swapname", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"synID", "min_argc":3, "max_argc":3, "argtype":"0"}, {"name":"synIDattr", "min_argc":2, "max_argc":3, "argtype":"FEARG_1"}, {"name":"synIDtrans", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"synconcealed", "min_argc":2, "max_argc":2, "argtype":"0"}, {"name":"synstack", "min_argc":2, "max_argc":2, "argtype":"0"}, {"name":"system", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"systemlist", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"tabpagebuflist", "min_argc":0, "max_argc":1, "argtype":"FEARG_1"}, {"name":"tabpagenr", "min_argc":0, "max_argc":1, "argtype":"0"}, {"name":"tabpagewinnr", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"tagfiles", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"taglist", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"tan", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"tanh", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"tempname", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"term_dumpdiff", "min_argc":2, "max_argc":3, "argtype":"FEARG_1"}, {"name":"term_dumpload", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"term_dumpwrite", "min_argc":2, "max_argc":3, "argtype":"FEARG_2"}, {"name":"term_getaltscreen", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"term_getansicolors", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"term_getattr", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"term_getcursor", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"term_getjob", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"term_getline", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"term_getscrolled", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"term_getsize", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"term_getstatus", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"term_gettitle", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"term_gettty", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"term_list", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"term_scrape", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"term_sendkeys", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"term_setansicolors", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"term_setapi", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"term_setkill", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"term_setrestore", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"term_setsize", "min_argc":3, "max_argc":3, "argtype":"FEARG_1"}, {"name":"term_start", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"term_wait", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"test_alloc_fail", "min_argc":3, "max_argc":3, "argtype":"FEARG_1"}, {"name":"test_autochdir", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"test_feedinput", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"test_garbagecollect_now", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"test_garbagecollect_soon", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"test_getvalue", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"test_ignore_error", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"test_null_blob", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"test_null_channel", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"test_null_dict", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"test_null_job", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"test_null_list", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"test_null_partial", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"test_null_string", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"test_option_not_set", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"test_override", "min_argc":2, "max_argc":2, "argtype":"FEARG_2"}, {"name":"test_refcount", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"test_scrollbar", "min_argc":3, "max_argc":3, "argtype":"FEARG_2"}, {"name":"test_setmouse", "min_argc":2, "max_argc":2, "argtype":"0"}, {"name":"test_settime", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"test_srand_seed", "min_argc":0, "max_argc":1, "argtype":"FEARG_1"}, {"name":"test_unknown", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"test_void", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"timer_info", "min_argc":0, "max_argc":1, "argtype":"FEARG_1"}, {"name":"timer_pause", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}, {"name":"timer_start", "min_argc":2, "max_argc":3, "argtype":"FEARG_1"}, {"name":"timer_stop", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"timer_stopall", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"tolower", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"toupper", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"tr", "min_argc":3, "max_argc":3, "argtype":"FEARG_1"}, {"name":"trim", "min_argc":1, "max_argc":2, "argtype":"FEARG_1"}, {"name":"trunc", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"type", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"undofile", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"undotree", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"uniq", "min_argc":1, "max_argc":3, "argtype":"FEARG_1"}, {"name":"values", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"virtcol", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"visualmode", "min_argc":0, "max_argc":1, "argtype":"0"}, {"name":"wildmenumode", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"win_execute", "min_argc":2, "max_argc":3, "argtype":"FEARG_2"}, {"name":"win_findbuf", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"win_getid", "min_argc":0, "max_argc":2, "argtype":"FEARG_1"}, {"name":"win_gettype", "min_argc":0, "max_argc":1, "argtype":"FEARG_1"}, {"name":"win_gotoid", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"win_id2tabwin", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"win_id2win", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"win_screenpos", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"win_splitmove", "min_argc":2, "max_argc":3, "argtype":"FEARG_1"}, {"name":"winbufnr", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"wincol", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"windowsversion", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"winheight", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"winlayout", "min_argc":0, "max_argc":1, "argtype":"FEARG_1"}, {"name":"winline", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"winnr", "min_argc":0, "max_argc":1, "argtype":"FEARG_1"}, {"name":"winrestcmd", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"winrestview", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"winsaveview", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"winwidth", "min_argc":1, "max_argc":1, "argtype":"FEARG_1"}, {"name":"wordcount", "min_argc":0, "max_argc":0, "argtype":"0"}, {"name":"writefile", "min_argc":2, "max_argc":3, "argtype":"FEARG_1"}, {"name":"xor", "min_argc":2, "max_argc":2, "argtype":"FEARG_1"}];
function ExprTokenizer() { this.__init__.apply(this, arguments); }
ExprTokenizer.prototype.__init__ = function(reader) {
    this.reader = reader;
    this.cache = {};
}

ExprTokenizer.prototype.token = function(type, value, pos) {
    return {"type":type, "value":value, "pos":pos};
}

ExprTokenizer.prototype.peek = function() {
    var pos = this.reader.tell();
    var r = this.get();
    this.reader.seek_set(pos);
    return r;
}

ExprTokenizer.prototype.get = function() {
    // FIXME: remove dirty hack
    if (viml_has_key(this.cache, this.reader.tell())) {
        var x = this.cache[this.reader.tell()];
        this.reader.seek_set(x[0]);
        return x[1];
    }
    var pos = this.reader.tell();
    this.reader.skip_white();
    var r = this.get2();
    this.cache[pos] = [this.reader.tell(), r];
    return r;
}

ExprTokenizer.prototype.get2 = function() {
    var r = this.reader;
    var pos = r.getpos();
    var c = r.peek();
    if (c == "<EOF>") {
        return this.token(TOKEN_EOF, c, pos);
    }
    else if (c == "<EOL>") {
        r.seek_cur(1);
        return this.token(TOKEN_EOL, c, pos);
    }
    else if (iswhite(c)) {
        var s = r.read_white();
        return this.token(TOKEN_SPACE, s, pos);
    }
    else if (c == "0" && (r.p(1) == "X" || r.p(1) == "x") && isxdigit(r.p(2))) {
        var s = r.getn(3);
        s += r.read_xdigit();
        return this.token(TOKEN_NUMBER, s, pos);
    }
    else if (c == "0" && (r.p(1) == "B" || r.p(1) == "b") && (r.p(2) == "0" || r.p(2) == "1")) {
        var s = r.getn(3);
        s += r.read_bdigit();
        return this.token(TOKEN_NUMBER, s, pos);
    }
    else if (c == "0" && (r.p(1) == "Z" || r.p(1) == "z") && r.p(2) != ".") {
        var s = r.getn(2);
        s += r.read_blob();
        return this.token(TOKEN_BLOB, s, pos);
    }
    else if (isdigit(c)) {
        var s = r.read_digit();
        if (r.p(0) == "." && isdigit(r.p(1))) {
            s += r.getn(1);
            s += r.read_digit();
            if ((r.p(0) == "E" || r.p(0) == "e") && (isdigit(r.p(1)) || (r.p(1) == "-" || r.p(1) == "+") && isdigit(r.p(2)))) {
                s += r.getn(2);
                s += r.read_digit();
            }
        }
        return this.token(TOKEN_NUMBER, s, pos);
    }
    else if (c == "i" && r.p(1) == "s" && !isidc(r.p(2))) {
        if (r.p(2) == "?") {
            r.seek_cur(3);
            return this.token(TOKEN_ISCI, "is?", pos);
        }
        else if (r.p(2) == "#") {
            r.seek_cur(3);
            return this.token(TOKEN_ISCS, "is#", pos);
        }
        else {
            r.seek_cur(2);
            return this.token(TOKEN_IS, "is", pos);
        }
    }
    else if (c == "i" && r.p(1) == "s" && r.p(2) == "n" && r.p(3) == "o" && r.p(4) == "t" && !isidc(r.p(5))) {
        if (r.p(5) == "?") {
            r.seek_cur(6);
            return this.token(TOKEN_ISNOTCI, "isnot?", pos);
        }
        else if (r.p(5) == "#") {
            r.seek_cur(6);
            return this.token(TOKEN_ISNOTCS, "isnot#", pos);
        }
        else {
            r.seek_cur(5);
            return this.token(TOKEN_ISNOT, "isnot", pos);
        }
    }
    else if (isnamec1(c)) {
        var s = r.read_name();
        return this.token(TOKEN_IDENTIFIER, s, pos);
    }
    else if (c == "|" && r.p(1) == "|") {
        r.seek_cur(2);
        return this.token(TOKEN_OROR, "||", pos);
    }
    else if (c == "&" && r.p(1) == "&") {
        r.seek_cur(2);
        return this.token(TOKEN_ANDAND, "&&", pos);
    }
    else if (c == "=" && r.p(1) == "=") {
        if (r.p(2) == "?") {
            r.seek_cur(3);
            return this.token(TOKEN_EQEQCI, "==?", pos);
        }
        else if (r.p(2) == "#") {
            r.seek_cur(3);
            return this.token(TOKEN_EQEQCS, "==#", pos);
        }
        else {
            r.seek_cur(2);
            return this.token(TOKEN_EQEQ, "==", pos);
        }
    }
    else if (c == "!" && r.p(1) == "=") {
        if (r.p(2) == "?") {
            r.seek_cur(3);
            return this.token(TOKEN_NEQCI, "!=?", pos);
        }
        else if (r.p(2) == "#") {
            r.seek_cur(3);
            return this.token(TOKEN_NEQCS, "!=#", pos);
        }
        else {
            r.seek_cur(2);
            return this.token(TOKEN_NEQ, "!=", pos);
        }
    }
    else if (c == ">" && r.p(1) == "=") {
        if (r.p(2) == "?") {
            r.seek_cur(3);
            return this.token(TOKEN_GTEQCI, ">=?", pos);
        }
        else if (r.p(2) == "#") {
            r.seek_cur(3);
            return this.token(TOKEN_GTEQCS, ">=#", pos);
        }
        else {
            r.seek_cur(2);
            return this.token(TOKEN_GTEQ, ">=", pos);
        }
    }
    else if (c == "<" && r.p(1) == "=") {
        if (r.p(2) == "?") {
            r.seek_cur(3);
            return this.token(TOKEN_LTEQCI, "<=?", pos);
        }
        else if (r.p(2) == "#") {
            r.seek_cur(3);
            return this.token(TOKEN_LTEQCS, "<=#", pos);
        }
        else {
            r.seek_cur(2);
            return this.token(TOKEN_LTEQ, "<=", pos);
        }
    }
    else if (c == "=" && r.p(1) == "~") {
        if (r.p(2) == "?") {
            r.seek_cur(3);
            return this.token(TOKEN_MATCHCI, "=~?", pos);
        }
        else if (r.p(2) == "#") {
            r.seek_cur(3);
            return this.token(TOKEN_MATCHCS, "=~#", pos);
        }
        else {
            r.seek_cur(2);
            return this.token(TOKEN_MATCH, "=~", pos);
        }
    }
    else if (c == "!" && r.p(1) == "~") {
        if (r.p(2) == "?") {
            r.seek_cur(3);
            return this.token(TOKEN_NOMATCHCI, "!~?", pos);
        }
        else if (r.p(2) == "#") {
            r.seek_cur(3);
            return this.token(TOKEN_NOMATCHCS, "!~#", pos);
        }
        else {
            r.seek_cur(2);
            return this.token(TOKEN_NOMATCH, "!~", pos);
        }
    }
    else if (c == ">") {
        if (r.p(1) == "?") {
            r.seek_cur(2);
            return this.token(TOKEN_GTCI, ">?", pos);
        }
        else if (r.p(1) == "#") {
            r.seek_cur(2);
            return this.token(TOKEN_GTCS, ">#", pos);
        }
        else {
            r.seek_cur(1);
            return this.token(TOKEN_GT, ">", pos);
        }
    }
    else if (c == "<") {
        if (r.p(1) == "?") {
            r.seek_cur(2);
            return this.token(TOKEN_LTCI, "<?", pos);
        }
        else if (r.p(1) == "#") {
            r.seek_cur(2);
            return this.token(TOKEN_LTCS, "<#", pos);
        }
        else {
            r.seek_cur(1);
            return this.token(TOKEN_LT, "<", pos);
        }
    }
    else if (c == "+") {
        r.seek_cur(1);
        return this.token(TOKEN_PLUS, "+", pos);
    }
    else if (c == "-") {
        if (r.p(1) == ">") {
            r.seek_cur(2);
            return this.token(TOKEN_ARROW, "->", pos);
        }
        else {
            r.seek_cur(1);
            return this.token(TOKEN_MINUS, "-", pos);
        }
    }
    else if (c == ".") {
        if (r.p(1) == "." && r.p(2) == ".") {
            r.seek_cur(3);
            return this.token(TOKEN_DOTDOTDOT, "...", pos);
        }
        else if (r.p(1) == ".") {
            r.seek_cur(2);
            return this.token(TOKEN_DOTDOT, "..", pos);
            // TODO check scriptversion?
        }
        else {
            r.seek_cur(1);
            return this.token(TOKEN_DOT, ".", pos);
            // TODO check scriptversion?
        }
    }
    else if (c == "*") {
        r.seek_cur(1);
        return this.token(TOKEN_STAR, "*", pos);
    }
    else if (c == "/") {
        r.seek_cur(1);
        return this.token(TOKEN_SLASH, "/", pos);
    }
    else if (c == "%") {
        r.seek_cur(1);
        return this.token(TOKEN_PERCENT, "%", pos);
    }
    else if (c == "!") {
        r.seek_cur(1);
        return this.token(TOKEN_NOT, "!", pos);
    }
    else if (c == "?") {
        r.seek_cur(1);
        return this.token(TOKEN_QUESTION, "?", pos);
    }
    else if (c == ":") {
        r.seek_cur(1);
        return this.token(TOKEN_COLON, ":", pos);
    }
    else if (c == "#") {
        if (r.p(1) == "{") {
            r.seek_cur(2);
            return this.token(TOKEN_LITCOPEN, "#{", pos);
        }
        else {
            r.seek_cur(1);
            return this.token(TOKEN_SHARP, "#", pos);
        }
    }
    else if (c == "(") {
        r.seek_cur(1);
        return this.token(TOKEN_POPEN, "(", pos);
    }
    else if (c == ")") {
        r.seek_cur(1);
        return this.token(TOKEN_PCLOSE, ")", pos);
    }
    else if (c == "[") {
        r.seek_cur(1);
        return this.token(TOKEN_SQOPEN, "[", pos);
    }
    else if (c == "]") {
        r.seek_cur(1);
        return this.token(TOKEN_SQCLOSE, "]", pos);
    }
    else if (c == "{") {
        r.seek_cur(1);
        return this.token(TOKEN_COPEN, "{", pos);
    }
    else if (c == "}") {
        r.seek_cur(1);
        return this.token(TOKEN_CCLOSE, "}", pos);
    }
    else if (c == ",") {
        r.seek_cur(1);
        return this.token(TOKEN_COMMA, ",", pos);
    }
    else if (c == "'") {
        r.seek_cur(1);
        return this.token(TOKEN_SQUOTE, "'", pos);
    }
    else if (c == "\"") {
        r.seek_cur(1);
        return this.token(TOKEN_DQUOTE, "\"", pos);
    }
    else if (c == "$") {
        var s = r.getn(1);
        s += r.read_word();
        return this.token(TOKEN_ENV, s, pos);
    }
    else if (c == "@") {
        // @<EOL> is treated as @"
        return this.token(TOKEN_REG, r.getn(2), pos);
    }
    else if (c == "&") {
        var s = "";
        if ((r.p(1) == "g" || r.p(1) == "l") && r.p(2) == ":") {
            var s = r.getn(3) + r.read_word();
        }
        else {
            var s = r.getn(1) + r.read_word();
        }
        return this.token(TOKEN_OPTION, s, pos);
    }
    else if (c == "=") {
        r.seek_cur(1);
        return this.token(TOKEN_EQ, "=", pos);
    }
    else if (c == "|") {
        r.seek_cur(1);
        return this.token(TOKEN_OR, "|", pos);
    }
    else if (c == ";") {
        r.seek_cur(1);
        return this.token(TOKEN_SEMICOLON, ";", pos);
    }
    else if (c == "`") {
        r.seek_cur(1);
        return this.token(TOKEN_BACKTICK, "`", pos);
    }
    else {
        throw Err(viml_printf("unexpected character: %s", c), this.reader.getpos());
    }
}

ExprTokenizer.prototype.get_sstring = function() {
    this.reader.skip_white();
    var c = this.reader.p(0);
    if (c != "'") {
        throw Err(viml_printf("unexpected character: %s", c), this.reader.getpos());
    }
    this.reader.seek_cur(1);
    var s = "";
    while (TRUE) {
        var c = this.reader.p(0);
        if (c == "<EOF>" || c == "<EOL>") {
            throw Err("unexpected EOL", this.reader.getpos());
        }
        else if (c == "'") {
            this.reader.seek_cur(1);
            if (this.reader.p(0) == "'") {
                this.reader.seek_cur(1);
                s += "''";
            }
            else {
                break;
            }
        }
        else {
            this.reader.seek_cur(1);
            s += c;
        }
    }
    return s;
}

ExprTokenizer.prototype.get_dstring = function() {
    this.reader.skip_white();
    var c = this.reader.p(0);
    if (c != "\"") {
        throw Err(viml_printf("unexpected character: %s", c), this.reader.getpos());
    }
    this.reader.seek_cur(1);
    var s = "";
    while (TRUE) {
        var c = this.reader.p(0);
        if (c == "<EOF>" || c == "<EOL>") {
            throw Err("unexpectd EOL", this.reader.getpos());
        }
        else if (c == "\"") {
            this.reader.seek_cur(1);
            break;
        }
        else if (c == "\\") {
            this.reader.seek_cur(1);
            s += c;
            var c = this.reader.p(0);
            if (c == "<EOF>" || c == "<EOL>") {
                throw Err("ExprTokenizer: unexpected EOL", this.reader.getpos());
            }
            this.reader.seek_cur(1);
            s += c;
        }
        else {
            this.reader.seek_cur(1);
            s += c;
        }
    }
    return s;
}

ExprTokenizer.prototype.parse_dict_literal_key = function() {
    this.reader.skip_white();
    var c = this.reader.peek();
    if (!isalnum(c) && c != "_" && c != "-") {
        throw Err(viml_printf("unexpected character: %s", c), this.reader.getpos());
    }
    var node = Node(NODE_STRING);
    var s = c;
    this.reader.seek_cur(1);
    node.pos = this.reader.getpos();
    while (TRUE) {
        var c = this.reader.p(0);
        if (c == "<EOF>" || c == "<EOL>") {
            throw Err("unexpectd EOL", this.reader.getpos());
        }
        if (!isalnum(c) && c != "_" && c != "-") {
            break;
        }
        this.reader.seek_cur(1);
        s += c;
    }
    node.value = "'" + s + "'";
    return node;
}

function ExprParser() { this.__init__.apply(this, arguments); }
ExprParser.prototype.__init__ = function(reader) {
    this.reader = reader;
    this.tokenizer = new ExprTokenizer(reader);
}

ExprParser.prototype.parse = function() {
    return this.parse_expr1();
}

// expr1: expr2 ? expr1 : expr1
ExprParser.prototype.parse_expr1 = function() {
    var left = this.parse_expr2();
    var pos = this.reader.tell();
    var token = this.tokenizer.get();
    if (token.type == TOKEN_QUESTION) {
        var node = Node(NODE_TERNARY);
        node.pos = token.pos;
        node.cond = left;
        node.left = this.parse_expr1();
        var token = this.tokenizer.get();
        if (token.type != TOKEN_COLON) {
            throw Err(viml_printf("unexpected token: %s", token.value), token.pos);
        }
        node.right = this.parse_expr1();
        var left = node;
    }
    else {
        this.reader.seek_set(pos);
    }
    return left;
}

// expr2: expr3 || expr3 ..
ExprParser.prototype.parse_expr2 = function() {
    var left = this.parse_expr3();
    while (TRUE) {
        var pos = this.reader.tell();
        var token = this.tokenizer.get();
        if (token.type == TOKEN_OROR) {
            var node = Node(NODE_OR);
            node.pos = token.pos;
            node.left = left;
            node.right = this.parse_expr3();
            var left = node;
        }
        else {
            this.reader.seek_set(pos);
            break;
        }
    }
    return left;
}

// expr3: expr4 && expr4
ExprParser.prototype.parse_expr3 = function() {
    var left = this.parse_expr4();
    while (TRUE) {
        var pos = this.reader.tell();
        var token = this.tokenizer.get();
        if (token.type == TOKEN_ANDAND) {
            var node = Node(NODE_AND);
            node.pos = token.pos;
            node.left = left;
            node.right = this.parse_expr4();
            var left = node;
        }
        else {
            this.reader.seek_set(pos);
            break;
        }
    }
    return left;
}

// expr4: expr5 == expr5
//        expr5 != expr5
//        expr5 >  expr5
//        expr5 >= expr5
//        expr5 <  expr5
//        expr5 <= expr5
//        expr5 =~ expr5
//        expr5 !~ expr5
//
//        expr5 ==? expr5
//        expr5 ==# expr5
//        etc.
//
//        expr5 is expr5
//        expr5 isnot expr5
ExprParser.prototype.parse_expr4 = function() {
    var left = this.parse_expr5();
    var pos = this.reader.tell();
    var token = this.tokenizer.get();
    if (token.type == TOKEN_EQEQ) {
        var node = Node(NODE_EQUAL);
        node.pos = token.pos;
        node.left = left;
        node.right = this.parse_expr5();
        var left = node;
    }
    else if (token.type == TOKEN_EQEQCI) {
        var node = Node(NODE_EQUALCI);
        node.pos = token.pos;
        node.left = left;
        node.right = this.parse_expr5();
        var left = node;
    }
    else if (token.type == TOKEN_EQEQCS) {
        var node = Node(NODE_EQUALCS);
        node.pos = token.pos;
        node.left = left;
        node.right = this.parse_expr5();
        var left = node;
    }
    else if (token.type == TOKEN_NEQ) {
        var node = Node(NODE_NEQUAL);
        node.pos = token.pos;
        node.left = left;
        node.right = this.parse_expr5();
        var left = node;
    }
    else if (token.type == TOKEN_NEQCI) {
        var node = Node(NODE_NEQUALCI);
        node.pos = token.pos;
        node.left = left;
        node.right = this.parse_expr5();
        var left = node;
    }
    else if (token.type == TOKEN_NEQCS) {
        var node = Node(NODE_NEQUALCS);
        node.pos = token.pos;
        node.left = left;
        node.right = this.parse_expr5();
        var left = node;
    }
    else if (token.type == TOKEN_GT) {
        var node = Node(NODE_GREATER);
        node.pos = token.pos;
        node.left = left;
        node.right = this.parse_expr5();
        var left = node;
    }
    else if (token.type == TOKEN_GTCI) {
        var node = Node(NODE_GREATERCI);
        node.pos = token.pos;
        node.left = left;
        node.right = this.parse_expr5();
        var left = node;
    }
    else if (token.type == TOKEN_GTCS) {
        var node = Node(NODE_GREATERCS);
        node.pos = token.pos;
        node.left = left;
        node.right = this.parse_expr5();
        var left = node;
    }
    else if (token.type == TOKEN_GTEQ) {
        var node = Node(NODE_GEQUAL);
        node.pos = token.pos;
        node.left = left;
        node.right = this.parse_expr5();
        var left = node;
    }
    else if (token.type == TOKEN_GTEQCI) {
        var node = Node(NODE_GEQUALCI);
        node.pos = token.pos;
        node.left = left;
        node.right = this.parse_expr5();
        var left = node;
    }
    else if (token.type == TOKEN_GTEQCS) {
        var node = Node(NODE_GEQUALCS);
        node.pos = token.pos;
        node.left = left;
        node.right = this.parse_expr5();
        var left = node;
    }
    else if (token.type == TOKEN_LT) {
        var node = Node(NODE_SMALLER);
        node.pos = token.pos;
        node.left = left;
        node.right = this.parse_expr5();
        var left = node;
    }
    else if (token.type == TOKEN_LTCI) {
        var node = Node(NODE_SMALLERCI);
        node.pos = token.pos;
        node.left = left;
        node.right = this.parse_expr5();
        var left = node;
    }
    else if (token.type == TOKEN_LTCS) {
        var node = Node(NODE_SMALLERCS);
        node.pos = token.pos;
        node.left = left;
        node.right = this.parse_expr5();
        var left = node;
    }
    else if (token.type == TOKEN_LTEQ) {
        var node = Node(NODE_SEQUAL);
        node.pos = token.pos;
        node.left = left;
        node.right = this.parse_expr5();
        var left = node;
    }
    else if (token.type == TOKEN_LTEQCI) {
        var node = Node(NODE_SEQUALCI);
        node.pos = token.pos;
        node.left = left;
        node.right = this.parse_expr5();
        var left = node;
    }
    else if (token.type == TOKEN_LTEQCS) {
        var node = Node(NODE_SEQUALCS);
        node.pos = token.pos;
        node.left = left;
        node.right = this.parse_expr5();
        var left = node;
    }
    else if (token.type == TOKEN_MATCH) {
        var node = Node(NODE_MATCH);
        node.pos = token.pos;
        node.left = left;
        node.right = this.parse_expr5();
        var left = node;
    }
    else if (token.type == TOKEN_MATCHCI) {
        var node = Node(NODE_MATCHCI);
        node.pos = token.pos;
        node.left = left;
        node.right = this.parse_expr5();
        var left = node;
    }
    else if (token.type == TOKEN_MATCHCS) {
        var node = Node(NODE_MATCHCS);
        node.pos = token.pos;
        node.left = left;
        node.right = this.parse_expr5();
        var left = node;
    }
    else if (token.type == TOKEN_NOMATCH) {
        var node = Node(NODE_NOMATCH);
        node.pos = token.pos;
        node.left = left;
        node.right = this.parse_expr5();
        var left = node;
    }
    else if (token.type == TOKEN_NOMATCHCI) {
        var node = Node(NODE_NOMATCHCI);
        node.pos = token.pos;
        node.left = left;
        node.right = this.parse_expr5();
        var left = node;
    }
    else if (token.type == TOKEN_NOMATCHCS) {
        var node = Node(NODE_NOMATCHCS);
        node.pos = token.pos;
        node.left = left;
        node.right = this.parse_expr5();
        var left = node;
    }
    else if (token.type == TOKEN_IS) {
        var node = Node(NODE_IS);
        node.pos = token.pos;
        node.left = left;
        node.right = this.parse_expr5();
        var left = node;
    }
    else if (token.type == TOKEN_ISCI) {
        var node = Node(NODE_ISCI);
        node.pos = token.pos;
        node.left = left;
        node.right = this.parse_expr5();
        var left = node;
    }
    else if (token.type == TOKEN_ISCS) {
        var node = Node(NODE_ISCS);
        node.pos = token.pos;
        node.left = left;
        node.right = this.parse_expr5();
        var left = node;
    }
    else if (token.type == TOKEN_ISNOT) {
        var node = Node(NODE_ISNOT);
        node.pos = token.pos;
        node.left = left;
        node.right = this.parse_expr5();
        var left = node;
    }
    else if (token.type == TOKEN_ISNOTCI) {
        var node = Node(NODE_ISNOTCI);
        node.pos = token.pos;
        node.left = left;
        node.right = this.parse_expr5();
        var left = node;
    }
    else if (token.type == TOKEN_ISNOTCS) {
        var node = Node(NODE_ISNOTCS);
        node.pos = token.pos;
        node.left = left;
        node.right = this.parse_expr5();
        var left = node;
    }
    else {
        this.reader.seek_set(pos);
    }
    return left;
}

// expr5: expr6 + expr6 ..
//        expr6 - expr6 ..
//        expr6 . expr6 ..
//        expr6 .. expr6 ..
ExprParser.prototype.parse_expr5 = function() {
    var left = this.parse_expr6();
    while (TRUE) {
        var pos = this.reader.tell();
        var token = this.tokenizer.get();
        if (token.type == TOKEN_PLUS) {
            var node = Node(NODE_ADD);
            node.pos = token.pos;
            node.left = left;
            node.right = this.parse_expr6();
            var left = node;
        }
        else if (token.type == TOKEN_MINUS) {
            var node = Node(NODE_SUBTRACT);
            node.pos = token.pos;
            node.left = left;
            node.right = this.parse_expr6();
            var left = node;
        }
        else if (token.type == TOKEN_DOTDOT) {
            // TODO check scriptversion?
            var node = Node(NODE_CONCAT);
            node.pos = token.pos;
            node.left = left;
            node.right = this.parse_expr6();
            var left = node;
        }
        else if (token.type == TOKEN_DOT) {
            // TODO check scriptversion?
            var node = Node(NODE_CONCAT);
            node.pos = token.pos;
            node.left = left;
            node.right = this.parse_expr6();
            var left = node;
        }
        else {
            this.reader.seek_set(pos);
            break;
        }
    }
    return left;
}

// expr6: expr7 * expr7 ..
//        expr7 / expr7 ..
//        expr7 % expr7 ..
ExprParser.prototype.parse_expr6 = function() {
    var left = this.parse_expr7();
    while (TRUE) {
        var pos = this.reader.tell();
        var token = this.tokenizer.get();
        if (token.type == TOKEN_STAR) {
            var node = Node(NODE_MULTIPLY);
            node.pos = token.pos;
            node.left = left;
            node.right = this.parse_expr7();
            var left = node;
        }
        else if (token.type == TOKEN_SLASH) {
            var node = Node(NODE_DIVIDE);
            node.pos = token.pos;
            node.left = left;
            node.right = this.parse_expr7();
            var left = node;
        }
        else if (token.type == TOKEN_PERCENT) {
            var node = Node(NODE_REMAINDER);
            node.pos = token.pos;
            node.left = left;
            node.right = this.parse_expr7();
            var left = node;
        }
        else {
            this.reader.seek_set(pos);
            break;
        }
    }
    return left;
}

// expr7: ! expr7
//        - expr7
//        + expr7
ExprParser.prototype.parse_expr7 = function() {
    var pos = this.reader.tell();
    var token = this.tokenizer.get();
    if (token.type == TOKEN_NOT) {
        var node = Node(NODE_NOT);
        node.pos = token.pos;
        node.left = this.parse_expr7();
        return node;
    }
    else if (token.type == TOKEN_MINUS) {
        var node = Node(NODE_MINUS);
        node.pos = token.pos;
        node.left = this.parse_expr7();
        return node;
    }
    else if (token.type == TOKEN_PLUS) {
        var node = Node(NODE_PLUS);
        node.pos = token.pos;
        node.left = this.parse_expr7();
        return node;
    }
    else {
        this.reader.seek_set(pos);
        var node = this.parse_expr8();
        return node;
    }
}

// expr8: expr8[expr1]
//        expr8[expr1 : expr1]
//        expr8.name
//        expr8->name(expr1, ...)
//        expr8->s:user_func(expr1, ...)
//        expr8->{lambda}(expr1, ...)
//        expr8(expr1, ...)
ExprParser.prototype.parse_expr8 = function() {
    var left = this.parse_expr9();
    while (TRUE) {
        var pos = this.reader.tell();
        var c = this.reader.peek();
        var token = this.tokenizer.get();
        if (!iswhite(c) && token.type == TOKEN_SQOPEN) {
            var npos = token.pos;
            if (this.tokenizer.peek().type == TOKEN_COLON) {
                this.tokenizer.get();
                var node = Node(NODE_SLICE);
                node.pos = npos;
                node.left = left;
                node.rlist = [NIL, NIL];
                var token = this.tokenizer.peek();
                if (token.type != TOKEN_SQCLOSE) {
                    node.rlist[1] = this.parse_expr1();
                }
                var token = this.tokenizer.get();
                if (token.type != TOKEN_SQCLOSE) {
                    throw Err(viml_printf("unexpected token: %s", token.value), token.pos);
                }
                var left = node;
            }
            else {
                var right = this.parse_expr1();
                if (this.tokenizer.peek().type == TOKEN_COLON) {
                    this.tokenizer.get();
                    var node = Node(NODE_SLICE);
                    node.pos = npos;
                    node.left = left;
                    node.rlist = [right, NIL];
                    var token = this.tokenizer.peek();
                    if (token.type != TOKEN_SQCLOSE) {
                        node.rlist[1] = this.parse_expr1();
                    }
                    var token = this.tokenizer.get();
                    if (token.type != TOKEN_SQCLOSE) {
                        throw Err(viml_printf("unexpected token: %s", token.value), token.pos);
                    }
                    var left = node;
                }
                else {
                    var node = Node(NODE_SUBSCRIPT);
                    node.pos = npos;
                    node.left = left;
                    node.right = right;
                    var token = this.tokenizer.get();
                    if (token.type != TOKEN_SQCLOSE) {
                        throw Err(viml_printf("unexpected token: %s", token.value), token.pos);
                    }
                    var left = node;
                }
            }
            delete node;
        }
        else if (token.type == TOKEN_ARROW) {
            var funcname_or_lambda = this.parse_expr9();
            var token = this.tokenizer.get();
            if (token.type != TOKEN_POPEN) {
                throw Err("E107: Missing parentheses: lambda", token.pos);
            }
            var right = Node(NODE_CALL);
            right.pos = token.pos;
            right.left = funcname_or_lambda;
            right.rlist = this.parse_rlist();
            var node = Node(NODE_METHOD);
            node.pos = token.pos;
            node.left = left;
            node.right = right;
            var left = node;
            delete node;
        }
        else if (token.type == TOKEN_POPEN) {
            var node = Node(NODE_CALL);
            node.pos = token.pos;
            node.left = left;
            node.rlist = this.parse_rlist();
            var left = node;
            delete node;
        }
        else if (!iswhite(c) && token.type == TOKEN_DOT) {
            // TODO check scriptversion?
            var node = this.parse_dot(token, left);
            if (node === NIL) {
                this.reader.seek_set(pos);
                break;
            }
            var left = node;
            delete node;
        }
        else {
            this.reader.seek_set(pos);
            break;
        }
    }
    return left;
}

ExprParser.prototype.parse_rlist = function() {
    var rlist = [];
    var token = this.tokenizer.peek();
    if (this.tokenizer.peek().type == TOKEN_PCLOSE) {
        this.tokenizer.get();
    }
    else {
        while (TRUE) {
            viml_add(rlist, this.parse_expr1());
            var token = this.tokenizer.get();
            if (token.type == TOKEN_COMMA) {
                // XXX: Vim allows foo(a, b, ).  Lint should warn it.
                if (this.tokenizer.peek().type == TOKEN_PCLOSE) {
                    this.tokenizer.get();
                    break;
                }
            }
            else if (token.type == TOKEN_PCLOSE) {
                break;
            }
            else {
                throw Err(viml_printf("unexpected token: %s", token.value), token.pos);
            }
        }
    }
    if (viml_len(rlist) > MAX_FUNC_ARGS) {
        // TODO: funcname E740: Too many arguments for function: %s
        throw Err("E740: Too many arguments for function", token.pos);
    }
    return rlist;
}

// expr9: number
//        "string"
//        'string'
//        [expr1, ...]
//        {expr1: expr1, ...}
//        #{literal_key1: expr1, ...}
//        {args -> expr1}
//        &option
//        (expr1)
//        variable
//        var{ria}ble
//        $VAR
//        @r
//        function(expr1, ...)
//        func{ti}on(expr1, ...)
ExprParser.prototype.parse_expr9 = function() {
    var pos = this.reader.tell();
    var token = this.tokenizer.get();
    var node = Node(-1);
    if (token.type == TOKEN_NUMBER) {
        var node = Node(NODE_NUMBER);
        node.pos = token.pos;
        node.value = token.value;
    }
    else if (token.type == TOKEN_BLOB) {
        var node = Node(NODE_BLOB);
        node.pos = token.pos;
        node.value = token.value;
    }
    else if (token.type == TOKEN_DQUOTE) {
        this.reader.seek_set(pos);
        var node = Node(NODE_STRING);
        node.pos = token.pos;
        node.value = "\"" + this.tokenizer.get_dstring() + "\"";
    }
    else if (token.type == TOKEN_SQUOTE) {
        this.reader.seek_set(pos);
        var node = Node(NODE_STRING);
        node.pos = token.pos;
        node.value = "'" + this.tokenizer.get_sstring() + "'";
    }
    else if (token.type == TOKEN_SQOPEN) {
        var node = Node(NODE_LIST);
        node.pos = token.pos;
        node.value = [];
        var token = this.tokenizer.peek();
        if (token.type == TOKEN_SQCLOSE) {
            this.tokenizer.get();
        }
        else {
            while (TRUE) {
                viml_add(node.value, this.parse_expr1());
                var token = this.tokenizer.peek();
                if (token.type == TOKEN_COMMA) {
                    this.tokenizer.get();
                    if (this.tokenizer.peek().type == TOKEN_SQCLOSE) {
                        this.tokenizer.get();
                        break;
                    }
                }
                else if (token.type == TOKEN_SQCLOSE) {
                    this.tokenizer.get();
                    break;
                }
                else {
                    throw Err(viml_printf("unexpected token: %s", token.value), token.pos);
                }
            }
        }
    }
    else if (token.type == TOKEN_COPEN || token.type == TOKEN_LITCOPEN) {
        var is_litdict = token.type == TOKEN_LITCOPEN;
        var savepos = this.reader.tell();
        var nodepos = token.pos;
        var token = this.tokenizer.get();
        var lambda = token.type == TOKEN_ARROW;
        if (!lambda && !(token.type == TOKEN_SQUOTE || token.type == TOKEN_DQUOTE)) {
            // if the token type is stirng, we cannot peek next token and we can
            // assume it's not lambda.
            var token2 = this.tokenizer.peek();
            var lambda = token2.type == TOKEN_ARROW || token2.type == TOKEN_COMMA;
        }
        // fallback to dict or {expr} if true
        var fallback = FALSE;
        if (lambda) {
            // lambda {token,...} {->...} {token->...}
            var node = Node(NODE_LAMBDA);
            node.pos = nodepos;
            node.rlist = [];
            var named = {};
            while (TRUE) {
                if (token.type == TOKEN_ARROW) {
                    break;
                }
                else if (token.type == TOKEN_IDENTIFIER) {
                    if (!isargname(token.value)) {
                        throw Err(viml_printf("E125: Illegal argument: %s", token.value), token.pos);
                    }
                    else if (viml_has_key(named, token.value)) {
                        throw Err(viml_printf("E853: Duplicate argument name: %s", token.value), token.pos);
                    }
                    named[token.value] = 1;
                    var varnode = Node(NODE_IDENTIFIER);
                    varnode.pos = token.pos;
                    varnode.value = token.value;
                    // XXX: Vim doesn't skip white space before comma.  {a ,b -> ...} => E475
                    if (iswhite(this.reader.p(0)) && this.tokenizer.peek().type == TOKEN_COMMA) {
                        throw Err("E475: Invalid argument: White space is not allowed before comma", this.reader.getpos());
                    }
                    var token = this.tokenizer.get();
                    viml_add(node.rlist, varnode);
                    if (token.type == TOKEN_COMMA) {
                        // XXX: Vim allows last comma.  {a, b, -> ...} => OK
                        var token = this.tokenizer.peek();
                        if (token.type == TOKEN_ARROW) {
                            this.tokenizer.get();
                            break;
                        }
                    }
                    else if (token.type == TOKEN_ARROW) {
                        break;
                    }
                    else {
                        throw Err(viml_printf("unexpected token: %s, type: %d", token.value, token.type), token.pos);
                    }
                }
                else if (token.type == TOKEN_DOTDOTDOT) {
                    var varnode = Node(NODE_IDENTIFIER);
                    varnode.pos = token.pos;
                    varnode.value = token.value;
                    viml_add(node.rlist, varnode);
                    var token = this.tokenizer.peek();
                    if (token.type == TOKEN_ARROW) {
                        this.tokenizer.get();
                        break;
                    }
                    else {
                        throw Err(viml_printf("unexpected token: %s", token.value), token.pos);
                    }
                }
                else {
                    var fallback = TRUE;
                    break;
                }
                var token = this.tokenizer.get();
            }
            if (!fallback) {
                node.left = this.parse_expr1();
                var token = this.tokenizer.get();
                if (token.type != TOKEN_CCLOSE) {
                    throw Err(viml_printf("unexpected token: %s", token.value), token.pos);
                }
                return node;
            }
        }
        // dict
        var node = Node(NODE_DICT);
        node.pos = nodepos;
        node.value = [];
        this.reader.seek_set(savepos);
        var token = this.tokenizer.peek();
        if (token.type == TOKEN_CCLOSE) {
            this.tokenizer.get();
            return node;
        }
        while (1) {
            var key = is_litdict ? this.tokenizer.parse_dict_literal_key() : this.parse_expr1();
            var token = this.tokenizer.get();
            if (token.type == TOKEN_CCLOSE) {
                if (!viml_empty(node.value)) {
                    throw Err(viml_printf("unexpected token: %s", token.value), token.pos);
                }
                this.reader.seek_set(pos);
                var node = this.parse_identifier();
                break;
            }
            if (token.type != TOKEN_COLON) {
                throw Err(viml_printf("unexpected token: %s", token.value), token.pos);
            }
            var val = this.parse_expr1();
            viml_add(node.value, [key, val]);
            var token = this.tokenizer.get();
            if (token.type == TOKEN_COMMA) {
                if (this.tokenizer.peek().type == TOKEN_CCLOSE) {
                    this.tokenizer.get();
                    break;
                }
            }
            else if (token.type == TOKEN_CCLOSE) {
                break;
            }
            else {
                throw Err(viml_printf("unexpected token: %s", token.value), token.pos);
            }
        }
        return node;
    }
    else if (token.type == TOKEN_POPEN) {
        var node = this.parse_expr1();
        var token = this.tokenizer.get();
        if (token.type != TOKEN_PCLOSE) {
            throw Err(viml_printf("unexpected token: %s", token.value), token.pos);
        }
    }
    else if (token.type == TOKEN_OPTION) {
        var node = Node(NODE_OPTION);
        node.pos = token.pos;
        node.value = token.value;
    }
    else if (token.type == TOKEN_IDENTIFIER) {
        this.reader.seek_set(pos);
        var node = this.parse_identifier();
    }
    else if (FALSE && (token.type == TOKEN_COLON || token.type == TOKEN_SHARP)) {
        // XXX: no parse error but invalid expression
        this.reader.seek_set(pos);
        var node = this.parse_identifier();
    }
    else if (token.type == TOKEN_LT && viml_equalci(this.reader.peekn(4), "SID>")) {
        this.reader.seek_set(pos);
        var node = this.parse_identifier();
    }
    else if (token.type == TOKEN_IS || token.type == TOKEN_ISCS || token.type == TOKEN_ISNOT || token.type == TOKEN_ISNOTCS) {
        this.reader.seek_set(pos);
        var node = this.parse_identifier();
    }
    else if (token.type == TOKEN_ENV) {
        var node = Node(NODE_ENV);
        node.pos = token.pos;
        node.value = token.value;
    }
    else if (token.type == TOKEN_REG) {
        var node = Node(NODE_REG);
        node.pos = token.pos;
        node.value = token.value;
    }
    else {
        throw Err(viml_printf("unexpected token: %s", token.value), token.pos);
    }
    return node;
}

// SUBSCRIPT or CONCAT
//   dict "." [0-9A-Za-z_]+ => (subscript dict key)
//   str  "." expr6         => (concat str expr6)
ExprParser.prototype.parse_dot = function(token, left) {
    if (left.type != NODE_IDENTIFIER && left.type != NODE_CURLYNAME && left.type != NODE_DICT && left.type != NODE_SUBSCRIPT && left.type != NODE_CALL && left.type != NODE_DOT) {
        return NIL;
    }
    if (!iswordc(this.reader.p(0))) {
        return NIL;
    }
    var pos = this.reader.getpos();
    var name = this.reader.read_word();
    if (isnamec(this.reader.p(0))) {
        // XXX: foo is str => ok, foo is obj => invalid expression
        // foo.s:bar or foo.bar#baz
        return NIL;
    }
    var node = Node(NODE_DOT);
    node.pos = token.pos;
    node.left = left;
    node.right = Node(NODE_IDENTIFIER);
    node.right.pos = pos;
    node.right.value = name;
    return node;
}

// CONCAT
//   str  ".." expr6         => (concat str expr6)
ExprParser.prototype.parse_concat = function(token, left) {
    if (left.type != NODE_IDENTIFIER && left.type != NODE_CURLYNAME && left.type != NODE_DICT && left.type != NODE_SUBSCRIPT && left.type != NODE_CALL && left.type != NODE_DOT) {
        return NIL;
    }
    if (!iswordc(this.reader.p(0))) {
        return NIL;
    }
    var pos = this.reader.getpos();
    var name = this.reader.read_word();
    if (isnamec(this.reader.p(0))) {
        // XXX: foo is str => ok, foo is obj => invalid expression
        // foo.s:bar or foo.bar#baz
        return NIL;
    }
    var node = Node(NODE_CONCAT);
    node.pos = token.pos;
    node.left = left;
    node.right = Node(NODE_IDENTIFIER);
    node.right.pos = pos;
    node.right.value = name;
    return node;
}

ExprParser.prototype.parse_identifier = function() {
    this.reader.skip_white();
    var npos = this.reader.getpos();
    var curly_parts = this.parse_curly_parts();
    if (viml_len(curly_parts) == 1 && curly_parts[0].type == NODE_CURLYNAMEPART) {
        var node = Node(NODE_IDENTIFIER);
        node.pos = npos;
        node.value = curly_parts[0].value;
        return node;
    }
    else {
        var node = Node(NODE_CURLYNAME);
        node.pos = npos;
        node.value = curly_parts;
        return node;
    }
}

ExprParser.prototype.parse_curly_parts = function() {
    var curly_parts = [];
    var c = this.reader.peek();
    var pos = this.reader.getpos();
    if (c == "<" && viml_equalci(this.reader.peekn(5), "<SID>")) {
        var name = this.reader.getn(5);
        var node = Node(NODE_CURLYNAMEPART);
        node.curly = FALSE;
        // Keep backword compatibility for the curly attribute
        node.pos = pos;
        node.value = name;
        viml_add(curly_parts, node);
    }
    while (TRUE) {
        var c = this.reader.peek();
        if (isnamec(c)) {
            var pos = this.reader.getpos();
            var name = this.reader.read_name();
            var node = Node(NODE_CURLYNAMEPART);
            node.curly = FALSE;
            // Keep backword compatibility for the curly attribute
            node.pos = pos;
            node.value = name;
            viml_add(curly_parts, node);
        }
        else if (c == "{") {
            this.reader.get();
            var pos = this.reader.getpos();
            var node = Node(NODE_CURLYNAMEEXPR);
            node.curly = TRUE;
            // Keep backword compatibility for the curly attribute
            node.pos = pos;
            node.value = this.parse_expr1();
            viml_add(curly_parts, node);
            this.reader.skip_white();
            var c = this.reader.p(0);
            if (c != "}") {
                throw Err(viml_printf("unexpected token: %s", c), this.reader.getpos());
            }
            this.reader.seek_cur(1);
        }
        else {
            break;
        }
    }
    return curly_parts;
}

function LvalueParser() { ExprParser.apply(this, arguments); this.__init__.apply(this, arguments); }
LvalueParser.prototype = Object.create(ExprParser.prototype);
LvalueParser.prototype.parse = function() {
    return this.parse_lv8();
}

// expr8: expr8[expr1]
//        expr8[expr1 : expr1]
//        expr8.name
LvalueParser.prototype.parse_lv8 = function() {
    var left = this.parse_lv9();
    while (TRUE) {
        var pos = this.reader.tell();
        var c = this.reader.peek();
        var token = this.tokenizer.get();
        if (!iswhite(c) && token.type == TOKEN_SQOPEN) {
            var npos = token.pos;
            var node = Node(-1);
            if (this.tokenizer.peek().type == TOKEN_COLON) {
                this.tokenizer.get();
                var node = Node(NODE_SLICE);
                node.pos = npos;
                node.left = left;
                node.rlist = [NIL, NIL];
                var token = this.tokenizer.peek();
                if (token.type != TOKEN_SQCLOSE) {
                    node.rlist[1] = this.parse_expr1();
                }
                var token = this.tokenizer.get();
                if (token.type != TOKEN_SQCLOSE) {
                    throw Err(viml_printf("unexpected token: %s", token.value), token.pos);
                }
            }
            else {
                var right = this.parse_expr1();
                if (this.tokenizer.peek().type == TOKEN_COLON) {
                    this.tokenizer.get();
                    var node = Node(NODE_SLICE);
                    node.pos = npos;
                    node.left = left;
                    node.rlist = [right, NIL];
                    var token = this.tokenizer.peek();
                    if (token.type != TOKEN_SQCLOSE) {
                        node.rlist[1] = this.parse_expr1();
                    }
                    var token = this.tokenizer.get();
                    if (token.type != TOKEN_SQCLOSE) {
                        throw Err(viml_printf("unexpected token: %s", token.value), token.pos);
                    }
                }
                else {
                    var node = Node(NODE_SUBSCRIPT);
                    node.pos = npos;
                    node.left = left;
                    node.right = right;
                    var token = this.tokenizer.get();
                    if (token.type != TOKEN_SQCLOSE) {
                        throw Err(viml_printf("unexpected token: %s", token.value), token.pos);
                    }
                }
            }
            var left = node;
            delete node;
        }
        else if (!iswhite(c) && token.type == TOKEN_DOT) {
            var node = this.parse_dot(token, left);
            if (node === NIL) {
                this.reader.seek_set(pos);
                break;
            }
            var left = node;
            delete node;
        }
        else {
            this.reader.seek_set(pos);
            break;
        }
    }
    return left;
}

// expr9: &option
//        variable
//        var{ria}ble
//        $VAR
//        @r
LvalueParser.prototype.parse_lv9 = function() {
    var pos = this.reader.tell();
    var token = this.tokenizer.get();
    var node = Node(-1);
    if (token.type == TOKEN_COPEN) {
        this.reader.seek_set(pos);
        var node = this.parse_identifier();
    }
    else if (token.type == TOKEN_OPTION) {
        var node = Node(NODE_OPTION);
        node.pos = token.pos;
        node.value = token.value;
    }
    else if (token.type == TOKEN_IDENTIFIER) {
        this.reader.seek_set(pos);
        var node = this.parse_identifier();
    }
    else if (token.type == TOKEN_LT && viml_equalci(this.reader.peekn(4), "SID>")) {
        this.reader.seek_set(pos);
        var node = this.parse_identifier();
    }
    else if (token.type == TOKEN_ENV) {
        var node = Node(NODE_ENV);
        node.pos = token.pos;
        node.value = token.value;
    }
    else if (token.type == TOKEN_REG) {
        var node = Node(NODE_REG);
        node.pos = token.pos;
        node.pos = token.pos;
        node.value = token.value;
    }
    else {
        throw Err(viml_printf("unexpected token: %s", token.value), token.pos);
    }
    return node;
}

function StringReader() { this.__init__.apply(this, arguments); }
StringReader.prototype.__init__ = function(lines) {
    this.buf = [];
    this.pos = [];
    var lnum = 0;
    var offset = 0;
    while (lnum < viml_len(lines)) {
        var col = 0;
        var __c7 = viml_split(lines[lnum], "\\zs");
        for (var __i7 = 0; __i7 < __c7.length; ++__i7) {
            var c = __c7[__i7];
            viml_add(this.buf, c);
            viml_add(this.pos, [lnum + 1, col + 1, offset]);
            col += viml_len(c);
            offset += viml_len(c);
        }
        while (lnum + 1 < viml_len(lines) && viml_eqregh(lines[lnum + 1], "^\\s*\\\\")) {
            var skip = TRUE;
            var col = 0;
            var __c8 = viml_split(lines[lnum + 1], "\\zs");
            for (var __i8 = 0; __i8 < __c8.length; ++__i8) {
                var c = __c8[__i8];
                if (skip) {
                    if (c == "\\") {
                        var skip = FALSE;
                    }
                }
                else {
                    viml_add(this.buf, c);
                    viml_add(this.pos, [lnum + 2, col + 1, offset]);
                }
                col += viml_len(c);
                offset += viml_len(c);
            }
            lnum += 1;
            offset += 1;
        }
        viml_add(this.buf, "<EOL>");
        viml_add(this.pos, [lnum + 1, col + 1, offset]);
        lnum += 1;
        offset += 1;
    }
    // for <EOF>
    viml_add(this.pos, [lnum + 1, 0, offset]);
    this.i = 0;
}

StringReader.prototype.eof = function() {
    return this.i >= viml_len(this.buf);
}

StringReader.prototype.tell = function() {
    return this.i;
}

StringReader.prototype.seek_set = function(i) {
    this.i = i;
}

StringReader.prototype.seek_cur = function(i) {
    this.i = this.i + i;
}

StringReader.prototype.seek_end = function(i) {
    this.i = viml_len(this.buf) + i;
}

StringReader.prototype.p = function(i) {
    if (this.i >= viml_len(this.buf)) {
        return "<EOF>";
    }
    return this.buf[this.i + i];
}

StringReader.prototype.peek = function() {
    if (this.i >= viml_len(this.buf)) {
        return "<EOF>";
    }
    return this.buf[this.i];
}

StringReader.prototype.get = function() {
    if (this.i >= viml_len(this.buf)) {
        return "<EOF>";
    }
    this.i += 1;
    return this.buf[this.i - 1];
}

StringReader.prototype.peekn = function(n) {
    var pos = this.tell();
    var r = this.getn(n);
    this.seek_set(pos);
    return r;
}

StringReader.prototype.getn = function(n) {
    var r = "";
    var j = 0;
    while (this.i < viml_len(this.buf) && (n < 0 || j < n)) {
        var c = this.buf[this.i];
        if (c == "<EOL>") {
            break;
        }
        r += c;
        this.i += 1;
        j += 1;
    }
    return r;
}

StringReader.prototype.peekline = function() {
    return this.peekn(-1);
}

StringReader.prototype.readline = function() {
    var r = this.getn(-1);
    this.get();
    return r;
}

StringReader.prototype.getstr = function(begin, end) {
    var r = "";
    var __c9 = viml_range(begin.i, end.i - 1);
    for (var __i9 = 0; __i9 < __c9.length; ++__i9) {
        var i = __c9[__i9];
        if (i >= viml_len(this.buf)) {
            break;
        }
        var c = this.buf[i];
        if (c == "<EOL>") {
            var c = "\n";
        }
        r += c;
    }
    return r;
}

StringReader.prototype.getpos = function() {
    var __tmp = this.pos[this.i];
    var lnum = __tmp[0];
    var col = __tmp[1];
    var offset = __tmp[2];
    return {"i":this.i, "lnum":lnum, "col":col, "offset":offset};
}

StringReader.prototype.setpos = function(pos) {
    this.i = pos.i;
}

StringReader.prototype.read_alpha = function() {
    var r = "";
    while (isalpha(this.peekn(1))) {
        r += this.getn(1);
    }
    return r;
}

StringReader.prototype.read_alnum = function() {
    var r = "";
    while (isalnum(this.peekn(1))) {
        r += this.getn(1);
    }
    return r;
}

StringReader.prototype.read_digit = function() {
    var r = "";
    while (isdigit(this.peekn(1))) {
        r += this.getn(1);
    }
    return r;
}

StringReader.prototype.read_odigit = function() {
    var r = "";
    while (isodigit(this.peekn(1))) {
        r += this.getn(1);
    }
    return r;
}

StringReader.prototype.read_blob = function() {
    var r = "";
    while (1) {
        var s = this.peekn(2);
        if (viml_eqregh(s, "^[0-9A-Fa-f][0-9A-Fa-f]$")) {
            r += this.getn(2);
        }
        else if (viml_eqregh(s, "^\\.[0-9A-Fa-f]$")) {
            r += this.getn(1);
        }
        else if (viml_eqregh(s, "^[0-9A-Fa-f][^0-9A-Fa-f]$")) {
            throw Err("E973: Blob literal should have an even number of hex characters:" + s, this.getpos());
        }
        else {
            break;
        }
    }
    return r;
}

StringReader.prototype.read_xdigit = function() {
    var r = "";
    while (isxdigit(this.peekn(1))) {
        r += this.getn(1);
    }
    return r;
}

StringReader.prototype.read_bdigit = function() {
    var r = "";
    while (this.peekn(1) == "0" || this.peekn(1) == "1") {
        r += this.getn(1);
    }
    return r;
}

StringReader.prototype.read_integer = function() {
    var r = "";
    var c = this.peekn(1);
    if (c == "-" || c == "+") {
        var r = this.getn(1);
    }
    return r + this.read_digit();
}

StringReader.prototype.read_word = function() {
    var r = "";
    while (iswordc(this.peekn(1))) {
        r += this.getn(1);
    }
    return r;
}

StringReader.prototype.read_white = function() {
    var r = "";
    while (iswhite(this.peekn(1))) {
        r += this.getn(1);
    }
    return r;
}

StringReader.prototype.read_nonwhite = function() {
    var r = "";
    var ch = this.peekn(1);
    while (!iswhite(ch) && ch != "") {
        r += this.getn(1);
        var ch = this.peekn(1);
    }
    return r;
}

StringReader.prototype.read_name = function() {
    var r = "";
    while (isnamec(this.peekn(1))) {
        r += this.getn(1);
    }
    return r;
}

StringReader.prototype.skip_white = function() {
    while (iswhite(this.peekn(1))) {
        this.seek_cur(1);
    }
}

StringReader.prototype.skip_white_and_colon = function() {
    while (TRUE) {
        var c = this.peekn(1);
        if (!iswhite(c) && c != ":") {
            break;
        }
        this.seek_cur(1);
    }
}

function Compiler() { this.__init__.apply(this, arguments); }
Compiler.prototype.__init__ = function() {
    this.indent = [""];
    this.lines = [];
}

Compiler.prototype.out = function() {
    var a000 = Array.prototype.slice.call(arguments, 0);
    if (viml_len(a000) == 1) {
        if (a000[0][0] == ")") {
            this.lines[this.lines.length - 1] += a000[0];
        }
        else {
            viml_add(this.lines, this.indent[0] + a000[0]);
        }
    }
    else {
        viml_add(this.lines, this.indent[0] + viml_printf.apply(null, a000));
    }
}

Compiler.prototype.incindent = function(s) {
    viml_insert(this.indent, this.indent[0] + s);
}

Compiler.prototype.decindent = function() {
    viml_remove(this.indent, 0);
}

Compiler.prototype.compile = function(node) {
    if (node.type == NODE_TOPLEVEL) {
        return this.compile_toplevel(node);
    }
    else if (node.type == NODE_COMMENT) {
        this.compile_comment(node);
        return NIL;
    }
    else if (node.type == NODE_EXCMD) {
        this.compile_excmd(node);
        return NIL;
    }
    else if (node.type == NODE_FUNCTION) {
        this.compile_function(node);
        return NIL;
    }
    else if (node.type == NODE_DELFUNCTION) {
        this.compile_delfunction(node);
        return NIL;
    }
    else if (node.type == NODE_RETURN) {
        this.compile_return(node);
        return NIL;
    }
    else if (node.type == NODE_EXCALL) {
        this.compile_excall(node);
        return NIL;
    }
    else if (node.type == NODE_EVAL) {
        this.compile_eval(node);
        return NIL;
    }
    else if (node.type == NODE_LET) {
        this.compile_let(node);
        return NIL;
    }
    else if (node.type == NODE_CONST) {
        this.compile_const(node);
        return NIL;
    }
    else if (node.type == NODE_UNLET) {
        this.compile_unlet(node);
        return NIL;
    }
    else if (node.type == NODE_LOCKVAR) {
        this.compile_lockvar(node);
        return NIL;
    }
    else if (node.type == NODE_UNLOCKVAR) {
        this.compile_unlockvar(node);
        return NIL;
    }
    else if (node.type == NODE_IF) {
        this.compile_if(node);
        return NIL;
    }
    else if (node.type == NODE_WHILE) {
        this.compile_while(node);
        return NIL;
    }
    else if (node.type == NODE_FOR) {
        this.compile_for(node);
        return NIL;
    }
    else if (node.type == NODE_CONTINUE) {
        this.compile_continue(node);
        return NIL;
    }
    else if (node.type == NODE_BREAK) {
        this.compile_break(node);
        return NIL;
    }
    else if (node.type == NODE_TRY) {
        this.compile_try(node);
        return NIL;
    }
    else if (node.type == NODE_THROW) {
        this.compile_throw(node);
        return NIL;
    }
    else if (node.type == NODE_ECHO) {
        this.compile_echo(node);
        return NIL;
    }
    else if (node.type == NODE_ECHON) {
        this.compile_echon(node);
        return NIL;
    }
    else if (node.type == NODE_ECHOHL) {
        this.compile_echohl(node);
        return NIL;
    }
    else if (node.type == NODE_ECHOMSG) {
        this.compile_echomsg(node);
        return NIL;
    }
    else if (node.type == NODE_ECHOERR) {
        this.compile_echoerr(node);
        return NIL;
    }
    else if (node.type == NODE_EXECUTE) {
        this.compile_execute(node);
        return NIL;
    }
    else if (node.type == NODE_TERNARY) {
        return this.compile_ternary(node);
    }
    else if (node.type == NODE_OR) {
        return this.compile_or(node);
    }
    else if (node.type == NODE_AND) {
        return this.compile_and(node);
    }
    else if (node.type == NODE_EQUAL) {
        return this.compile_equal(node);
    }
    else if (node.type == NODE_EQUALCI) {
        return this.compile_equalci(node);
    }
    else if (node.type == NODE_EQUALCS) {
        return this.compile_equalcs(node);
    }
    else if (node.type == NODE_NEQUAL) {
        return this.compile_nequal(node);
    }
    else if (node.type == NODE_NEQUALCI) {
        return this.compile_nequalci(node);
    }
    else if (node.type == NODE_NEQUALCS) {
        return this.compile_nequalcs(node);
    }
    else if (node.type == NODE_GREATER) {
        return this.compile_greater(node);
    }
    else if (node.type == NODE_GREATERCI) {
        return this.compile_greaterci(node);
    }
    else if (node.type == NODE_GREATERCS) {
        return this.compile_greatercs(node);
    }
    else if (node.type == NODE_GEQUAL) {
        return this.compile_gequal(node);
    }
    else if (node.type == NODE_GEQUALCI) {
        return this.compile_gequalci(node);
    }
    else if (node.type == NODE_GEQUALCS) {
        return this.compile_gequalcs(node);
    }
    else if (node.type == NODE_SMALLER) {
        return this.compile_smaller(node);
    }
    else if (node.type == NODE_SMALLERCI) {
        return this.compile_smallerci(node);
    }
    else if (node.type == NODE_SMALLERCS) {
        return this.compile_smallercs(node);
    }
    else if (node.type == NODE_SEQUAL) {
        return this.compile_sequal(node);
    }
    else if (node.type == NODE_SEQUALCI) {
        return this.compile_sequalci(node);
    }
    else if (node.type == NODE_SEQUALCS) {
        return this.compile_sequalcs(node);
    }
    else if (node.type == NODE_MATCH) {
        return this.compile_match(node);
    }
    else if (node.type == NODE_MATCHCI) {
        return this.compile_matchci(node);
    }
    else if (node.type == NODE_MATCHCS) {
        return this.compile_matchcs(node);
    }
    else if (node.type == NODE_NOMATCH) {
        return this.compile_nomatch(node);
    }
    else if (node.type == NODE_NOMATCHCI) {
        return this.compile_nomatchci(node);
    }
    else if (node.type == NODE_NOMATCHCS) {
        return this.compile_nomatchcs(node);
    }
    else if (node.type == NODE_IS) {
        return this.compile_is(node);
    }
    else if (node.type == NODE_ISCI) {
        return this.compile_isci(node);
    }
    else if (node.type == NODE_ISCS) {
        return this.compile_iscs(node);
    }
    else if (node.type == NODE_ISNOT) {
        return this.compile_isnot(node);
    }
    else if (node.type == NODE_ISNOTCI) {
        return this.compile_isnotci(node);
    }
    else if (node.type == NODE_ISNOTCS) {
        return this.compile_isnotcs(node);
    }
    else if (node.type == NODE_ADD) {
        return this.compile_add(node);
    }
    else if (node.type == NODE_SUBTRACT) {
        return this.compile_subtract(node);
    }
    else if (node.type == NODE_CONCAT) {
        return this.compile_concat(node);
    }
    else if (node.type == NODE_MULTIPLY) {
        return this.compile_multiply(node);
    }
    else if (node.type == NODE_DIVIDE) {
        return this.compile_divide(node);
    }
    else if (node.type == NODE_REMAINDER) {
        return this.compile_remainder(node);
    }
    else if (node.type == NODE_NOT) {
        return this.compile_not(node);
    }
    else if (node.type == NODE_PLUS) {
        return this.compile_plus(node);
    }
    else if (node.type == NODE_MINUS) {
        return this.compile_minus(node);
    }
    else if (node.type == NODE_SUBSCRIPT) {
        return this.compile_subscript(node);
    }
    else if (node.type == NODE_SLICE) {
        return this.compile_slice(node);
    }
    else if (node.type == NODE_DOT) {
        return this.compile_dot(node);
    }
    else if (node.type == NODE_METHOD) {
        return this.compile_method(node);
    }
    else if (node.type == NODE_CALL) {
        return this.compile_call(node);
    }
    else if (node.type == NODE_NUMBER) {
        return this.compile_number(node);
    }
    else if (node.type == NODE_BLOB) {
        return this.compile_blob(node);
    }
    else if (node.type == NODE_STRING) {
        return this.compile_string(node);
    }
    else if (node.type == NODE_LIST) {
        return this.compile_list(node);
    }
    else if (node.type == NODE_DICT) {
        return this.compile_dict(node);
    }
    else if (node.type == NODE_OPTION) {
        return this.compile_option(node);
    }
    else if (node.type == NODE_IDENTIFIER) {
        return this.compile_identifier(node);
    }
    else if (node.type == NODE_CURLYNAME) {
        return this.compile_curlyname(node);
    }
    else if (node.type == NODE_ENV) {
        return this.compile_env(node);
    }
    else if (node.type == NODE_REG) {
        return this.compile_reg(node);
    }
    else if (node.type == NODE_CURLYNAMEPART) {
        return this.compile_curlynamepart(node);
    }
    else if (node.type == NODE_CURLYNAMEEXPR) {
        return this.compile_curlynameexpr(node);
    }
    else if (node.type == NODE_LAMBDA) {
        return this.compile_lambda(node);
    }
    else if (node.type == NODE_HEREDOC) {
        return this.compile_heredoc(node);
    }
    else {
        throw viml_printf("Compiler: unknown node: %s", viml_string(node));
    }
    return NIL;
}

Compiler.prototype.compile_body = function(body) {
    var __c10 = body;
    for (var __i10 = 0; __i10 < __c10.length; ++__i10) {
        var node = __c10[__i10];
        this.compile(node);
    }
}

Compiler.prototype.compile_toplevel = function(node) {
    this.compile_body(node.body);
    return this.lines;
}

Compiler.prototype.compile_comment = function(node) {
    this.out(";%s", node.str);
}

Compiler.prototype.compile_excmd = function(node) {
    this.out("(excmd \"%s\")", viml_escape(node.str, "\\\""));
}

Compiler.prototype.compile_function = function(node) {
    var left = this.compile(node.left);
    var rlist = node.rlist.map((function(vval) { return this.compile(vval); }).bind(this));
    var default_args = node.default_args.map((function(vval) { return this.compile(vval); }).bind(this));
    if (!viml_empty(rlist)) {
        var remaining = FALSE;
        if (rlist[rlist.length - 1] == "...") {
            viml_remove(rlist, -1);
            var remaining = TRUE;
        }
        var __c11 = viml_range(viml_len(rlist));
        for (var __i11 = 0; __i11 < __c11.length; ++__i11) {
            var i = __c11[__i11];
            if (i < viml_len(rlist) - viml_len(default_args)) {
                left += viml_printf(" %s", rlist[i]);
            }
            else {
                left += viml_printf(" (%s %s)", rlist[i], default_args[i + viml_len(default_args) - viml_len(rlist)]);
            }
        }
        if (remaining) {
            left += " . ...";
        }
    }
    this.out("(function (%s)", left);
    this.incindent("  ");
    this.compile_body(node.body);
    this.out(")");
    this.decindent();
}

Compiler.prototype.compile_delfunction = function(node) {
    this.out("(delfunction %s)", this.compile(node.left));
}

Compiler.prototype.compile_return = function(node) {
    if (node.left === NIL) {
        this.out("(return)");
    }
    else {
        this.out("(return %s)", this.compile(node.left));
    }
}

Compiler.prototype.compile_excall = function(node) {
    this.out("(call %s)", this.compile(node.left));
}

Compiler.prototype.compile_eval = function(node) {
    this.out("(eval %s)", this.compile(node.left));
}

Compiler.prototype.compile_let = function(node) {
    var left = "";
    if (node.left !== NIL) {
        var left = this.compile(node.left);
    }
    else {
        var left = viml_join(node.list.map((function(vval) { return this.compile(vval); }).bind(this)), " ");
        if (node.rest !== NIL) {
            left += " . " + this.compile(node.rest);
        }
        var left = "(" + left + ")";
    }
    var right = this.compile(node.right);
    this.out("(let %s %s %s)", node.op, left, right);
}

// TODO: merge with s:Compiler.compile_let() ?
Compiler.prototype.compile_const = function(node) {
    var left = "";
    if (node.left !== NIL) {
        var left = this.compile(node.left);
    }
    else {
        var left = viml_join(node.list.map((function(vval) { return this.compile(vval); }).bind(this)), " ");
        if (node.rest !== NIL) {
            left += " . " + this.compile(node.rest);
        }
        var left = "(" + left + ")";
    }
    var right = this.compile(node.right);
    this.out("(const %s %s %s)", node.op, left, right);
}

Compiler.prototype.compile_unlet = function(node) {
    var list = node.list.map((function(vval) { return this.compile(vval); }).bind(this));
    this.out("(unlet %s)", viml_join(list, " "));
}

Compiler.prototype.compile_lockvar = function(node) {
    var list = node.list.map((function(vval) { return this.compile(vval); }).bind(this));
    if (node.depth === NIL) {
        this.out("(lockvar %s)", viml_join(list, " "));
    }
    else {
        this.out("(lockvar %s %s)", node.depth, viml_join(list, " "));
    }
}

Compiler.prototype.compile_unlockvar = function(node) {
    var list = node.list.map((function(vval) { return this.compile(vval); }).bind(this));
    if (node.depth === NIL) {
        this.out("(unlockvar %s)", viml_join(list, " "));
    }
    else {
        this.out("(unlockvar %s %s)", node.depth, viml_join(list, " "));
    }
}

Compiler.prototype.compile_if = function(node) {
    this.out("(if %s", this.compile(node.cond));
    this.incindent("  ");
    this.compile_body(node.body);
    this.decindent();
    var __c12 = node.elseif;
    for (var __i12 = 0; __i12 < __c12.length; ++__i12) {
        var enode = __c12[__i12];
        this.out(" elseif %s", this.compile(enode.cond));
        this.incindent("  ");
        this.compile_body(enode.body);
        this.decindent();
    }
    if (node._else !== NIL) {
        this.out(" else");
        this.incindent("  ");
        this.compile_body(node._else.body);
        this.decindent();
    }
    this.incindent("  ");
    this.out(")");
    this.decindent();
}

Compiler.prototype.compile_while = function(node) {
    this.out("(while %s", this.compile(node.cond));
    this.incindent("  ");
    this.compile_body(node.body);
    this.out(")");
    this.decindent();
}

Compiler.prototype.compile_for = function(node) {
    var left = "";
    if (node.left !== NIL) {
        var left = this.compile(node.left);
    }
    else {
        var left = viml_join(node.list.map((function(vval) { return this.compile(vval); }).bind(this)), " ");
        if (node.rest !== NIL) {
            left += " . " + this.compile(node.rest);
        }
        var left = "(" + left + ")";
    }
    var right = this.compile(node.right);
    this.out("(for %s %s", left, right);
    this.incindent("  ");
    this.compile_body(node.body);
    this.out(")");
    this.decindent();
}

Compiler.prototype.compile_continue = function(node) {
    this.out("(continue)");
}

Compiler.prototype.compile_break = function(node) {
    this.out("(break)");
}

Compiler.prototype.compile_try = function(node) {
    this.out("(try");
    this.incindent("  ");
    this.compile_body(node.body);
    var __c13 = node.catch;
    for (var __i13 = 0; __i13 < __c13.length; ++__i13) {
        var cnode = __c13[__i13];
        if (cnode.pattern !== NIL) {
            this.decindent();
            this.out(" catch /%s/", cnode.pattern);
            this.incindent("  ");
            this.compile_body(cnode.body);
        }
        else {
            this.decindent();
            this.out(" catch");
            this.incindent("  ");
            this.compile_body(cnode.body);
        }
    }
    if (node._finally !== NIL) {
        this.decindent();
        this.out(" finally");
        this.incindent("  ");
        this.compile_body(node._finally.body);
    }
    this.out(")");
    this.decindent();
}

Compiler.prototype.compile_throw = function(node) {
    this.out("(throw %s)", this.compile(node.left));
}

Compiler.prototype.compile_echo = function(node) {
    var list = node.list.map((function(vval) { return this.compile(vval); }).bind(this));
    this.out("(echo %s)", viml_join(list, " "));
}

Compiler.prototype.compile_echon = function(node) {
    var list = node.list.map((function(vval) { return this.compile(vval); }).bind(this));
    this.out("(echon %s)", viml_join(list, " "));
}

Compiler.prototype.compile_echohl = function(node) {
    this.out("(echohl \"%s\")", viml_escape(node.str, "\\\""));
}

Compiler.prototype.compile_echomsg = function(node) {
    var list = node.list.map((function(vval) { return this.compile(vval); }).bind(this));
    this.out("(echomsg %s)", viml_join(list, " "));
}

Compiler.prototype.compile_echoerr = function(node) {
    var list = node.list.map((function(vval) { return this.compile(vval); }).bind(this));
    this.out("(echoerr %s)", viml_join(list, " "));
}

Compiler.prototype.compile_execute = function(node) {
    var list = node.list.map((function(vval) { return this.compile(vval); }).bind(this));
    this.out("(execute %s)", viml_join(list, " "));
}

Compiler.prototype.compile_ternary = function(node) {
    return viml_printf("(?: %s %s %s)", this.compile(node.cond), this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_or = function(node) {
    return viml_printf("(|| %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_and = function(node) {
    return viml_printf("(&& %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_equal = function(node) {
    return viml_printf("(== %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_equalci = function(node) {
    return viml_printf("(==? %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_equalcs = function(node) {
    return viml_printf("(==# %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_nequal = function(node) {
    return viml_printf("(!= %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_nequalci = function(node) {
    return viml_printf("(!=? %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_nequalcs = function(node) {
    return viml_printf("(!=# %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_greater = function(node) {
    return viml_printf("(> %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_greaterci = function(node) {
    return viml_printf("(>? %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_greatercs = function(node) {
    return viml_printf("(># %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_gequal = function(node) {
    return viml_printf("(>= %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_gequalci = function(node) {
    return viml_printf("(>=? %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_gequalcs = function(node) {
    return viml_printf("(>=# %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_smaller = function(node) {
    return viml_printf("(< %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_smallerci = function(node) {
    return viml_printf("(<? %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_smallercs = function(node) {
    return viml_printf("(<# %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_sequal = function(node) {
    return viml_printf("(<= %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_sequalci = function(node) {
    return viml_printf("(<=? %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_sequalcs = function(node) {
    return viml_printf("(<=# %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_match = function(node) {
    return viml_printf("(=~ %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_matchci = function(node) {
    return viml_printf("(=~? %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_matchcs = function(node) {
    return viml_printf("(=~# %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_nomatch = function(node) {
    return viml_printf("(!~ %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_nomatchci = function(node) {
    return viml_printf("(!~? %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_nomatchcs = function(node) {
    return viml_printf("(!~# %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_is = function(node) {
    return viml_printf("(is %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_isci = function(node) {
    return viml_printf("(is? %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_iscs = function(node) {
    return viml_printf("(is# %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_isnot = function(node) {
    return viml_printf("(isnot %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_isnotci = function(node) {
    return viml_printf("(isnot? %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_isnotcs = function(node) {
    return viml_printf("(isnot# %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_add = function(node) {
    return viml_printf("(+ %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_subtract = function(node) {
    return viml_printf("(- %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_concat = function(node) {
    return viml_printf("(concat %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_multiply = function(node) {
    return viml_printf("(* %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_divide = function(node) {
    return viml_printf("(/ %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_remainder = function(node) {
    return viml_printf("(%% %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_not = function(node) {
    return viml_printf("(! %s)", this.compile(node.left));
}

Compiler.prototype.compile_plus = function(node) {
    return viml_printf("(+ %s)", this.compile(node.left));
}

Compiler.prototype.compile_minus = function(node) {
    return viml_printf("(- %s)", this.compile(node.left));
}

Compiler.prototype.compile_subscript = function(node) {
    return viml_printf("(subscript %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_slice = function(node) {
    var r0 = node.rlist[0] === NIL ? "nil" : this.compile(node.rlist[0]);
    var r1 = node.rlist[1] === NIL ? "nil" : this.compile(node.rlist[1]);
    return viml_printf("(slice %s %s %s)", this.compile(node.left), r0, r1);
}

Compiler.prototype.compile_dot = function(node) {
    return viml_printf("(dot %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_method = function(node) {
    return viml_printf("(method %s %s)", this.compile(node.left), this.compile(node.right));
}

Compiler.prototype.compile_call = function(node) {
    var rlist = node.rlist.map((function(vval) { return this.compile(vval); }).bind(this));
    if (viml_empty(rlist)) {
        return viml_printf("(%s)", this.compile(node.left));
    }
    else {
        return viml_printf("(%s %s)", this.compile(node.left), viml_join(rlist, " "));
    }
}

Compiler.prototype.compile_number = function(node) {
    return node.value;
}

Compiler.prototype.compile_blob = function(node) {
    return node.value;
}

Compiler.prototype.compile_string = function(node) {
    return node.value;
}

Compiler.prototype.compile_list = function(node) {
    var value = node.value.map((function(vval) { return this.compile(vval); }).bind(this));
    if (viml_empty(value)) {
        return "(list)";
    }
    else {
        return viml_printf("(list %s)", viml_join(value, " "));
    }
}

Compiler.prototype.compile_dict = function(node) {
    var value = node.value.map((function(vval) { return "(" + this.compile(vval[0]) + " " + this.compile(vval[1]) + ")"; }).bind(this));
    if (viml_empty(value)) {
        return "(dict)";
    }
    else {
        return viml_printf("(dict %s)", viml_join(value, " "));
    }
}

Compiler.prototype.compile_option = function(node) {
    return node.value;
}

Compiler.prototype.compile_identifier = function(node) {
    return node.value;
}

Compiler.prototype.compile_curlyname = function(node) {
    return viml_join(node.value.map((function(vval) { return this.compile(vval); }).bind(this)), "");
}

Compiler.prototype.compile_env = function(node) {
    return node.value;
}

Compiler.prototype.compile_reg = function(node) {
    return node.value;
}

Compiler.prototype.compile_curlynamepart = function(node) {
    return node.value;
}

Compiler.prototype.compile_curlynameexpr = function(node) {
    return "{" + this.compile(node.value) + "}";
}

Compiler.prototype.escape_string = function(str) {
    var m = {"\n":"\\n", "\t":"\\t", "\r":"\\r"};
    var out = "\"";
    var __c14 = viml_range(viml_len(str));
    for (var __i14 = 0; __i14 < __c14.length; ++__i14) {
        var i = __c14[__i14];
        var c = str[i];
        if (viml_has_key(m, c)) {
            out += m[c];
        }
        else {
            out += c;
        }
    }
    out += "\"";
    return out;
}

Compiler.prototype.compile_lambda = function(node) {
    var rlist = node.rlist.map((function(vval) { return this.compile(vval); }).bind(this));
    return viml_printf("(lambda (%s) %s)", viml_join(rlist, " "), this.compile(node.left));
}

Compiler.prototype.compile_heredoc = function(node) {
    if (viml_empty(node.rlist)) {
        var rlist = "(list)";
    }
    else {
        var rlist = "(list " + viml_join(node.rlist.map((function(vval) { return this.escape_string(vval); }).bind(this)), " ") + ")";
    }
    if (viml_empty(node.body)) {
        var body = "(list)";
    }
    else {
        var body = "(list " + viml_join(node.body.map((function(vval) { return this.escape_string(vval); }).bind(this)), " ") + ")";
    }
    var op = this.escape_string(node.op);
    return viml_printf("(heredoc %s %s %s)", rlist, op, body);
}

// TODO: under construction
function RegexpParser() { this.__init__.apply(this, arguments); }
RegexpParser.prototype.RE_VERY_NOMAGIC = 1;
RegexpParser.prototype.RE_NOMAGIC = 2;
RegexpParser.prototype.RE_MAGIC = 3;
RegexpParser.prototype.RE_VERY_MAGIC = 4;
RegexpParser.prototype.__init__ = function(reader, cmd, delim) {
    this.reader = reader;
    this.cmd = cmd;
    this.delim = delim;
    this.reg_magic = this.RE_MAGIC;
}

RegexpParser.prototype.isend = function(c) {
    return c == "<EOF>" || c == "<EOL>" || c == this.delim;
}

RegexpParser.prototype.parse_regexp = function() {
    var prevtoken = "";
    var ntoken = "";
    var ret = [];
    if (this.reader.peekn(4) == "\\%#=") {
        var epos = this.reader.getpos();
        var token = this.reader.getn(5);
        if (token != "\\%#=0" && token != "\\%#=1" && token != "\\%#=2") {
            throw Err("E864: \\%#= can only be followed by 0, 1, or 2", epos);
        }
        viml_add(ret, token);
    }
    while (!this.isend(this.reader.peek())) {
        var prevtoken = ntoken;
        var __tmp = this.get_token();
        var token = __tmp[0];
        var ntoken = __tmp[1];
        if (ntoken == "\\m") {
            this.reg_magic = this.RE_MAGIC;
        }
        else if (ntoken == "\\M") {
            this.reg_magic = this.RE_NOMAGIC;
        }
        else if (ntoken == "\\v") {
            this.reg_magic = this.RE_VERY_MAGIC;
        }
        else if (ntoken == "\\V") {
            this.reg_magic = this.RE_VERY_NOMAGIC;
        }
        else if (ntoken == "\\*") {
            // '*' is not magic as the very first character.
            if (prevtoken == "" || prevtoken == "\\^" || prevtoken == "\\&" || prevtoken == "\\|" || prevtoken == "\\(") {
                var ntoken = "*";
            }
        }
        else if (ntoken == "\\^") {
            // '^' is only magic as the very first character.
            if (this.reg_magic != this.RE_VERY_MAGIC && prevtoken != "" && prevtoken != "\\&" && prevtoken != "\\|" && prevtoken != "\\n" && prevtoken != "\\(" && prevtoken != "\\%(") {
                var ntoken = "^";
            }
        }
        else if (ntoken == "\\$") {
            // '$' is only magic as the very last character
            var pos = this.reader.tell();
            if (this.reg_magic != this.RE_VERY_MAGIC) {
                while (!this.isend(this.reader.peek())) {
                    var __tmp = this.get_token();
                    var t = __tmp[0];
                    var n = __tmp[1];
                    // XXX: Vim doesn't check \v and \V?
                    if (n == "\\c" || n == "\\C" || n == "\\m" || n == "\\M" || n == "\\Z") {
                        continue;
                    }
                    if (n != "\\|" && n != "\\&" && n != "\\n" && n != "\\)") {
                        var ntoken = "$";
                    }
                    break;
                }
            }
            this.reader.seek_set(pos);
        }
        else if (ntoken == "\\?") {
            // '?' is literal in '?' command.
            if (this.cmd == "?") {
                var ntoken = "?";
            }
        }
        viml_add(ret, ntoken);
    }
    return ret;
}

// @return [actual_token, normalized_token]
RegexpParser.prototype.get_token = function() {
    if (this.reg_magic == this.RE_VERY_MAGIC) {
        return this.get_token_very_magic();
    }
    else if (this.reg_magic == this.RE_MAGIC) {
        return this.get_token_magic();
    }
    else if (this.reg_magic == this.RE_NOMAGIC) {
        return this.get_token_nomagic();
    }
    else if (this.reg_magic == this.RE_VERY_NOMAGIC) {
        return this.get_token_very_nomagic();
    }
}

RegexpParser.prototype.get_token_very_magic = function() {
    if (this.isend(this.reader.peek())) {
        return ["<END>", "<END>"];
    }
    var c = this.reader.get();
    if (c == "\\") {
        return this.get_token_backslash_common();
    }
    else if (c == "*") {
        return ["*", "\\*"];
    }
    else if (c == "+") {
        return ["+", "\\+"];
    }
    else if (c == "=") {
        return ["=", "\\="];
    }
    else if (c == "?") {
        return ["?", "\\?"];
    }
    else if (c == "{") {
        return this.get_token_brace("{");
    }
    else if (c == "@") {
        return this.get_token_at("@");
    }
    else if (c == "^") {
        return ["^", "\\^"];
    }
    else if (c == "$") {
        return ["$", "\\$"];
    }
    else if (c == ".") {
        return [".", "\\."];
    }
    else if (c == "<") {
        return ["<", "\\<"];
    }
    else if (c == ">") {
        return [">", "\\>"];
    }
    else if (c == "%") {
        return this.get_token_percent("%");
    }
    else if (c == "[") {
        return this.get_token_sq("[");
    }
    else if (c == "~") {
        return ["~", "\\~"];
    }
    else if (c == "|") {
        return ["|", "\\|"];
    }
    else if (c == "&") {
        return ["&", "\\&"];
    }
    else if (c == "(") {
        return ["(", "\\("];
    }
    else if (c == ")") {
        return [")", "\\)"];
    }
    return [c, c];
}

RegexpParser.prototype.get_token_magic = function() {
    if (this.isend(this.reader.peek())) {
        return ["<END>", "<END>"];
    }
    var c = this.reader.get();
    if (c == "\\") {
        var pos = this.reader.tell();
        var c = this.reader.get();
        if (c == "+") {
            return ["\\+", "\\+"];
        }
        else if (c == "=") {
            return ["\\=", "\\="];
        }
        else if (c == "?") {
            return ["\\?", "\\?"];
        }
        else if (c == "{") {
            return this.get_token_brace("\\{");
        }
        else if (c == "@") {
            return this.get_token_at("\\@");
        }
        else if (c == "<") {
            return ["\\<", "\\<"];
        }
        else if (c == ">") {
            return ["\\>", "\\>"];
        }
        else if (c == "%") {
            return this.get_token_percent("\\%");
        }
        else if (c == "|") {
            return ["\\|", "\\|"];
        }
        else if (c == "&") {
            return ["\\&", "\\&"];
        }
        else if (c == "(") {
            return ["\\(", "\\("];
        }
        else if (c == ")") {
            return ["\\)", "\\)"];
        }
        this.reader.seek_set(pos);
        return this.get_token_backslash_common();
    }
    else if (c == "*") {
        return ["*", "\\*"];
    }
    else if (c == "^") {
        return ["^", "\\^"];
    }
    else if (c == "$") {
        return ["$", "\\$"];
    }
    else if (c == ".") {
        return [".", "\\."];
    }
    else if (c == "[") {
        return this.get_token_sq("[");
    }
    else if (c == "~") {
        return ["~", "\\~"];
    }
    return [c, c];
}

RegexpParser.prototype.get_token_nomagic = function() {
    if (this.isend(this.reader.peek())) {
        return ["<END>", "<END>"];
    }
    var c = this.reader.get();
    if (c == "\\") {
        var pos = this.reader.tell();
        var c = this.reader.get();
        if (c == "*") {
            return ["\\*", "\\*"];
        }
        else if (c == "+") {
            return ["\\+", "\\+"];
        }
        else if (c == "=") {
            return ["\\=", "\\="];
        }
        else if (c == "?") {
            return ["\\?", "\\?"];
        }
        else if (c == "{") {
            return this.get_token_brace("\\{");
        }
        else if (c == "@") {
            return this.get_token_at("\\@");
        }
        else if (c == ".") {
            return ["\\.", "\\."];
        }
        else if (c == "<") {
            return ["\\<", "\\<"];
        }
        else if (c == ">") {
            return ["\\>", "\\>"];
        }
        else if (c == "%") {
            return this.get_token_percent("\\%");
        }
        else if (c == "~") {
            return ["\\~", "\\^"];
        }
        else if (c == "[") {
            return this.get_token_sq("\\[");
        }
        else if (c == "|") {
            return ["\\|", "\\|"];
        }
        else if (c == "&") {
            return ["\\&", "\\&"];
        }
        else if (c == "(") {
            return ["\\(", "\\("];
        }
        else if (c == ")") {
            return ["\\)", "\\)"];
        }
        this.reader.seek_set(pos);
        return this.get_token_backslash_common();
    }
    else if (c == "^") {
        return ["^", "\\^"];
    }
    else if (c == "$") {
        return ["$", "\\$"];
    }
    return [c, c];
}

RegexpParser.prototype.get_token_very_nomagic = function() {
    if (this.isend(this.reader.peek())) {
        return ["<END>", "<END>"];
    }
    var c = this.reader.get();
    if (c == "\\") {
        var pos = this.reader.tell();
        var c = this.reader.get();
        if (c == "*") {
            return ["\\*", "\\*"];
        }
        else if (c == "+") {
            return ["\\+", "\\+"];
        }
        else if (c == "=") {
            return ["\\=", "\\="];
        }
        else if (c == "?") {
            return ["\\?", "\\?"];
        }
        else if (c == "{") {
            return this.get_token_brace("\\{");
        }
        else if (c == "@") {
            return this.get_token_at("\\@");
        }
        else if (c == "^") {
            return ["\\^", "\\^"];
        }
        else if (c == "$") {
            return ["\\$", "\\$"];
        }
        else if (c == "<") {
            return ["\\<", "\\<"];
        }
        else if (c == ">") {
            return ["\\>", "\\>"];
        }
        else if (c == "%") {
            return this.get_token_percent("\\%");
        }
        else if (c == "~") {
            return ["\\~", "\\~"];
        }
        else if (c == "[") {
            return this.get_token_sq("\\[");
        }
        else if (c == "|") {
            return ["\\|", "\\|"];
        }
        else if (c == "&") {
            return ["\\&", "\\&"];
        }
        else if (c == "(") {
            return ["\\(", "\\("];
        }
        else if (c == ")") {
            return ["\\)", "\\)"];
        }
        this.reader.seek_set(pos);
        return this.get_token_backslash_common();
    }
    return [c, c];
}

RegexpParser.prototype.get_token_backslash_common = function() {
    var cclass = "iIkKfFpPsSdDxXoOwWhHaAlLuU";
    var c = this.reader.get();
    if (c == "\\") {
        return ["\\\\", "\\\\"];
    }
    else if (viml_stridx(cclass, c) != -1) {
        return ["\\" + c, "\\" + c];
    }
    else if (c == "_") {
        var epos = this.reader.getpos();
        var c = this.reader.get();
        if (viml_stridx(cclass, c) != -1) {
            return ["\\_" + c, "\\_ . c"];
        }
        else if (c == "^") {
            return ["\\_^", "\\_^"];
        }
        else if (c == "$") {
            return ["\\_$", "\\_$"];
        }
        else if (c == ".") {
            return ["\\_.", "\\_."];
        }
        else if (c == "[") {
            return this.get_token_sq("\\_[");
        }
        throw Err("E63: invalid use of \\_", epos);
    }
    else if (viml_stridx("etrb", c) != -1) {
        return ["\\" + c, "\\" + c];
    }
    else if (viml_stridx("123456789", c) != -1) {
        return ["\\" + c, "\\" + c];
    }
    else if (c == "z") {
        var epos = this.reader.getpos();
        var c = this.reader.get();
        if (viml_stridx("123456789", c) != -1) {
            return ["\\z" + c, "\\z" + c];
        }
        else if (c == "s") {
            return ["\\zs", "\\zs"];
        }
        else if (c == "e") {
            return ["\\ze", "\\ze"];
        }
        else if (c == "(") {
            return ["\\z(", "\\z("];
        }
        throw Err("E68: Invalid character after \\z", epos);
    }
    else if (viml_stridx("cCmMvVZ", c) != -1) {
        return ["\\" + c, "\\" + c];
    }
    else if (c == "%") {
        var epos = this.reader.getpos();
        var c = this.reader.get();
        if (c == "d") {
            var r = this.getdecchrs();
            if (r != "") {
                return ["\\%d" + r, "\\%d" + r];
            }
        }
        else if (c == "o") {
            var r = this.getoctchrs();
            if (r != "") {
                return ["\\%o" + r, "\\%o" + r];
            }
        }
        else if (c == "x") {
            var r = this.gethexchrs(2);
            if (r != "") {
                return ["\\%x" + r, "\\%x" + r];
            }
        }
        else if (c == "u") {
            var r = this.gethexchrs(4);
            if (r != "") {
                return ["\\%u" + r, "\\%u" + r];
            }
        }
        else if (c == "U") {
            var r = this.gethexchrs(8);
            if (r != "") {
                return ["\\%U" + r, "\\%U" + r];
            }
        }
        throw Err("E678: Invalid character after \\%[dxouU]", epos);
    }
    return ["\\" + c, c];
}

// \{}
RegexpParser.prototype.get_token_brace = function(pre) {
    var r = "";
    var minus = "";
    var comma = "";
    var n = "";
    var m = "";
    if (this.reader.p(0) == "-") {
        var minus = this.reader.get();
        r += minus;
    }
    if (isdigit(this.reader.p(0))) {
        var n = this.reader.read_digit();
        r += n;
    }
    if (this.reader.p(0) == ",") {
        var comma = this.rader.get();
        r += comma;
    }
    if (isdigit(this.reader.p(0))) {
        var m = this.reader.read_digit();
        r += m;
    }
    if (this.reader.p(0) == "\\") {
        r += this.reader.get();
    }
    if (this.reader.p(0) != "}") {
        throw Err("E554: Syntax error in \\{...}", this.reader.getpos());
    }
    this.reader.get();
    return [pre + r, "\\{" + minus + n + comma + m + "}"];
}

// \[]
RegexpParser.prototype.get_token_sq = function(pre) {
    var start = this.reader.tell();
    var r = "";
    // Complement of range
    if (this.reader.p(0) == "^") {
        r += this.reader.get();
    }
    // At the start ']' and '-' mean the literal character.
    if (this.reader.p(0) == "]" || this.reader.p(0) == "-") {
        r += this.reader.get();
    }
    while (TRUE) {
        var startc = 0;
        var c = this.reader.p(0);
        if (this.isend(c)) {
            // If there is no matching ']', we assume the '[' is a normal character.
            this.reader.seek_set(start);
            return [pre, "["];
        }
        else if (c == "]") {
            this.reader.seek_cur(1);
            return [pre + r + "]", "\\[" + r + "]"];
        }
        else if (c == "[") {
            var e = this.get_token_sq_char_class();
            if (e == "") {
                var e = this.get_token_sq_equi_class();
                if (e == "") {
                    var e = this.get_token_sq_coll_element();
                    if (e == "") {
                        var __tmp = this.get_token_sq_c();
                        var e = __tmp[0];
                        var startc = __tmp[1];
                    }
                }
            }
            r += e;
        }
        else {
            var __tmp = this.get_token_sq_c();
            var e = __tmp[0];
            var startc = __tmp[1];
            r += e;
        }
        if (startc != 0 && this.reader.p(0) == "-" && !this.isend(this.reader.p(1)) && !(this.reader.p(1) == "\\" && this.reader.p(2) == "n")) {
            this.reader.seek_cur(1);
            r += "-";
            var c = this.reader.p(0);
            if (c == "[") {
                var e = this.get_token_sq_coll_element();
                if (e != "") {
                    var endc = viml_char2nr(e[2]);
                }
                else {
                    var __tmp = this.get_token_sq_c();
                    var e = __tmp[0];
                    var endc = __tmp[1];
                }
                r += e;
            }
            else {
                var __tmp = this.get_token_sq_c();
                var e = __tmp[0];
                var endc = __tmp[1];
                r += e;
            }
            if (startc > endc || endc > startc + 256) {
                throw Err("E16: Invalid range", this.reader.getpos());
            }
        }
    }
}

// [c]
RegexpParser.prototype.get_token_sq_c = function() {
    var c = this.reader.p(0);
    if (c == "\\") {
        this.reader.seek_cur(1);
        var c = this.reader.p(0);
        if (c == "n") {
            this.reader.seek_cur(1);
            return ["\\n", 0];
        }
        else if (c == "r") {
            this.reader.seek_cur(1);
            return ["\\r", 13];
        }
        else if (c == "t") {
            this.reader.seek_cur(1);
            return ["\\t", 9];
        }
        else if (c == "e") {
            this.reader.seek_cur(1);
            return ["\\e", 27];
        }
        else if (c == "b") {
            this.reader.seek_cur(1);
            return ["\\b", 8];
        }
        else if (viml_stridx("]^-\\", c) != -1) {
            this.reader.seek_cur(1);
            return ["\\" + c, viml_char2nr(c)];
        }
        else if (viml_stridx("doxuU", c) != -1) {
            var __tmp = this.get_token_sq_coll_char();
            var c = __tmp[0];
            var n = __tmp[1];
            return [c, n];
        }
        else {
            return ["\\", viml_char2nr("\\")];
        }
    }
    else if (c == "-") {
        this.reader.seek_cur(1);
        return ["-", viml_char2nr("-")];
    }
    else {
        this.reader.seek_cur(1);
        return [c, viml_char2nr(c)];
    }
}

// [\d123]
RegexpParser.prototype.get_token_sq_coll_char = function() {
    var pos = this.reader.tell();
    var c = this.reader.get();
    if (c == "d") {
        var r = this.getdecchrs();
        var n = viml_str2nr(r, 10);
    }
    else if (c == "o") {
        var r = this.getoctchrs();
        var n = viml_str2nr(r, 8);
    }
    else if (c == "x") {
        var r = this.gethexchrs(2);
        var n = viml_str2nr(r, 16);
    }
    else if (c == "u") {
        var r = this.gethexchrs(4);
        var n = viml_str2nr(r, 16);
    }
    else if (c == "U") {
        var r = this.gethexchrs(8);
        var n = viml_str2nr(r, 16);
    }
    else {
        var r = "";
    }
    if (r == "") {
        this.reader.seek_set(pos);
        return "\\";
    }
    return ["\\" + c + r, n];
}

// [[.a.]]
RegexpParser.prototype.get_token_sq_coll_element = function() {
    if (this.reader.p(0) == "[" && this.reader.p(1) == "." && !this.isend(this.reader.p(2)) && this.reader.p(3) == "." && this.reader.p(4) == "]") {
        return this.reader.getn(5);
    }
    return "";
}

// [[=a=]]
RegexpParser.prototype.get_token_sq_equi_class = function() {
    if (this.reader.p(0) == "[" && this.reader.p(1) == "=" && !this.isend(this.reader.p(2)) && this.reader.p(3) == "=" && this.reader.p(4) == "]") {
        return this.reader.getn(5);
    }
    return "";
}

// [[:alpha:]]
RegexpParser.prototype.get_token_sq_char_class = function() {
    var class_names = ["alnum", "alpha", "blank", "cntrl", "digit", "graph", "lower", "print", "punct", "space", "upper", "xdigit", "tab", "return", "backspace", "escape"];
    var pos = this.reader.tell();
    if (this.reader.p(0) == "[" && this.reader.p(1) == ":") {
        this.reader.seek_cur(2);
        var r = this.reader.read_alpha();
        if (this.reader.p(0) == ":" && this.reader.p(1) == "]") {
            this.reader.seek_cur(2);
            var __c15 = class_names;
            for (var __i15 = 0; __i15 < __c15.length; ++__i15) {
                var name = __c15[__i15];
                if (r == name) {
                    return "[:" + name + ":]";
                }
            }
        }
    }
    this.reader.seek_set(pos);
    return "";
}

// \@...
RegexpParser.prototype.get_token_at = function(pre) {
    var epos = this.reader.getpos();
    var c = this.reader.get();
    if (c == ">") {
        return [pre + ">", "\\@>"];
    }
    else if (c == "=") {
        return [pre + "=", "\\@="];
    }
    else if (c == "!") {
        return [pre + "!", "\\@!"];
    }
    else if (c == "<") {
        var c = this.reader.get();
        if (c == "=") {
            return [pre + "<=", "\\@<="];
        }
        else if (c == "!") {
            return [pre + "<!", "\\@<!"];
        }
    }
    throw Err("E64: @ follows nothing", epos);
}

// \%...
RegexpParser.prototype.get_token_percent = function(pre) {
    var c = this.reader.get();
    if (c == "^") {
        return [pre + "^", "\\%^"];
    }
    else if (c == "$") {
        return [pre + "$", "\\%$"];
    }
    else if (c == "V") {
        return [pre + "V", "\\%V"];
    }
    else if (c == "#") {
        return [pre + "#", "\\%#"];
    }
    else if (c == "[") {
        return this.get_token_percent_sq(pre + "[");
    }
    else if (c == "(") {
        return [pre + "(", "\\%("];
    }
    else {
        return this.get_token_mlcv(pre);
    }
}

// \%[]
RegexpParser.prototype.get_token_percent_sq = function(pre) {
    var r = "";
    while (TRUE) {
        var c = this.reader.peek();
        if (this.isend(c)) {
            throw Err("E69: Missing ] after \\%[", this.reader.getpos());
        }
        else if (c == "]") {
            if (r == "") {
                throw Err("E70: Empty \\%[", this.reader.getpos());
            }
            this.reader.seek_cur(1);
            break;
        }
        this.reader.seek_cur(1);
        r += c;
    }
    return [pre + r + "]", "\\%[" + r + "]"];
}

// \%'m \%l \%c \%v
RegexpParser.prototype.get_token_mlvc = function(pre) {
    var r = "";
    var cmp = "";
    if (this.reader.p(0) == "<" || this.reader.p(0) == ">") {
        var cmp = this.reader.get();
        r += cmp;
    }
    if (this.reader.p(0) == "'") {
        r += this.reader.get();
        var c = this.reader.p(0);
        if (this.isend(c)) {
            // FIXME: Should be error?  Vim allow this.
            var c = "";
        }
        else {
            var c = this.reader.get();
        }
        return [pre + r + c, "\\%" + cmp + "'" + c];
    }
    else if (isdigit(this.reader.p(0))) {
        var d = this.reader.read_digit();
        r += d;
        var c = this.reader.p(0);
        if (c == "l") {
            this.reader.get();
            return [pre + r + "l", "\\%" + cmp + d + "l"];
        }
        else if (c == "c") {
            this.reader.get();
            return [pre + r + "c", "\\%" + cmp + d + "c"];
        }
        else if (c == "v") {
            this.reader.get();
            return [pre + r + "v", "\\%" + cmp + d + "v"];
        }
    }
    throw Err("E71: Invalid character after %", this.reader.getpos());
}

RegexpParser.prototype.getdecchrs = function() {
    return this.reader.read_digit();
}

RegexpParser.prototype.getoctchrs = function() {
    return this.reader.read_odigit();
}

RegexpParser.prototype.gethexchrs = function(n) {
    var r = "";
    var __c16 = viml_range(n);
    for (var __i16 = 0; __i16 < __c16.length; ++__i16) {
        var i = __c16[__i16];
        var c = this.reader.peek();
        if (!isxdigit(c)) {
            break;
        }
        r += this.reader.get();
    }
    return r;
}

if (require.main === module) {
  main();
}
else {
  module.exports = {
    VimLParser: VimLParser,
    StringReader: StringReader,
    Compiler: Compiler
  };
}
