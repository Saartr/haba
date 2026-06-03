package pro.mihmih.haba.vkid

import com.vk.id.AccessToken
import com.vk.id.VKID
import com.vk.id.VKIDAuthFail
import com.vk.id.auth.VKIDAuthCallback
import com.vk.id.auth.VKIDAuthParams
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise

class VkIdModule : Module() {
  companion object {
    // VKID.init() допустимо вызывать только раз за процесс. Нативное состояние
    // переживает JS-reload, поэтому статический флаг не даёт повторной инициализации.
    private var initialized = false
  }

  override fun definition() = ModuleDefinition {
    Name("VkIdModule")

    OnCreate {
      if (!initialized) {
        val app = appContext.reactContext?.applicationContext ?: return@OnCreate
        VKID.init(app)
        initialized = true
      }
    }

    AsyncFunction("signIn") { promise: Promise ->
      val activity = appContext.activityProvider?.currentActivity
      if (activity == null) {
        promise.reject("NO_ACTIVITY", "No current activity", null)
        return@AsyncFunction
      }

      val callback = object : VKIDAuthCallback {
        override fun onAuth(accessToken: AccessToken) {
          val user = accessToken.userData
          promise.resolve(mapOf(
            "accessToken" to accessToken.token,
            "userId" to accessToken.userID.toString(),
            "firstName" to (user?.firstName ?: ""),
            "lastName" to (user?.lastName ?: ""),
            "photo200" to (user?.photo200 ?: ""),
            "email" to (user?.email ?: ""),
            "phone" to (user?.phone ?: "")
          ))
        }

        override fun onFail(fail: VKIDAuthFail) {
          promise.reject("VK_AUTH_FAIL", fail.description, null)
        }
      }

      activity.runOnUiThread {
        VKID.instance.authorize(
          activity as androidx.activity.ComponentActivity,
          callback = callback,
          params = VKIDAuthParams { scopes = setOf("email", "phone") }
        )
      }
    }
  }
}
