module.exports = {
  preset: 'react-native',
  testMatch: ['**/__tests__/**/*.test.ts'],
  transformIgnorePatterns: ['node_modules/(?!(markdown-it|@react-native|react-native|sn-plugin-lib)/)'],
};
