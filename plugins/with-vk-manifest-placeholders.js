// Injects the VK ID SDK manifest placeholders into android/app/build.gradle.
// The vkid AAR ships a manifest with meta-data using ${VKIDClientID} etc.; without
// values the manifest merger fails. android/ is gitignored and wiped by
// `prebuild --clean`, so these must be (re)added by a config plugin every prebuild.
//
// ClientID / RedirectHost / RedirectScheme are tied to the public VK app (54615454)
// and safe to keep here. The client secret is read from a gradle property
// (VKIDClientSecret in ~/.gradle/gradle.properties) so it never lands in git.

const { withAppBuildGradle } = require('@expo/config-plugins');

const MARKER = '// >>> vk-manifest-placeholders (config plugin)';

const PLACEHOLDERS_BLOCK = `        ${MARKER}
        manifestPlaceholders += [
            VKIDClientID    : "54615454",
            VKIDClientSecret: (project.findProperty("VKIDClientSecret") ?: ""),
            VKIDRedirectHost: "vk.com",
            VKIDRedirectScheme: "vk54615454",
        ]
        // <<< vk-manifest-placeholders`;

module.exports = function withVkManifestPlaceholders(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') return cfg;
    let contents = cfg.modResults.contents;
    if (contents.includes(MARKER)) return cfg;

    // Insert at the top of defaultConfig, right after applicationId.
    const anchor = "applicationId 'pro.mihmih.haba'";
    if (!contents.includes(anchor)) {
      throw new Error('with-vk-manifest-placeholders: applicationId anchor not found in app/build.gradle');
    }
    contents = contents.replace(anchor, `${anchor}\n${PLACEHOLDERS_BLOCK}`);
    cfg.modResults.contents = contents;
    return cfg;
  });
};
