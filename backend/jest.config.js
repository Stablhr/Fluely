const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },
  // `dist/` is committed to this repo, so without this Jest also discovers
  // compiled copies of the tests and fails on the stale ones.
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
};
