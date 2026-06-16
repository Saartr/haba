// Adds release signing config to android/app/build.gradle.
// Credentials are read from ~/.gradle/gradle.properties:
//   TAPA_STORE_FILE, TAPA_STORE_PASSWORD, TAPA_KEY_ALIAS, TAPA_KEY_PASSWORD
// If TAPA_STORE_FILE is absent (CI or dev machines without keystore) — release build
// falls back to debug signing so assembleDebug/assembleRelease don't crash.

const { withAppBuildGradle } = require('@expo/config-plugins');

// file('') crashes Gradle even for debug builds — guard with hasProperty check.
const RELEASE_SIGNING = `        release {
            if (project.hasProperty('TAPA_STORE_FILE') && project.property('TAPA_STORE_FILE')) {
                storeFile file(project.property('TAPA_STORE_FILE'))
                storePassword project.findProperty('TAPA_STORE_PASSWORD') ?: ''
                keyAlias project.findProperty('TAPA_KEY_ALIAS') ?: ''
                keyPassword project.findProperty('TAPA_KEY_PASSWORD') ?: ''
            }
        }`;

// buildTypes.release: use release keystore if configured, otherwise fall back to debug.
// Groovy parses `signingConfig (expr) ? a : b` as signingConfig(expr), then ternary on Boolean.
// Use a local variable to avoid the ambiguity.
const SIGNING_CONFIG_LINE =
  "def _tapaSigning = (project.hasProperty('TAPA_STORE_FILE') && project.property('TAPA_STORE_FILE')) ? signingConfigs.release : signingConfigs.debug\n            signingConfig _tapaSigning";

module.exports = function withSigningConfig(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;

    if (gradle.includes('TAPA_STORE_FILE')) return cfg;

    // Insert release signing config inside signingConfigs { ... }
    gradle = gradle.replace(
      /(\s+signingConfigs \{[\s\S]*?)(^\s{4}\})/m,
      `$1${RELEASE_SIGNING}\n$2`,
    );

    // Replace signingConfig line in buildTypes.release
    gradle = gradle.replace(
      /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug([\s\S]*?^\s{8}\})/m,
      `$1${SIGNING_CONFIG_LINE}$2`,
    );

    cfg.modResults.contents = gradle;
    return cfg;
  });
};
