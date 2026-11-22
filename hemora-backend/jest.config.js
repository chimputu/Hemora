/** @type {import('jest').Config} */
const config = {
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": "esbuild-jest",
  },
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  transformIgnorePatterns: [
    "node_modules/(?!(better-auth)/)",
  ],
  moduleFileExtensions: ["ts", "js", "tsx", "jsx", "json", "node"],
  moduleNameMapper: {
    "^(\\.\\.?/.*)\\.js$": "$1",
  },
};

export default config;
