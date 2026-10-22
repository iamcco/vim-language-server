export declare interface IPos {
  i?: number;
  lnum: number;
  col: number;
  offset: number;
}

export declare interface INode {
  type: number;
  pos: IPos;
  body: INode[];
  ea: {
    linepos: IPos
    cmdpos: IPos
    argpos: IPos
    cmd: {
      name: string,
    },
  };
  cond?: INode;
  elseif?: INode[];
  _else?: INode;
  op?: string;
  catch?: INode[];
  _finally?: INode;
  left: INode;
  right: INode;
  rlist: INode[];
  rest?: INode;
  default_args?: INode[];
  str: string;
  value?: any;
  endfunction?: INode;
  endif?: INode;
  endfor?: INode;
  endwhile?: INode;
  list?: INode[];
  // Vim9 script
  enddef?: INode;
  endclass?: INode;
  endinterface?: INode;
  endenum?: INode;
  endblock?: INode;
  attr?: {
    return_type?: string,
    type_params?: string,
  };
  type_str?: string;
  rettype?: string;
  type_args?: string;
  name?: string;
  extends?: string | string[];
  implements?: string[];
  enumvalues?: INode[];
  block?: INode;
  autoload?: boolean;
  alias?: string;
  noclear?: boolean;
}

export declare class StringReader {
  public buf: string[];
  public pos: [number, number, number][];
  public i: number;
  constructor(lines: string[])
}

// tslint:disable-next-line
export declare class VimLParser {
  public reader: StringReader;
  public context: INode[];
  public ea: any;
  constructor(isNeovim: boolean)
  public parse(stringReader: StringReader): INode;
  public parse_one_cmd(): void;
}
