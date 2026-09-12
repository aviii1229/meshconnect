package com.meshroute.app.mesh.ble

import java.util.UUID

object BleConstants {
    /** MeshRoute primary 128-bit BLE service UUID */
    val SERVICE_UUID: UUID = UUID.fromString("0000FE01-0000-1000-8000-00805F9B34FB")

    /** Characteristic for receiving incoming mesh packets via GATT WRITE */
    val CHAR_PACKET_WRITE_UUID: UUID = UUID.fromString("0000FE02-0000-1000-8000-00805F9B34FB")

    /** Characteristic for node ID identification */
    val CHAR_NODE_INFO_UUID: UUID = UUID.fromString("0000FE03-0000-1000-8000-00805F9B34FB")

    /** Standard Client Characteristic Configuration Descriptor (CCCD) */
    val CCCD_UUID: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")

    const val DEFAULT_SCAN_PERIOD_MS = 10000L
    const val DEFAULT_PEER_LINGER_MS = 30000L
    const val MAX_MTU = 512

    /** Timing & stabilization per §4.3 & §7.1 */
    const val LINK_STABILIZATION_DELAY_MS = 150L
    const val MTU_WATCHDOG_TIMEOUT_MS = 350L

    /** Fragmentation framing per §3.3 */
    val CHUNK_HEADER_MAGIC: Byte = 0xBE.toByte()
    const val ATT_HEADER_BYTES = 3
    const val CHUNK_HEADER_BYTES = 4
}

