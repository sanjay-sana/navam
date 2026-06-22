// Unit tests cover the pure business logic in src/logic (no React Native /
// expo imports), so we run in a plain node environment and transform TS/JSON
// with babel-preset-expo inline — no babel.config.js, so the app build is
// untouched.
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
  transformIgnorePatterns: ['/node_modules/'],
};
