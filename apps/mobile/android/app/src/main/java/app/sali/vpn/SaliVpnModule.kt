package app.sali.vpn

import android.app.Activity
import android.content.Intent
import android.net.VpnService
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.wireguard.android.backend.GoBackend
import com.wireguard.android.backend.Tunnel
import com.wireguard.config.Config
import java.io.ByteArrayInputStream
import java.nio.charset.StandardCharsets

class SaliVpnModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context), ActivityEventListener {

  companion object {
    private const val PREPARE_REQUEST = 7351
  }

  private val backend by lazy { GoBackend(context) }
  private var preparePromise: Promise? = null
  private var status = "disconnected"

  private val tunnel = object : Tunnel {
    override fun getName(): String = "Sali"

    override fun onStateChange(newState: Tunnel.State) {
      status = if (newState == Tunnel.State.UP) "connected" else "disconnected"
      emitStatus(status)
    }
  }

  init {
    context.addActivityEventListener(this)
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

  @ReactMethod
  fun connect(configText: String, promise: Promise) {
    try {
      status = "connecting"
      emitStatus(status)
      val config = Config.parse(
        ByteArrayInputStream(configText.toByteArray(StandardCharsets.UTF_8)),
      )
      backend.setState(tunnel, Tunnel.State.UP, config)
      status = "connected"
      emitStatus(status)
      promise.resolve(null)
    } catch (error: Throwable) {
      status = "error"
      emitStatus(status)
      promise.reject("VPN_CONNECT_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun disconnect(promise: Promise) {
    try {
      status = "disconnecting"
      emitStatus(status)
      backend.setState(tunnel, Tunnel.State.DOWN, null)
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
    try {
      status = if (backend.getState(tunnel) == Tunnel.State.UP) "connected" else "disconnected"
      promise.resolve(status)
    } catch (_: Throwable) {
      promise.resolve(status)
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
