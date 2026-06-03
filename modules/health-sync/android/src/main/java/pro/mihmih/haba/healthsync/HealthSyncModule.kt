package pro.mihmih.haba.healthsync

import android.content.Context
import androidx.work.*
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.TimeUnit

private const val PREFS_NAME = "health_sync_prefs"
private const val PREFS_KEY_REFRESH_TOKEN = "refresh_token"
private const val PREFS_KEY_BASE_URL = "base_url"
private const val PREFS_KEY_HABIT_IDS = "habit_ids"
private const val PREFS_KEY_START_DATE = "start_date"
private const val WORK_TAG = "health_sync"
private const val WORK_NAME = "health_sync_periodic"

class HealthSyncModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("HealthSync")

    // Сохраняет refreshToken в незашифрованный SharedPreferences для Worker.
    // Вызывается из lib/auth.ts при каждом saveTokens().
    Function("saveWorkerToken") { refreshToken: String ->
      val prefs = appContext.reactContext!!.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      prefs.edit().putString(PREFS_KEY_REFRESH_TOKEN, refreshToken).apply()
    }

    // Регистрирует периодическую задачу WorkManager.
    // Интервал 1 час, требует сеть, KEEP если уже запланирована.
    // habitIds — только для привычек с category=steps.
    // startDate — самая ранняя дата среди всех step-привычек ('2026-05-01'),
    // Worker синкает с этой даты (но не более 90 дней назад).
    Function("scheduleSync") { baseUrl: String, habitIds: List<Int>, startDate: String ->
      if (habitIds.isEmpty()) return@Function

      val ctx = appContext.reactContext!!

      // Сохраняем параметры для Worker
      ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
        .putString(PREFS_KEY_BASE_URL, baseUrl)
        .putString(PREFS_KEY_HABIT_IDS, habitIds.joinToString(","))
        .putString(PREFS_KEY_START_DATE, startDate)
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

    // Отменяет фоновую задачу.
    // Вызывается при логауте или если нет step-привычек.
    Function("cancelSync") {
      val ctx = appContext.reactContext!!
      WorkManager.getInstance(ctx).cancelUniqueWork(WORK_NAME)
    }
  }
}
