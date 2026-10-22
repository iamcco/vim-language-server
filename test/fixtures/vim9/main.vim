vim9script

import './lib.vim'
import autoload 'auto.vim' as al

var count = 0

class Shape
  var size: number
  def Area(): number
    return this.size * this.size
  enddef
endclass

class Square extends Shape
  def Describe(): string
    return $'{super.Area()} {lib.VERSION}'
  enddef
endclass

def Main(arg: number)
  var sq: Square = Square.new()
  var other = Shape.new()
  for i in range(arg)
    var inner = i
    count += inner
  endfor
  echo sq.Area() other.size lib.Greet('x')
  al.Load()
  var F = (x) => x + count
enddef
