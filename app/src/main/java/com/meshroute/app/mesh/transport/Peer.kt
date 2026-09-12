package com.meshroute.app.mesh.transport

enum class TransportType {
    BLE,
    WIFI_DIRECT,
    WIFI_AWARE,
    LOOPBACK
}

enum class MobilityState(val code: Int) {
    STATIONARY(0),
    WALKING(1),
    RUNNING(2),
    VEHICLE(3);

    companion object {
        fun fromCode(code: Int): MobilityState = entries.find { it.code == code } ?: STATIONARY
    }
}

data class Peer(
    val nodeId: String,
    val deviceName: String = "Unknown",
    val transportType: TransportType = TransportType.BLE,
    val rssi: Int = 0,
    val lastSeenTimestamp: Long = System.currentTimeMillis(),
    val batteryPercent: Int = 100,
    val isCharging: Boolean = false,
    val mobilityState: MobilityState = MobilityState.STATIONARY,
    val gatewayLikelihood: Int = 0,
    val queueLoad: Int = 0,
    val edsScore: Double = 0.0
)

