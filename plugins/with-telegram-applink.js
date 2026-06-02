// Adds the Telegram Native Login App Link intent-filter to MainActivity.
// Telegram returns the login result (id_token) via an Android App Link:
//   https://app4160742593-login.tg.dev/tglogin
// MainActivity catches it (launchMode singleTask) and the native module's
// OnNewIntent passes the URI to TelegramLogin.handleLoginResponse.

const { withAndroidManifest } = require('@expo/config-plugins');

const HOST = 'app4160742593-login.tg.dev';
const PATH_PREFIX = '/tglogin';

function hasAppLink(activity) {
  const filters = activity['intent-filter'] || [];
  return filters.some((f) => {
    const data = f.data || [];
    return data.some((d) => d.$ && d.$['android:host'] === HOST);
  });
}

function ensureAppLink(activity) {
  if (hasAppLink(activity)) return;
  activity['intent-filter'] = activity['intent-filter'] || [];
  activity['intent-filter'].push({
    $: { 'android:autoVerify': 'true' },
    action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
    category: [
      { $: { 'android:name': 'android.intent.category.DEFAULT' } },
      { $: { 'android:name': 'android.intent.category.BROWSABLE' } },
    ],
    data: [
      {
        $: {
          'android:scheme': 'https',
          'android:host': HOST,
          'android:pathPrefix': PATH_PREFIX,
        },
      },
    ],
  });
}

module.exports = function withTelegramAppLink(config) {
  return withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults.manifest.application?.[0];
    if (!application) return cfg;
    const mainActivity = (application.activity || []).find(
      (a) => a.$ && a.$['android:name'] === '.MainActivity',
    );
    if (mainActivity) ensureAppLink(mainActivity);
    return cfg;
  });
};
