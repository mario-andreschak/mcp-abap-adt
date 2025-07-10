module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/**/*.test.ts', '**/tests/**/*.js'], // Ensure Jest finds the test file
  testTimeout: 10000, // Increase test timeout to 10 seconds
  forceExit: true, // Force Jest to exit after tests complete
};
