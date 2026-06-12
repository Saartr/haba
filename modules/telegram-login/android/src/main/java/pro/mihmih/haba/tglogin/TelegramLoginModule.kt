package pro.mihmih.haba.tglogin

import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import org.telegram.login.TelegramLogin

private const val CLIENT_ID = "8671249381"
// Telegram присваивает уникальный App URL каждой паре package+SHA (из BotFather Native Login).
// debug-ключ: app4160742593-login.tg.dev, release-ключ: app1634232537-login.tg.dev
private val REDIRECT_URI = if (BuildConfig.DEBUG)
  "https://app4160742593-login.tg.dev/tglogin"
else
  "https://app1634232537-login.tg.dev/tglogin"
private val CALLBACK_HOST = if (BuildConfig.DEBUG)
  "app4160742593-login.tg.dev"
else
  "app1634232537-login.tg.dev"

class TelegramLoginModule : Module() {
  // Промис от startLogin держим до прихода App Link с результатом.
  private var pendingPromise: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("TelegramLoginModule")

    OnCreate {
      TelegramLogin.init(
        clientId = CLIENT_ID,
        redirectUri = REDIRECT_URI,
        scopes = listOf("profile", "phone")
      )
    }

    AsyncFunction("startLogin") { promise: Promise ->
      val activity = appContext.activityProvider?.currentActivity
      if (activity == null) {
        promise.reject("NO_ACTIVITY", "No current activity", null)
        return@AsyncFunction
      }
      // Один логин за раз — отклоняем предыдущий незавершённый.
      pendingPromise?.reject("CANCELLED", "Superseded by a new login request", null)
      pendingPromise = promise
      activity.runOnUiThread {
        TelegramLogin.startLogin(activity)
      }
    }

    // Telegram возвращает результат через App Link → ловим intent в MainActivity.
    OnNewIntent { intent: Intent ->
      val uri = intent.data ?: return@OnNewIntent
      if (uri.host != CALLBACK_HOST) return@OnNewIntent
      val promise = pendingPromise ?: return@OnNewIntent
      pendingPromise = null
      TelegramLogin.handleLoginResponse(
        uri,
        onSuccess = { loginData -> promise.resolve(loginData.idToken) },
        onError = { error -> promise.reject("TG_AUTH_FAIL", error.message ?: "Telegram login failed", null) }
      )
    }
  }
}
