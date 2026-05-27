// Adds <queries><intent>...<data android:scheme="tg"/></intent></queries> to AndroidManifest.
// Required since Android 11+ package visibility — without this, Linking.openURL('tg://...')
// fails silently because the app cannot resolve the Telegram package.

const { withAndroidManifest } = require('@expo/config-plugins');

const SCHEMES = ['tg'];

function ensureQueryScheme(manifest, scheme) {
  manifest.queries = manifest.queries || [];
  const exists = manifest.queries.some((q) => {
    if (!q.intent) return false;
    return q.intent.some((intent) => {
      const data = intent.data || [];
      return data.some((d) => d.$ && d.$['android:scheme'] === scheme);
    });
  });
  if (exists) return;

  manifest.queries.push({
    intent: [
      {
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        category: [{ $: { 'android:name': 'android.intent.category.BROWSABLE' } }],
        data: [{ $: { 'android:scheme': scheme } }],
      },
    ],
  });
}

module.exports = function withTgQueries(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    SCHEMES.forEach((s) => ensureQueryScheme(manifest, s));
    return cfg;
  });
};
