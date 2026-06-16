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
private const val WORK_NAME_NOW = "health_sync_now"

class HealthSyncModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("HealthSync")

    // Сохраняет refreshToken в SharedPreferences для Worker.
    Function("saveWorkerToken") { refreshToken: String ->
      val prefs = appContext.reactContext!!.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      prefs.edit().putString(PREFS_KEY_REFRESH_TOKEN, refreshToken).apply()
    }

    // Читает refreshToken из SharedPreferences — нужен JS-стороне для детекции ротации Worker-ом.
    Function("getWorkerToken") {
      appContext.reactContext!!.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .getString(PREFS_KEY_REFRESH_TOKEN, null)
    }

    // Регистрирует периодический синк каждые 6 часов.
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

      val request = PeriodicWorkRequestBuilder<HealthSyncWorker>(6, TimeUnit.HOURS)
        .setConstraints(constraints)
        .addTag(WORK_TAG)
        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.MINUTES)
        .build()

      WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(
        WORK_NAME,
        ExistingPeriodicWorkPolicy.UPDATE,
        request
      )
    }

    // Немедленный однократный синк — при открытии приложения.
    Function("syncNow") {
      val ctx = appContext.reactContext!!
      val constraints = Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build()
      val request = OneTimeWorkRequestBuilder<HealthSyncWorker>()
        .setConstraints(constraints)
        .addTag(WORK_TAG)
        .build()
      WorkManager.getInstance(ctx).enqueueUniqueWork(
        WORK_NAME_NOW,
        ExistingWorkPolicy.REPLACE,
        request
      )
    }

    Function("cancelSync") {
      val ctx = appContext.reactContext!!
      WorkManager.getInstance(ctx).cancelAllWorkByTag(WORK_TAG)
    }
  }
}
