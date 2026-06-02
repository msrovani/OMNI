package com.omnigrid.omnibox

import android.content.Intent
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

class KioskActivity : ComponentActivity() {
    private lateinit var dpController: DevicePolicyController

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        window.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)

        dpController = DevicePolicyController(this)

        if (dpController.isDeviceOwner) {
            dpController.setKioskPackages(packageName)
            dpController.setKeyguardDisabled(true)
            dpController.setStatusBarDisabled(true)
            dpController.startLockTask(this)
        }

        val native = (application as OmniBoxApplication).nativeBridge
        val viewModel = OmniBoxViewModel(application, native, (application as OmniBoxApplication).connectionManager)
        viewModel.init()
        viewModel.startTelemetry()

        setContent {
            val state by viewModel.uiState.collectAsState()

            MaterialTheme(colorScheme = darkColorScheme()) {
                KioskScreen(
                    soc = state.soc,
                    mode = state.mode,
                    transport = state.transport,
                    onRecoveryClick = {
                        dpController.stopLockTask(this@KioskActivity)
                        val intent = Intent(this@KioskActivity, PinActivity::class.java)
                        startActivity(intent)
                    },
                )
            }
        }
    }

    override fun onBackPressed() {
        // Block back button in kiosk mode
    }
}

@Composable
fun KioskScreen(
    soc: Float,
    mode: DeviceMode,
    transport: Transport,
    onRecoveryClick: () -> Unit,
) {
    val modeColor = when (mode) {
        DeviceMode.Normal -> Color(0xFF34A853)
        DeviceMode.ShadowAutonomous -> Color(0xFFFBBC04)
        DeviceMode.EmergencyStop -> Color(0xFFEA4335)
        DeviceMode.Commissioning -> Color(0xFF1A73E8)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0A0E1A))
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("⚡ OMNI-BOX", fontSize = 32.sp, fontWeight = FontWeight.Bold, color = Color(0xFF1A73E8))
        Text("Sistema de Controle Embarcado", fontSize = 14.sp, color = Color.Gray)
        Spacer(Modifier.height(32.dp))

        Card(
            modifier = Modifier.fillMaxWidth().height(140.dp),
            colors = CardDefaults.cardColors(
                containerColor = modeColor.copy(alpha = 0.15f)
            ),
        ) {
            Column(
                modifier = Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text("${"%.1f".format(soc)}%", fontSize = 56.sp,
                     fontWeight = FontWeight.Bold, color = modeColor)
                Text(mode.displayName, color = Color.Gray, fontSize = 16.sp)
            }
        }
        Spacer(Modifier.height(16.dp))

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF1A1A2E)),
        ) {
            Row(
                modifier = Modifier.padding(16.dp).fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text("Transporte", color = Color.Gray)
                Text(transport.displayName, color = Color(0xFF1A73E8), fontWeight = FontWeight.Bold)
            }
        }
        Spacer(Modifier.height(16.dp))

        Button(
            onClick = onRecoveryClick,
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFFEA4335).copy(alpha = 0.2f)
            ),
            modifier = Modifier.fillMaxWidth().height(48.dp),
        ) {
            Text("Recuperação (PIN)", color = Color(0xFFEA4335))
        }
    }
}
