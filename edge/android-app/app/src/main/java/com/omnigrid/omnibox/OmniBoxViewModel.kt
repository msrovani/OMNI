package com.omnigrid.omnibox

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

data class OmniBoxUiState(
    val soc: Float = 50f,
    val soh: Float = 100f,
    val mode: DeviceMode = DeviceMode.Commissioning,
    val transport: Transport = Transport.None,
    val temperature: Float = 25f,
    val gridConnected: Boolean = true,
    val uptimeSeconds: Long = 0,
    val dispatchCount: Int = 0,
    val errorCount: Int = 0,
    val isOnline: Boolean = false,
)

class OmniBoxViewModel(
    application: Application,
    private val native: OmniBoxNative? = null,
    private val connManager: ConnectionManager? = null,
) : AndroidViewModel(application) {

    private val _uiState = MutableStateFlow(OmniBoxUiState())
    val uiState: StateFlow<OmniBoxUiState> = _uiState.asStateFlow()

    private var telemetryJob: Job? = null
    private var isInitialised = false

    private val appNative: OmniBoxNative
        get() = native ?: (getApplication<OmniBoxApplication>().nativeBridge)

    private val appConnManager: ConnectionManager
        get() = connManager ?: (getApplication<OmniBoxApplication>().connectionManager)

    fun init() {
        if (isInitialised) return
        isInitialised = true
        appNative.init()
        appConnManager.init(appNative)
        updateStateFromNative()
    }

    fun startTelemetry(intervalMs: Long = 5000) {
        telemetryJob?.cancel()
        telemetryJob = viewModelScope.launch {
            while (isActive) {
                appNative.tick(intervalMs / 1000f)
                updateStateFromNative()
                delay(intervalMs)
            }
        }
    }

    fun stopTelemetry() {
        telemetryJob?.cancel()
        telemetryJob = null
    }

    fun applyDispatch(assetId: Int, powerKw: Float, durationS: Int, reason: Int) {
        viewModelScope.launch {
            appNative.applyDispatch(assetId, powerKw, durationS, reason)
            updateStateFromNative()
        }
    }

    fun setGridConnection(connected: Boolean) {
        appNative.setGridConnected(connected)
        _uiState.value = _uiState.value.copy(gridConnected = connected)
    }

    fun setSoC(soc: Float) {
        appNative.setSoC(soc)
        _uiState.value = _uiState.value.copy(soc = soc)
    }

    fun refreshNow() {
        updateStateFromNative()
    }

    private fun updateStateFromNative() {
        val n = appNative
        val transport = appConnManager.getActiveTransport()
        _uiState.value = OmniBoxUiState(
            soc = n.soc,
            soh = n.soh,
            mode = n.mode,
            transport = transport,
            temperature = 25f,
            gridConnected = n.gridConnected,
            uptimeSeconds = n.uptimeSeconds,
            dispatchCount = n.dispatchCount,
            errorCount = n.errorCount,
            isOnline = transport != Transport.None,
        )
    }

    override fun onCleared() {
        stopTelemetry()
        super.onCleared()
    }
}
