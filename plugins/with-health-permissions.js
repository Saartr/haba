// Health Connect manifest setup:
// 1. Adds <uses-permission android:name="android.permission.health.READ_STEPS"/>.
//    react-native-health-connect's own plugin only injects the rationale intent-filter,
//    so the actual READ_STEPS permission must be added separately for the OS to recognise it.
// 2. Adds the Android 14+ permissions-rationale <activity-alias> (VIEW_PERMISSION_USAGE +
//    HEALTH_PERMISSIONS category). Without it, the built-in Health Connect on Android 14+
//    refuses the app and requestPermission() returns [] with no dialog.
// 3. De-duplicates the legacy ACTION_SHOW_PERMISSIONS_RATIONALE intent-filter on MainActivity.

const { withAndroidManifest } = require('@expo/config-plugins');

const PERMISSIONS = ['android.permission.health.READ_STEPS'];
const RATIONALE_ACTION = 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE';
const ALIAS_NAME = 'ViewPermissionUsageActivity';

function ensurePermission(manifest, name) {
  manifest['uses-permission'] = manifest['uses-permission'] || [];
  const exists = manifest['uses-permission'].some(
    (p) => p.$ && p.$['android:name'] === name,
  );
  if (!exists) {
    manifest['uses-permission'].push({ $: { 'android:name': name } });
  }
}

function dedupeLegacyRationale(mainActivity) {
  if (!mainActivity['intent-filter']) return;
  const seen = new Set();
  mainActivity['intent-filter'] = mainActivity['intent-filter'].filter((f) => {
    const action = f.action && f.action[0] && f.action[0].$ && f.action[0].$['android:name'];
    if (action === RATIONALE_ACTION) {
      if (seen.has(action)) return false; // drop duplicates
      seen.add(action);
    }
    return true;
  });
}

function ensureRationaleAlias(application) {
  application['activity-alias'] = application['activity-alias'] || [];
  const exists = application['activity-alias'].some(
    (a) => a.$ && a.$['android:name'] === ALIAS_NAME,
  );
  if (exists) return;
  application['activity-alias'].push({
    $: {
      'android:name': ALIAS_NAME,
      'android:exported': 'true',
      'android:targetActivity': '.MainActivity',
      'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
    },
    'intent-filter': [
      {
        action: [{ $: { 'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE' } }],
        category: [{ $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' } }],
      },
    ],
  });
}

module.exports = function withHealthPermissions(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    PERMISSIONS.forEach((p) => ensurePermission(manifest, p));

    const application = manifest.application && manifest.application[0];
    if (application) {
      // MainActivity может быть ещё не добавлена другими mod'ами — dedup делаем только если есть
      const activities = application.activity || [];
      const mainActivity = activities.find(
        (a) => a.$ && a.$['android:name'] === '.MainActivity',
      );
      if (mainActivity) dedupeLegacyRationale(mainActivity);
      ensureRationaleAlias(application);
    }
    return cfg;
  });
};
