package pro.mihmih.haba.healthsync

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDate
import java.time.Period
import java.time.ZoneId

private const val PREFS_NAME = "health_sync_prefs"
private const val PREFS_KEY_REFRESH_TOKEN = "refresh_token"
private const val PREFS_KEY_BASE_URL = "base_url"
private const val PREFS_KEY_HABIT_IDS = "habit_ids"
private const val PREFS_KEY_START_DATE = "start_date"

class HealthSyncWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {

  override suspend fun doWork(): Result {
    val prefs = applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    val refreshToken = prefs.getString(PREFS_KEY_REFRESH_TOKEN, null) ?: return Result.success()
    val baseUrl = prefs.getString(PREFS_KEY_BASE_URL, null) ?: return Result.success()
    val habitIdsRaw = prefs.getString(PREFS_KEY_HABIT_IDS, null) ?: return Result.success()
    val habitIds = habitIdsRaw.split(",").mapNotNull { it.trim().toIntOrNull() }
    if (habitIds.isEmpty()) return Result.success()

    // 1. Получаем свежий accessToken через refreshToken
    val accessToken = refreshAccessToken(baseUrl, refreshToken) ?: return Result.success()

    // 2. Проверяем доступность Health Connect и разрешение READ_STEPS
    val client = try {
      HealthConnectClient.getOrCreate(applicationContext)
    } catch (e: Exception) {
      return Result.success()
    }

    val granted = client.permissionController.getGrantedPermissions()
    val hasSteps = granted.contains(HealthPermission.getReadPermission(StepsRecord::class))
    if (!hasSteps) return Result.success()

    // 3. Читаем шаги с даты создания самой ранней привычки (но не более 90 дней)
    val today = LocalDate.now(ZoneId.systemDefault())
    val stepsByDate = mutableMapOf<String, Long>()

    try {
      val startDateRaw = prefs.getString(PREFS_KEY_START_DATE, null)
      val habitStart = if (startDateRaw != null) {
        try { LocalDate.parse(startDateRaw) } catch (e: Exception) { today.minusDays(6) }
      } else { today.minusDays(6) }
      // Не синкаем более 90 дней назад
      val startDate = if (today.minusDays(90).isAfter(habitStart)) today.minusDays(90) else habitStart
      val startInstant = startDate.atStartOfDay(ZoneId.systemDefault()).toInstant()
      val endInstant = today.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant()

      val response = client.aggregateGroupByPeriod(
        AggregateGroupByPeriodRequest(
          metrics = setOf(StepsRecord.COUNT_TOTAL),
          timeRangeFilter = TimeRangeFilter.between(startInstant, endInstant),
          timeRangeSlicer = Period.ofDays(1),
        )
      )

      for (bucket in response) {
        val count = bucket.result[StepsRecord.COUNT_TOTAL] ?: continue
        if (count <= 0) continue
        val dateStr = bucket.startTime.atZone(ZoneId.systemDefault()).toLocalDate().toString()
        stepsByDate[dateStr] = count
      }
    } catch (e: Exception) {
      return Result.success()
    }

    if (stepsByDate.isEmpty()) return Result.success()

    // 4. Постим шаги на сервер для каждой привычки и каждого дня
    for ((dateStr, steps) in stepsByDate) {
      for (habitId in habitIds) {
        try {
          postSync(baseUrl, accessToken, habitId, steps.toInt(), dateStr)
        } catch (e: Exception) {
          // Не ретраим весь Worker из-за одного неудачного дня
        }
      }
    }

    return Result.success()
  }

  private fun refreshAccessToken(baseUrl: String, refreshToken: String): String? {
    return try {
      val url = URL("$baseUrl/auth/refresh")
      val conn = url.openConnection() as HttpURLConnection
      conn.requestMethod = "POST"
      conn.setRequestProperty("Content-Type", "application/json")
      conn.doOutput = true
      conn.connectTimeout = 10_000
      conn.readTimeout = 10_000

      val body = """{"refreshToken":"$refreshToken"}"""
      conn.outputStream.use { it.write(body.toByteArray()) }

      if (conn.responseCode != 200) return null

      val response = conn.inputStream.bufferedReader().readText()
      JSONObject(response).optString("accessToken", null)
    } catch (e: Exception) {
      null
    }
  }

  private fun postSync(baseUrl: String, accessToken: String, habitId: Int, value: Int, date: String) {
    val url = URL("$baseUrl/habits/$habitId/logs/sync")
    val conn = url.openConnection() as HttpURLConnection
    conn.requestMethod = "POST"
    conn.setRequestProperty("Content-Type", "application/json")
    conn.setRequestProperty("Authorization", "Bearer $accessToken")
    conn.doOutput = true
    conn.connectTimeout = 10_000
    conn.readTimeout = 10_000

    val body = """{"value":$value,"date":"$date","source":"health_connect"}"""
    conn.outputStream.use { it.write(body.toByteArray()) }
    conn.inputStream.close()
  }
}
