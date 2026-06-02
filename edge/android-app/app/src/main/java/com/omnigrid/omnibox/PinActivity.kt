package com.omnigrid.omnibox

import android.content.Intent
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.security.MessageDigest

class PinActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        setContent {
            MaterialTheme(colorScheme = darkColorScheme()) {
                PinScreen(
                    onPinVerified = {
                        val home = Intent(this, MainActivity::class.java)
                        startActivity(home)
                        finish()
                    },
                    onLocked = {
                        val kiosk = Intent(this, KioskActivity::class.java)
                        startActivity(kiosk)
                        finish()
                    }
                )
            }
        }
    }

    companion object {
        // SHA-256 hash of the master PIN "2026"
        // Verified at: 158a323a7ba44870f23d96f1516dd70aa48e9a72db4ebb026b0a89e212a208ab
        // In production, fetch this hash from the MDM/cloud endpoint at provisioning time
        private const val MASTER_PIN_HASH = "158a323a7ba44870f23d96f1516dd70aa48e9a72db4ebb026b0a89e212a208ab"

        private fun sha256(input: String): String {
            val digest = MessageDigest.getInstance("SHA-256")
            val bytes = digest.digest(input.toByteArray())
            return bytes.joinToString("") { "%02x".format(it) }
        }

        fun verifyPin(input: String): Boolean {
            return sha256(input) == MASTER_PIN_HASH
        }
    }
}

@Composable
fun PinScreen(onPinVerified: () -> Unit, onLocked: () -> Unit) {
    var input by remember { mutableStateOf("") }
    var error by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0A0E1A))
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("PIN de Recuperação", fontSize = 24.sp,
             fontWeight = FontWeight.Bold, color = Color.White)
        Spacer(Modifier.height(8.dp))
        Text("Insira o PIN para sair do modo quiosque",
             fontSize = 14.sp, color = Color.Gray)
        Spacer(Modifier.height(24.dp))

        OutlinedTextField(
            value = input,
            onValueChange = {
                input = it
                error = false
                if (it.length >= 4) {
                    if (PinActivity.verifyPin(it)) {
                        onPinVerified()
                    } else {
                        error = true
                    }
                }
            },
            label = { Text("PIN") },
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
            isError = error,
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Color(0xFF1A73E8),
                unfocusedBorderColor = Color.Gray,
                cursorColor = Color.White,
                focusedLabelColor = Color(0xFF1A73E8),
            ),
        )
        if (error) {
            Text("PIN incorreto", color = Color(0xFFEA4335), fontSize = 14.sp)
        }
        Spacer(Modifier.height(24.dp))

        Button(
            onClick = onLocked,
            colors = ButtonDefaults.buttonColors(containerColor = Color.Gray.copy(alpha = 0.3f)),
        ) {
            Text("Voltar ao quiosque", color = Color.Gray)
        }
    }
}
