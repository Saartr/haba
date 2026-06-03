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
private const val PREFS_KEY_HABITS = "habits"

class HealthSyncWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {

  override suspend fun doWork(): Result {
    val prefs = applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    val refreshToken = prefs.getString(PREFS_KEY_REFRESH_TOKEN, null) ?: return Result.success()
    val baseUrl = prefs.getString(PREFS_KEY_BASE_URL, null) ?: return Result.success()
    val habitsRaw = prefs.getString(PREFS_KEY_HABITS, null) ?: return Result.success()

    // Парсим "habitId:startDate,habitId:startDate"
    val habits = habitsRaw.split(",").mapNotNull { entry ->
      val parts = entry.trim().split(":")
      if (parts.size == 2) {
        val id = parts[0].toIntOrNull() ?: return@mapNotNull null
        val date = parts[1]
        Pair(id, date)
      } else null
    }
    if (habits.isEmpty()) return Result.success()

    // 1. Получаем свежий accessToken
    val accessToken = refreshAccessToken(baseUrl, refreshToken) ?: return Result.success()

    // 2. Проверяем Health Connect и разрешение
    val client = try {
      HealthConnectClient.getOrCreate(applicationContext)
    } catch (e: Exception) {
      return Result.success()
    }

    val granted = client.permissionController.getGrantedPermissions()
    if (!granted.contains(HealthPermission.getReadPermission(StepsRecord::class))) {
      return Result.success()
    }

    val today = LocalDate.now(ZoneId.systemDefault())

    // 3. Для каждой привычки — читаем шаги с её даты создания и синкаем
    for ((habitId, startDateStr) in habits) {
      try {
        val habitStart = try {
          LocalDate.parse(startDateStr)
        } catch (e: Exception) {
          today
        }
        // Не более 90 дней назад
        val maxStart = today.minusDays(90)
        val startDate = if (habitStart.isBefore(maxStart)) maxStart else habitStart

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
          // Не синкаем дни раньше даты создания привычки
          if (dateStr < startDateStr) continue
          try {
            postSync(baseUrl, accessToken, habitId, count.toInt(), dateStr)
          } catch (e: Exception) {
            // не ретраим весь Worker из-за одного дня
          }
        }
      } catch (e: Exception) {
        // продолжаем с следующей привычкой
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
      conn.outputStream.use { it.write("""{"refreshToken":"$refreshToken"}""".toByteArray()) }
      if (conn.responseCode != 200) return null
      JSONObject(conn.inputStream.bufferedReader().readText()).optString("accessToken", null)
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
    conn.outputStream.use { it.write("""{"value":$value,"date":"$date","source":"health_connect"}""".toByteArray()) }
    conn.inputStream.close()
  }
}
