package app.sali.vpn

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

/**
 * Ongoing notification while the VPN is on: «Sali VPN подключён», the server, a live uptime
 * counter and an «Отключить» button. Being a foreground service it also keeps the app process
 * — and with it the tunnel — alive after the user closes the app's screens.
 */
class SaliVpnForegroundService : Service() {
  companion object {
    private const val CHANNEL = "sali_vpn_status"
    private const val NOTIFICATION_ID = 7352
    private const val ACTION_DISCONNECT = "app.sali.vpn.DISCONNECT"

    fun show(context: Context) {
      ContextCompat.startForegroundService(context, Intent(context, SaliVpnForegroundService::class.java))
    }

    fun hide(context: Context) {
      context.stopService(Intent(context, SaliVpnForegroundService::class.java))
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_DISCONNECT) {
      try { SaliTunnel.down(this) } catch (_: Throwable) { }
      stopSelf()
      return START_NOT_STICKY
    }
    ensureChannel()
    val type = if (Build.VERSION.SDK_INT >= 34) ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0
    ServiceCompat.startForeground(this, NOTIFICATION_ID, build(), type)
    // The tunnel state lives in memory: after a process restart there is nothing to resume.
    if (!SaliTunnel.isUp(this)) { stopSelf(); return START_NOT_STICKY }
    return START_NOT_STICKY
  }

  private fun build() = NotificationCompat.Builder(this, CHANNEL)
    .setSmallIcon(R.drawable.ic_stat_sali)
    .setContentTitle("Sali VPN подключён")
    .setContentText(SaliTunnel.serverLabel.ifBlank { "Защищённое соединение" })
    .setSubText("время работы")
    .setWhen(if (SaliTunnel.connectedAt > 0) SaliTunnel.connectedAt else System.currentTimeMillis())
    .setShowWhen(true)
    .setUsesChronometer(true)
    .setOngoing(true)
    .setOnlyAlertOnce(true)
    .setSilent(true)
    .setCategory(NotificationCompat.CATEGORY_SERVICE)
    .setPriority(NotificationCompat.PRIORITY_LOW)
    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
    .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
    .setContentIntent(openApp())
    .addAction(0, "Отключить", disconnect())
    .build()

  private fun openApp(): PendingIntent? {
    val launch = packageManager.getLaunchIntentForPackage(packageName) ?: return null
    launch.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
    return PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun disconnect(): PendingIntent = PendingIntent.getService(
    this, 1,
    Intent(this, SaliVpnForegroundService::class.java).setAction(ACTION_DISCONNECT),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
  )

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < 26) return
    val manager = getSystemService(NotificationManager::class.java)
    if (manager.getNotificationChannel(CHANNEL) != null) return
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL, "Статус VPN", NotificationManager.IMPORTANCE_LOW).apply {
        description = "Показывает, что Sali VPN включён, к какому серверу и сколько времени"
        setShowBadge(false)
      },
    )
  }
}
