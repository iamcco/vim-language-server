import assert from "assert";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import path from "path";
import { findProjectRoot } from "../../../src/common/util";

const expect = chai.expect;
chai.use(chaiAsPromised);

describe("findProjectRoot test", () => {
  const fixturesDir = path.join(__dirname, "../../fixtures/findProjectRoot");
  const tests = [
    {
      args: {
        file: "upRoot/projectRoot/autoload/plugin/foo.vim",
        patterns: ["autoload"],
      },
      expected: "upRoot/projectRoot",
    },
  ];

  tests.forEach((test) => {
    const file = path.join(fixturesDir, test.args.file);
    const expectedRoot = path.join(fixturesDir, test.expected);
    it("finds project root for " + test.args.file, () => {
      const projectRoot = findProjectRoot(file, test.args.patterns);
      return expect(projectRoot).to.eventually.equal(expectedRoot);
    });
  });
});
