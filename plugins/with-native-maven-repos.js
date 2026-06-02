// Injects the maven repositories needed by our native modules into the root
// android/build.gradle `allprojects.repositories`. Module-level `repositories {}`
// blocks are ignored under the React Native settings plugin's centralized
// dependency resolution, and android/ is gitignored + wiped by `prebuild --clean`,
// so these repos must be (re)added by a config plugin on every prebuild.
//
//   - VK ID SDK (com.vk.id:vkid)        -> VK artifactory mirrors
//   - Telegram Login SDK (org.telegram) -> GitHub Packages (needs gpr.user/gpr.key
//                                          in ~/.gradle/gradle.properties)

const { withProjectBuildGradle } = require('@expo/config-plugins');

const MARKER = '// >>> native-maven-repos (config plugin)';

const REPOS_BLOCK = `    ${MARKER}
    maven { url 'https://artifactory-external.vkpartner.ru/artifactory/vkid-sdk-android/' }
    maven { url 'https://artifactory-external.vkpartner.ru/artifactory/maven/' }
    maven { url 'https://artifactory-external.vkpartner.ru/artifactory/vk-id-captcha/android/' }
    maven {
      url 'https://maven.pkg.github.com/TelegramMessenger/telegram-login-android'
      credentials {
        username = project.findProperty('gpr.user') ?: System.getenv('GITHUB_USERNAME')
        password = project.findProperty('gpr.key') ?: System.getenv('GITHUB_TOKEN')
      }
    }
    // <<< native-maven-repos`;

module.exports = function withNativeMavenRepos(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') return cfg;
    let contents = cfg.modResults.contents;
    if (contents.includes(MARKER)) return cfg;

    // Insert right after the jitpack repo inside the allprojects { repositories { ... } } block.
    const anchor = "maven { url 'https://www.jitpack.io' }";
    if (!contents.includes(anchor)) {
      throw new Error('with-native-maven-repos: jitpack anchor not found in android/build.gradle');
    }
    contents = contents.replace(anchor, `${anchor}\n${REPOS_BLOCK}`);
    cfg.modResults.contents = contents;
    return cfg;
  });
};
