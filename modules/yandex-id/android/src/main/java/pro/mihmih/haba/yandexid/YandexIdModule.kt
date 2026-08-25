package pro.mihmih.haba.yandexid

import com.yandex.authsdk.YandexAuthLoginOptions
import com.yandex.authsdk.YandexAuthOptions
import com.yandex.authsdk.YandexAuthResult
import com.yandex.authsdk.YandexAuthSdk
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Произвольный код запроса — лишь бы не пересекался с другими startActivityForResult в приложении.
private const val REQUEST_CODE = 27431

class YandexIdModule : Module() {
  // SDK создаётся один раз: client_id он читает из manifestPlaceholders (YANDEX_CLIENT_ID),
  // которые подставляет config-плагин with-yandex-manifest-placeholders.
  private var sdk: YandexAuthSdk? = null
  // Промис живёт между запуском интента и приходом результата — SDK работает через
  // ActivityResultContract, а не через колбэк, как VK ID.
  private var pendingPromise: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("YandexIdModule")

    OnCreate {
      val ctx = appContext.reactContext?.applicationContext ?: return@OnCreate
      sdk = YandexAuthSdk.create(YandexAuthOptions(ctx))
    }

    AsyncFunction("signIn") { promise: Promise ->
      val activity = appContext.activityProvider?.currentActivity
      val currentSdk = sdk
      when {
        activity == null -> promise.reject("NO_ACTIVITY", "No current activity", null)
        currentSdk == null -> promise.reject("NO_SDK", "Yandex SDK is not initialized", null)
        // Повторный вызов, пока предыдущий не завершился, затёр бы pendingPromise и первый
        // промис завис бы навсегда.
        pendingPromise != null -> promise.reject("IN_PROGRESS", "Authorization is already in progress", null)
        else -> {
          pendingPromise = promise
          val intent = currentSdk.contract.createIntent(activity, YandexAuthLoginOptions())
          activity.startActivityForResult(intent, REQUEST_CODE)
        }
      }
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != REQUEST_CODE) return@OnActivityResult
      val promise = pendingPromise ?: return@OnActivityResult
      pendingPromise = null
      val currentSdk = sdk
      if (currentSdk == null) {
        promise.reject("NO_SDK", "Yandex SDK is not initialized", null)
        return@OnActivityResult
      }
      when (val result = currentSdk.contract.parseResult(payload.resultCode, payload.data)) {
        is YandexAuthResult.Success -> promise.resolve(result.token.value)
        is YandexAuthResult.Failure ->
          promise.reject("YANDEX_AUTH_FAIL", result.exception.message ?: "Yandex authorization failed", null)
        YandexAuthResult.Cancelled -> promise.reject("YANDEX_AUTH_CANCELLED", "Authorization cancelled", null)
      }
    }
  }
}
