module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  collectCoverageFrom: ["tests/**/*.{ts,tsx,js,jsx}"],
  transform: { ".(ts|tsx)$": "ts-jest/dist" },
  transformIgnorePatterns: ["[/\\\\]node_modules[/\\\\].+\\.(js|jsx)$"],
  setupFilesAfterEnv: ["@testing-library/jest-dom/extend-expect"],
  resolver: "jest-node-exports-resolver",
  globals: {
    "ts-jest": {
      tsconfig: "tsconfig.json",
    },
  },
};
