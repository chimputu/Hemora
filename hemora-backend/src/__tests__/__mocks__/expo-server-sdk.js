// Mock for expo-server-sdk to avoid ESM import issues in Jest tests
module.exports = {
  Expo: class Expo {
    constructor() {}
    sendAsync() { return Promise.resolve([]); }
    pushAsync() { return Promise.resolve([]); }
  },
  ExpoPushMessage: {},
};
