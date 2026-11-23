/** @type {import('jest').Config} */
const config = {
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": "esbuild-jest",
  },
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/__mocks__/"],
  transformIgnorePatterns: [
    "node_modules/(?!(better-auth)/)",
  ],
  moduleFileExtensions: ["ts", "js", "tsx", "jsx", "json", "node"],
  moduleNameMapper: {
    "^(\\.\\.?/.*)\\.js$": "$1",
    "^expo-server-sdk$": "<rootDir>/src/__tests__/__mocks__/expo-server-sdk.js",
  },
};

export default config;
