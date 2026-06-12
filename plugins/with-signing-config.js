// Adds release signing config to android/app/build.gradle.
// Credentials are read from ~/.gradle/gradle.properties:
//   TAPA_STORE_FILE, TAPA_STORE_PASSWORD, TAPA_KEY_ALIAS, TAPA_KEY_PASSWORD

const { withAppBuildGradle } = require('@expo/config-plugins');

const RELEASE_SIGNING = `        release {
            storeFile file(project.findProperty('TAPA_STORE_FILE') ?: '')
            storePassword project.findProperty('TAPA_STORE_PASSWORD') ?: ''
            keyAlias project.findProperty('TAPA_KEY_ALIAS') ?: ''
            keyPassword project.findProperty('TAPA_KEY_PASSWORD') ?: ''
        }`;

module.exports = function withSigningConfig(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;

    if (gradle.includes('TAPA_STORE_FILE')) return cfg;

    // Insert release signing config inside signingConfigs { ... }
    gradle = gradle.replace(
      /(\s+signingConfigs \{[\s\S]*?)(^\s{4}\})/m,
      `$1${RELEASE_SIGNING}\n$2`,
    );

    // Replace signingConfig signingConfigs.debug → signingConfigs.release in buildTypes.release
    // The generated template uses debug signing for release builds by default
    gradle = gradle.replace(
      /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug([\s\S]*?^\s{8}\})/m,
      '$1signingConfig signingConfigs.release$2',
    );

    cfg.modResults.contents = gradle;
    return cfg;
  });
};
