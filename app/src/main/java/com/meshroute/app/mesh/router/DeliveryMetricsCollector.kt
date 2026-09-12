package com.meshroute.app.mesh.router

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.concurrent.atomic.AtomicInteger

/**
 * Data snapshot of real-time transmission and power savings telemetry.
 */
data class DeliveryMetrics(
    val totalEvaluatedPackets: Int = 0,
    val floodedOpportunitiesCount: Int = 0,
    val actualTransmittedCount: Int = 0,
    val suppressedTransmissionsCount: Int = 0,
    val savingsPercent: Double = 0.0,
    val estimatedRfEnergySavedJoules: Double = 0.0
)

/**
 * Real-time power and transmission savings telemetry collector conforming to
 * TECHNICAL_SPECIFICATIONS.md §2 and §5.2.
 */
class DeliveryMetricsCollector {

    private val _metrics = MutableStateFlow(DeliveryMetrics())
    val metrics: StateFlow<DeliveryMetrics> = _metrics.asStateFlow()

    private val evaluatedPackets = AtomicInteger(0)
    private val floodedOpportunities = AtomicInteger(0)
    private val actualTransmitted = AtomicInteger(0)
    private val suppressedTransmissions = AtomicInteger(0)

    companion object {
        // Estimated energy consumed per BLE connection handshake & GATT write transaction (~15 mJ = 0.015 J)
        private const val JOULES_PER_BLE_TRANSMISSION = 0.015
    }

    /**
     * Records the evaluation of a routing decision.
     * @param candidateCount The number of eligible visible peers that would be flooded.
     * @param selectedCount The number of peers actually selected by the active strategy.
     */
    fun recordDecision(candidateCount: Int, selectedCount: Int) {
        val totalEvals = evaluatedPackets.incrementAndGet()
        val totalFlooded = floodedOpportunities.addAndGet(candidateCount)
        val totalActual = actualTransmitted.addAndGet(selectedCount)
        val suppressed = (candidateCount - selectedCount).coerceAtLeast(0)
        val totalSuppressed = suppressedTransmissions.addAndGet(suppressed)

        val savings = if (totalFlooded > 0) {
            (totalSuppressed.toDouble() / totalFlooded.toDouble() * 100.0).coerceIn(0.0, 100.0)
        } else {
            0.0
        }

        val energySaved = totalSuppressed * JOULES_PER_BLE_TRANSMISSION

        _metrics.value = DeliveryMetrics(
            totalEvaluatedPackets = totalEvals,
            floodedOpportunitiesCount = totalFlooded,
            actualTransmittedCount = totalActual,
            suppressedTransmissionsCount = totalSuppressed,
            savingsPercent = savings,
            estimatedRfEnergySavedJoules = energySaved
        )
    }

    fun reset() {
        evaluatedPackets.set(0)
        floodedOpportunities.set(0)
        actualTransmitted.set(0)
        suppressedTransmissions.set(0)
        _metrics.value = DeliveryMetrics()
    }
}
