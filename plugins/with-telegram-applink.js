// Adds the Telegram Native Login App Link intent-filters to MainActivity.
// Telegram assigns a unique App URL per package+SHA pair:
//   debug:   https://app4160742593-login.tg.dev/tglogin
//   release: https://app1634232537-login.tg.dev/tglogin
// Both are registered in BotFather. Both hosts need intent-filters so
// MainActivity catches the App Link regardless of build type.

const { withAndroidManifest } = require('@expo/config-plugins');

const HOSTS = [
  'app4160742593-login.tg.dev', // debug keystore
  'app1634232537-login.tg.dev', // release keystore
];
const PATH_PREFIX = '/tglogin';

function hasAppLink(activity, host) {
  const filters = activity['intent-filter'] || [];
  return filters.some((f) => {
    const data = f.data || [];
    return data.some((d) => d.$ && d.$['android:host'] === host);
  });
}

function ensureAppLink(activity, host) {
  if (hasAppLink(activity, host)) return;
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
          'android:host': host,
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
    if (mainActivity) HOSTS.forEach((host) => ensureAppLink(mainActivity, host));
    return cfg;
  });
};
