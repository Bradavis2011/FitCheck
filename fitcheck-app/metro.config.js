// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ensure platform-specific extensions are resolved in the correct order
config.resolver.sourceExts = ['expo.tsx', 'expo.ts', 'expo.js', 'tsx', 'ts', 'jsx', 'js', 'json'];

// Add platform-specific extensions
config.resolver.platforms = ['ios', 'android', 'web', 'native'];

module.exports = config;
