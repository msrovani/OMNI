package com.omnigrid.omnibox

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val native = (application as OmniBoxApplication).nativeBridge

        setContent {
            MaterialTheme(colorScheme = darkColorScheme()) {
                OmniBoxHMI(native)
            }
        }
    }
}

@Composable
fun OmniBoxHMI(native: OmniBoxNative) {
    var soc by remember { mutableFloatStateOf(native.soc) }
    var soh by remember { mutableFloatStateOf(native.soh) }
    var mode by remember { mutableStateOf(native.mode) }
    var uptime by remember { mutableLongStateOf(native.uptimeSeconds) }
    var dispatchCount by remember { mutableIntStateOf(native.dispatchCount) }
    var gridConnected by remember { mutableStateOf(native.gridConnected) }

    // Auto-refresh
    LaunchedEffect(Unit) {
        while (true) {
            native.tick(1.0f)
            soc = native.soc
            soh = native.soh
            mode = native.mode
            uptime = native.uptimeSeconds
            dispatchCount = native.dispatchCount
            gridConnected = native.gridConnected
            delay(1000)
        }
    }

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
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Header
        Text("OMNI-BOX", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = Color(0xFF1A73E8))
        Text("Controlador Embarcado v1.0", fontSize = 12.sp, color = Color.Gray)
        Spacer(Modifier.height(24.dp))

        // Mode indicator
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = modeColor.copy(alpha = 0.2f)),
        ) {
            Row(
                modifier = Modifier.padding(16.dp).fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text("Status", color = Color.Gray, fontSize = 14.sp)
                Text(
                    mode.displayName,
                    color = modeColor,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                )
            }
        }
        Spacer(Modifier.height(16.dp))

        // Gauge row: SoC and SoH
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
            GaugeCard("SoC", "${"%.1f".format(soc)}%", Color(0xFF34A853))
            GaugeCard("SoH", "${"%.1f".format(soh)}%", Color(0xFF1A73E8))
        }
        Spacer(Modifier.height(16.dp))

        // Grid status
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(
                containerColor = if (gridConnected) Color(0xFF34A853).copy(alpha = 0.15f)
                else Color(0xFFEA4335).copy(alpha = 0.15f)
            ),
        ) {
            Row(
                modifier = Modifier.padding(16.dp).fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text("Rede Elétrica", color = Color.Gray)
                Text(
                    if (gridConnected) "Conectada" else "DESCONECTADA",
                    color = if (gridConnected) Color(0xFF34A853) else Color(0xFFEA4335),
                    fontWeight = FontWeight.Bold,
                )
            }
        }
        Spacer(Modifier.height(16.dp))

        // Stats
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF1A1A2E)),
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                StatRow("Uptime", formatUptime(uptime))
                StatRow("Dispatches", "$dispatchCount")
            }
        }
        Spacer(Modifier.height(24.dp))

        // Footer
        Text("🔌 mTLS • Modbus RTU • CAN Bus • BLE", fontSize = 11.sp, color = Color.Gray)
        Text("Conecte o cabo USB ao inversor", fontSize = 11.sp, color = Color.Gray)
    }
}

@Composable
fun GaugeCard(label: String, value: String, color: Color) {
    Card(
        modifier = Modifier.width(140.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1A1A2E)),
    ) {
        Column(
            modifier = Modifier.padding(16.dp).fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(label, color = Color.Gray, fontSize = 14.sp)
            Spacer(Modifier.height(8.dp))
            Text(value, color = color, fontWeight = FontWeight.Bold, fontSize = 32.sp)
        }
    }
}

@Composable
fun StatRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, color = Color.Gray, fontSize = 14.sp)
        Text(value, color = Color.White, fontSize = 14.sp)
    }
}

private fun formatUptime(seconds: Long): String {
    val h = seconds / 3600
    val m = (seconds % 3600) / 60
    val s = seconds % 60
    return "${h}h ${m}m ${s}s"
}
