package com.meshroute.app.mesh.router

import android.util.Log
import com.meshroute.app.mesh.transport.MobilityState
import com.meshroute.app.mesh.transport.Peer
import com.meshroute.app.mesh.transport.SosPacket

/**
 * Pluggable routing strategy interface conforming to TECHNICAL_SPECIFICATIONS.md §5.2.
 */
interface RoutingStrategy {
    val name: String

    /**
     * Evaluates candidate visible peers and returns the list of peers
     * that should receive the forwarded packet.
     */
    fun evaluateTargets(
        packet: SosPacket,
        candidates: Set<Peer>,
        selfNodeId: String
    ): RoutingDecision
}

data class RoutingDecision(
    val selectedTargets: List<Peer>,
    val candidateCount: Int,
    val evaluatedScores: Map<String, Double> = emptyMap(),
    val fallbackEngaged: Boolean = false
)

/**
 * Strategy A: Epidemic Flooding (Baseline & Default Standard)
 * - Forwards inbound packets to 100% of visible neighbors (excluding nodes already recorded in hop_path or self).
 * - Guarantees maximum reachability in sparse wilderness environments.
 */
class EpidemicFloodingStrategy : RoutingStrategy {
    override val name: String = "Epidemic Flooding"

    override fun evaluateTargets(
        packet: SosPacket,
        candidates: Set<Peer>,
        selfNodeId: String
    ): RoutingDecision {
        val eligible = candidates.filter { peer ->
            peer.nodeId != selfNodeId && !packet.hopPath.contains(peer.nodeId)
        }
        return RoutingDecision(
            selectedTargets = eligible,
            candidateCount = eligible.size
        )
    }
}

/**
 * Strategy B: Intelligent Emergency Routing (IER) via Emergency Delivery Score (EDS)
 *
 * Computes multi-factor utility score (0..100) for each candidate neighbor:
 * EDS = w_b * S_batt + w_l * S_link + w_m * S_mob + w_g * S_gw + w_d * S_dens + w_u * S_urg
 *
 * Anti-Starvation Fallback Guarantee: If all reachable neighbors score below the adaptive threshold
 * (e.g., stationary phones testing indoors), the strategy must automatically fall back to forwarding
 * to the highest-scoring candidate rather than dropping the emergency transmission.
 */
class IntelligentEdsRoutingStrategy(
    val threshold: Double = 45.0,
    val weightBattery: Double = 0.20,
    val weightLink: Double = 0.20,
    val weightMobility: Double = 0.15,
    val weightGateway: Double = 0.25,
    val weightDensity: Double = 0.10,
    val weightUrgency: Double = 0.10
) : RoutingStrategy {

    companion object {
        private const val TAG = "IntelligentEdsRouting"
    }

    override val name: String = "Intelligent EDS"

    override fun evaluateTargets(
        packet: SosPacket,
        candidates: Set<Peer>,
        selfNodeId: String
    ): RoutingDecision {
        val eligible = candidates.filter { peer ->
            peer.nodeId != selfNodeId && !packet.hopPath.contains(peer.nodeId)
        }

        if (eligible.isEmpty()) {
            return RoutingDecision(emptyList(), candidateCount = 0)
        }

        val scores = mutableMapOf<String, Double>()
        for (peer in eligible) {
            val score = calculateEds(peer, packet)
            scores[peer.nodeId] = score
        }

        // Filter peers that meet or exceed the threshold
        val selected = eligible.filter { (scores[it.nodeId] ?: 0.0) >= threshold }

        // Anti-Starvation Fallback Guarantee:
        // If candidate peers exist but none meet threshold, select the best candidate.
        if (selected.isEmpty()) {
            val bestPeer = eligible.maxByOrNull { scores[it.nodeId] ?: 0.0 }
            Log.w(
                TAG,
                "Anti-Starvation Fallback Engaged: All ${eligible.size} candidate(s) below threshold $threshold. Selecting highest-scoring candidate ${bestPeer?.nodeId} (EDS: ${scores[bestPeer?.nodeId]})"
            )
            return RoutingDecision(
                selectedTargets = if (bestPeer != null) listOf(bestPeer) else emptyList(),
                candidateCount = eligible.size,
                evaluatedScores = scores,
                fallbackEngaged = true
            )
        }

        return RoutingDecision(
            selectedTargets = selected,
            candidateCount = eligible.size,
            evaluatedScores = scores,
            fallbackEngaged = false
        )
    }

    /**
     * Multi-factor scoring function:
     * - S_batt: Battery percentage (0..100), bonus for charging
     * - S_link: RSSI mapping (-100 dBm -> 0, -50 dBm -> 100)
     * - S_mob: Mobility state (Stationary = 25, Walking = 50, Running = 75, Vehicle = 100)
     * - S_gw: Gateway likelihood percentage (0..100)
     * - S_dens: Local unsent packet queue load (lower queue load -> higher score)
     * - S_urg: Urgency (SOS priority -> 100, standard -> 50)
     */
    fun calculateEds(peer: Peer, packet: SosPacket): Double {
        // Battery factor (0..100)
        val rawBatt = peer.batteryPercent.coerceIn(0, 100)
        val sBatt = if (peer.isCharging) (rawBatt + 15).coerceAtMost(100) else rawBatt

        // Link factor from RSSI: -100 dBm is ~0%, -50 dBm is ~100%
        val sLink = ((peer.rssi + 100).toDouble() / 50.0 * 100.0).coerceIn(0.0, 100.0)

        // Mobility factor
        val sMob = when (peer.mobilityState) {
            MobilityState.VEHICLE -> 100.0
            MobilityState.RUNNING -> 75.0
            MobilityState.WALKING -> 50.0
            MobilityState.STATIONARY -> 25.0
        }

        // Gateway likelihood factor (0..100)
        val sGw = peer.gatewayLikelihood.coerceIn(0, 100).toDouble()

        // Queue density factor: 0 queue load = 100, 255 queue load = 0
        val sDens = ((255 - peer.queueLoad.coerceIn(0, 255)).toDouble() / 255.0 * 100.0)

        // Urgency factor
        val sUrg = if (packet.priority == SosPacket.PRIORITY_SOS) 100.0 else 50.0

        val total = (weightBattery * sBatt) +
                (weightLink * sLink) +
                (weightMobility * sMob) +
                (weightGateway * sGw) +
                (weightDensity * sDens) +
                (weightUrgency * sUrg)

        return total.coerceIn(0.0, 100.0)
    }
}
