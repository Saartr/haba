// Injects the Yandex ID LoginSDK manifest placeholder into android/app/build.gradle.
// The authsdk AAR ships a manifest whose meta-data references ${YANDEX_CLIENT_ID};
// without a value the manifest merger fails. android/ is gitignored and wiped by
// `prebuild --clean`, so this must be (re)added by a config plugin every prebuild.
//
// The client ID is public (it ships inside the APK anyway), so it lives here in git —
// same as the VK app id in with-vk-manifest-placeholders.js. No client secret is needed:
// the SDK returns an OAuth token directly and the backend validates it against
// login.yandex.ru/info, so there is no server-side code-for-token exchange.
//
// Get it at https://oauth.yandex.ru/ — platform "Android", package pro.mihmih.haba,
// plus the SHA-256 fingerprints of the debug and release keystores.
// A gradle property (YandexClientID in ~/.gradle/gradle.properties) overrides it, which
// is handy for building against a separate test app without touching git.

const { withAppBuildGradle } = require('@expo/config-plugins');

const MARKER = '// >>> yandex-manifest-placeholders (config plugin)';

const YANDEX_CLIENT_ID = '1e466a3264584e3aaf95945ce4a25449';

module.exports = function withYandexManifestPlaceholders(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') return cfg;
    let contents = cfg.modResults.contents;
    if (contents.includes(MARKER)) return cfg;

    // Пустой placeholder не ломает сборку явно — манифест смерджится, а вход будет
    // падать в рантайме с невнятной ошибкой. Лучше упасть здесь, на prebuild.
    if (!YANDEX_CLIENT_ID) {
      throw new Error(
        'with-yandex-manifest-placeholders: YANDEX_CLIENT_ID не задан. ' +
        'Зарегистрируйте приложение на https://oauth.yandex.ru/ и впишите client_id ' +
        'в plugins/with-yandex-manifest-placeholders.js (или задайте YandexClientID ' +
        'в ~/.gradle/gradle.properties).',
      );
    }

    const placeholdersBlock = `        ${MARKER}
        manifestPlaceholders += [
            YANDEX_CLIENT_ID: (project.findProperty("YandexClientID") ?: "${YANDEX_CLIENT_ID}"),
        ]
        // <<< yandex-manifest-placeholders`;

    // Insert at the top of defaultConfig, right after applicationId.
    const anchor = "applicationId 'pro.mihmih.haba'";
    if (!contents.includes(anchor)) {
      throw new Error('with-yandex-manifest-placeholders: applicationId anchor not found in app/build.gradle');
    }
    contents = contents.replace(anchor, `${anchor}\n${placeholdersBlock}`);
    cfg.modResults.contents = contents;
    return cfg;
  });
};
