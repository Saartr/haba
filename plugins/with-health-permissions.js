// Adds <uses-permission android:name="android.permission.health.READ_STEPS"/> to AndroidManifest.
// react-native-health-connect's own plugin only injects the rationale intent-filter,
// so the actual READ_STEPS permission must be added separately for the OS to recognise it.

const { withAndroidManifest } = require('@expo/config-plugins');

const PERMISSIONS = ['android.permission.health.READ_STEPS'];

function ensurePermission(manifest, name) {
  manifest['uses-permission'] = manifest['uses-permission'] || [];
  const exists = manifest['uses-permission'].some(
    (p) => p.$ && p.$['android:name'] === name,
  );
  if (!exists) {
    manifest['uses-permission'].push({ $: { 'android:name': name } });
  }
}

module.exports = function withHealthPermissions(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    PERMISSIONS.forEach((p) => ensurePermission(manifest, p));
    return cfg;
  });
};
