package com.meshroute.app

import android.content.Context
import android.os.Build
import com.meshroute.app.data.database.AppDatabase
import com.meshroute.app.data.queue.ForwardStore
import com.meshroute.app.gateway.AndroidNetworkMonitor
import com.meshroute.app.gateway.GatewayUploader
import com.meshroute.app.gateway.NetworkMonitor
import com.meshroute.app.location.AndroidGpsLocationProvider
import com.meshroute.app.location.LocationProvider
import com.meshroute.app.mesh.ble.BleMeshTransport
import com.meshroute.app.mesh.router.DeliveryMetricsCollector
import com.meshroute.app.mesh.router.EpidemicFloodingStrategy
import com.meshroute.app.mesh.router.IntelligentEdsRoutingStrategy
import com.meshroute.app.mesh.router.MeshRouter
import com.meshroute.app.mesh.router.SeenSet
import java.util.UUID

/**
 * Centralized singleton container conforming to TECHNICAL_SPECIFICATIONS.md §7.1:
 * "Ensure a single singleton transport instance per process. Guard service against creating duplicate radio stacks."
 *
 * Prevents GATT Server collisions between MainActivity and MeshForegroundService.
 */
class MeshRouteManager private constructor(context: Context) {

    val selfNodeId: String = getOrCreateSelfNodeId(context)
    val database: AppDatabase = AppDatabase.getInstance(context)
    val forwardStore: ForwardStore = ForwardStore(database.packetDao())
    val seenSet: SeenSet = SeenSet(database.seenMessageDao())
    val transport: BleMeshTransport = BleMeshTransport(context.applicationContext, selfNodeId)
    val metricsCollector: DeliveryMetricsCollector = DeliveryMetricsCollector()
    val router: MeshRouter = MeshRouter(
        selfNodeId = selfNodeId,
        transport = transport,
        forwardStore = forwardStore,
        seenSet = seenSet,
        routingStrategy = EpidemicFloodingStrategy(),
        metricsCollector = metricsCollector
    )
    val locationProvider: LocationProvider = AndroidGpsLocationProvider(context.applicationContext)
    val networkMonitor: NetworkMonitor = AndroidNetworkMonitor(context.applicationContext)
    val gatewayUploader: GatewayUploader = GatewayUploader(
        forwardStore = forwardStore,
        networkMonitor = networkMonitor,
        initialBackendUrl = context.getSharedPreferences("meshroute_prefs", Context.MODE_PRIVATE)
            .getString("custom_backend_url", GatewayUploader.DEFAULT_BACKEND_URL) ?: GatewayUploader.DEFAULT_BACKEND_URL
    )

    companion object {
        @Volatile
        private var INSTANCE: MeshRouteManager? = null

        fun getInstance(context: Context): MeshRouteManager {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: MeshRouteManager(context.applicationContext).also { INSTANCE = it }
            }
        }

        private fun getOrCreateSelfNodeId(context: Context): String {
            val prefs = context.getSharedPreferences("meshroute_prefs", Context.MODE_PRIVATE)
            var nodeId = prefs.getString("self_node_id", null)
            if (nodeId.isNullOrBlank()) {
                nodeId = "MR-" + UUID.randomUUID().toString().take(6).uppercase()
                prefs.edit().putString("self_node_id", nodeId).apply()
            }
            return nodeId
        }
    }
}
