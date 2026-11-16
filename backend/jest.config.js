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
  // Several suites start their own in-memory MongoDB. When Jest runs them in
  // parallel (the default, and what CI does) startup can exceed the 5s
  // default, which showed up as intermittent timeouts rather than failures.
  testTimeout: 30000,
  // Each database suite boots its own in-memory MongoDB. Booting all of them
  // at once (Jest's default is one worker per core) overloaded the machine:
  // instances failed to start and runs took minutes. Two at a time keeps runs
  // short and reliable, locally and on CI's two-core runners.
  maxWorkers: 2,
};
