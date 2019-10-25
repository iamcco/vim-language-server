import path from 'path';
import { findProjectRoot } from '../../../src/common/util'
const assert = require('assert')
let chai = require('chai');
let expect = chai.expect;

let chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

describe('findProjectRoot test', function() {
  let fixturesDir = path.join(__dirname, '../../fixtures/findProjectRoot')
  let tests = [
    {
      args: {
        patterns: ['autoload'], 
        file: 'upRoot/projectRoot/autoload/plugin/foo.vim'
      },
      expected: 'upRoot/projectRoot'
    }
  ]

  tests.forEach(function(test) {
    let file = path.join(fixturesDir, test.args.file)
    let expectedRoot = path.join(fixturesDir, test.expected)
    it('finds project root for ' + test.args.file, function() {
      let projectRoot = findProjectRoot(file, test.args.patterns)
      return expect(projectRoot).to.eventually.equal(expectedRoot)
    })
  })
})
