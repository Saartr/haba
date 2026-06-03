package pro.mihmih.haba.healthsync

import android.content.Context
import androidx.work.*
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.TimeUnit

private const val PREFS_NAME = "health_sync_prefs"
private const val PREFS_KEY_REFRESH_TOKEN = "refresh_token"
private const val PREFS_KEY_BASE_URL = "base_url"
// Формат: "habitId:startDate,habitId:startDate" — startDate = дата создания каждой привычки
private const val PREFS_KEY_HABITS = "habits"
private const val WORK_TAG = "health_sync"
private const val WORK_NAME = "health_sync_periodic"

class HealthSyncModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("HealthSync")

    // Сохраняет refreshToken в незашифрованный SharedPreferences для Worker.
    Function("saveWorkerToken") { refreshToken: String ->
      val prefs = appContext.reactContext!!.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      prefs.edit().putString(PREFS_KEY_REFRESH_TOKEN, refreshToken).apply()
    }

    // Регистрирует периодическую задачу WorkManager.
    // habits: список пар [habitId, startDate] — startDate = created_at каждой привычки.
    // Worker синкает каждую привычку с её собственной даты создания.
    Function("scheduleSync") { baseUrl: String, habitIds: List<Int>, startDates: List<String> ->
      if (habitIds.isEmpty()) return@Function

      val ctx = appContext.reactContext!!

      val habitsStr = habitIds.zip(startDates).joinToString(",") { (id, date) -> "$id:$date" }
      ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
        .putString(PREFS_KEY_BASE_URL, baseUrl)
        .putString(PREFS_KEY_HABITS, habitsStr)
        .apply()

      val constraints = Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build()

      val request = PeriodicWorkRequestBuilder<HealthSyncWorker>(1, TimeUnit.HOURS)
        .setConstraints(constraints)
        .addTag(WORK_TAG)
        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.MINUTES)
        .build()

      WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(
        WORK_NAME,
        ExistingPeriodicWorkPolicy.KEEP,
        request
      )
    }

    Function("cancelSync") {
      val ctx = appContext.reactContext!!
      WorkManager.getInstance(ctx).cancelUniqueWork(WORK_NAME)
    }
  }
}
