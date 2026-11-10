package app.sali.vpn

import android.app.Activity
import android.content.Intent
import android.net.VpnService
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.wireguard.config.Config
import java.io.ByteArrayInputStream
import java.nio.charset.StandardCharsets
import android.provider.Settings
import java.security.MessageDigest

class SaliVpnModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context), ActivityEventListener {

  companion object {
    private const val PREPARE_REQUEST = 7351
  }

  private var preparePromise: Promise? = null
  private var status = "disconnected"

  init {
    context.addActivityEventListener(this)
    // The tunnel lives in SaliTunnel (process-wide); this module only mirrors it to JS.
    SaliTunnel.listener = { next -> status = next; emitStatus(next) }
  }

  override fun getName(): String = "SaliVpn"

  @ReactMethod
  fun prepare(promise: Promise) {
    val intent = VpnService.prepare(context)
    if (intent == null) {
      promise.resolve(true)
      return
    }
    val activity = currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "Не удалось открыть системное разрешение VPN")
      return
    }
    preparePromise = promise
    activity.startActivityForResult(intent, PREPARE_REQUEST)
  }

  /** label: what the notification shows, e.g. «Германия · Франкфурт»; serverId: for the UI after a restart. */
  @ReactMethod
  fun connect(configText: String, label: String?, serverId: String?, promise: Promise) {
    try {
      status = "connecting"
      emitStatus(status)
      val config = Config.parse(
        ByteArrayInputStream(configText.toByteArray(StandardCharsets.UTF_8)),
      )
      SaliTunnel.up(context, config, label ?: "", serverId ?: "")
      status = "connected"
      emitStatus(status)
      promise.resolve(null)
    } catch (error: Throwable) {
      status = if (SaliTunnel.isUp(context)) "connected" else "error"
      emitStatus(status)
      promise.reject("VPN_CONNECT_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun disconnect(promise: Promise) {
    try {
      status = "disconnecting"
      emitStatus(status)
      SaliTunnel.down(context)
      status = "disconnected"
      emitStatus(status)
      promise.resolve(null)
    } catch (error: Throwable) {
      status = "error"
      emitStatus(status)
      promise.reject("VPN_DISCONNECT_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun getStatus(promise: Promise) {
    status = if (SaliTunnel.isUp(context)) "connected" else "disconnected"
    promise.resolve(status)
  }

  /** Current session for the UI after the app is reopened: status, start time, server. */
  @ReactMethod
  fun getSession(promise: Promise) {
    val up = SaliTunnel.isUp(context)
    promise.resolve(Arguments.createMap().apply {
      putString("status", if (up) "connected" else "disconnected")
      putDouble("connectedAt", if (up) SaliTunnel.connectedAt.toDouble() else 0.0)
      putString("serverId", if (up) SaliTunnel.serverId else "")
      putString("label", if (up) SaliTunnel.serverLabel else "")
    })
  }

  /** Stable across app reinstalls; opaque hash avoids exposing ANDROID_ID. */
  @ReactMethod
  fun getDeviceKey(promise: Promise) {
    try {
      val androidId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
      val source = "app.sali.vpn:$androidId"
      val digest = MessageDigest.getInstance("SHA-256").digest(source.toByteArray(StandardCharsets.UTF_8))
      promise.resolve(digest.joinToString("") { "%02x".format(it) })
    } catch (error: Throwable) {
      promise.reject("DEVICE_ID_FAILED", "Не удалось определить устройство", error)
    }
  }

  @ReactMethod fun addListener(eventName: String) = Unit
  @ReactMethod fun removeListeners(count: Int) = Unit

  private fun emitStatus(next: String) {
    if (!context.hasActiveReactInstance()) return
    context
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("vpnStatusChanged", next)
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != PREPARE_REQUEST) return
    val promise = preparePromise ?: return
    preparePromise = null
    if (resultCode == Activity.RESULT_OK) promise.resolve(true)
    else promise.reject("VPN_PERMISSION_DENIED", "Пользователь не разрешил VPN-подключение")
  }

  override fun onNewIntent(intent: Intent) = Unit
}
