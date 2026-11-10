package app.sali.vpn

import android.content.Context
import com.wireguard.android.backend.GoBackend
import com.wireguard.android.backend.Tunnel
import com.wireguard.config.Config

/**
 * The one VPN tunnel of the app. Lives for the whole process — not inside a React screen — so
 * closing the app's screens or reopening it never loses the tunnel or its state.
 * The foreground service (SaliVpnForegroundService) keeps the process alive while it is up and
 * shows the ongoing notification with the uptime and the server.
 */
object SaliTunnel {
  @Volatile private var backend: GoBackend? = null

  /** Status listener of the React module (null while the JS side is not running). */
  @Volatile var listener: ((String) -> Unit)? = null

  /** When the current session started (ms), 0 when down. Kept across server switches. */
  @Volatile var connectedAt: Long = 0L
    private set
  @Volatile var serverLabel: String = ""
    private set
  @Volatile var serverId: String = ""
    private set

  private val tunnel = object : Tunnel {
    override fun getName(): String = "Sali"

    override fun onStateChange(newState: Tunnel.State) {
      if (newState != Tunnel.State.UP) connectedAt = 0L
      listener?.invoke(if (newState == Tunnel.State.UP) "connected" else "disconnected")
    }
  }

  fun backend(context: Context): GoBackend =
    backend ?: synchronized(this) { backend ?: GoBackend(context.applicationContext).also { backend = it } }

  fun isUp(context: Context): Boolean =
    try { backend(context).getState(tunnel) == Tunnel.State.UP } catch (_: Throwable) { false }

  /** Brings the tunnel up, or swaps the config of a running one (server switch). */
  fun up(context: Context, config: Config, label: String, id: String) {
    // A server switch takes the old tunnel down and the new one up (GoBackend reports DOWN in
    // between); the session timer keeps running across it.
    val started = if (isUp(context)) connectedAt else 0L
    backend(context).setState(tunnel, Tunnel.State.UP, config)
    connectedAt = if (started > 0L) started else System.currentTimeMillis()
    serverLabel = label
    serverId = id
    // Never let the notification break the VPN itself (e.g. a background-start restriction).
    try { SaliVpnForegroundService.show(context) } catch (_: Throwable) { }
  }

  fun down(context: Context) {
    try { backend(context).setState(tunnel, Tunnel.State.DOWN, null) } finally {
      connectedAt = 0L
      try { SaliVpnForegroundService.hide(context) } catch (_: Throwable) { }
    }
  }
}
