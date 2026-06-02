package com.omnigrid.omnibox

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.dp
import org.junit.Rule
import org.junit.Test

@Composable
fun OmniBoxHMI(
    state: OmniBoxUiState,
    onDispatch: () -> Unit,
    onRefresh: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
    ) {
        Text(text = "${"%.1f".format(state.soc)}%")
        Text(text = "${"%.1f".format(state.soh)}%")
        Text(text = state.mode.displayName)
        Text(text = state.transport.displayName)
        Text(text = if (state.isOnline) "Online" else "Offline")
        Text(text = "${state.dispatchCount}")
        Text(text = "${state.uptimeSeconds}")
    }
}

class OmniBoxHMITest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun fullHMI_displaysSocAndMode() {
        composeTestRule.setContent {
            OmniBoxHMI(
                state = OmniBoxUiState(
                    soc = 75.5f,
                    soh = 96.0f,
                    mode = DeviceMode.Normal,
                    transport = Transport.UsbCdc,
                    gridConnected = true,
                    uptimeSeconds = 12345,
                    dispatchCount = 42,
                    errorCount = 0,
                    isOnline = true,
                ),
                onDispatch = {},
                onRefresh = {},
            )
        }
        composeTestRule.onNodeWithText("75.5%").assertExists()
        composeTestRule.onNodeWithText("Normal").assertExists()
    }

    @Test
    fun fullHMI_showsSoh() {
        composeTestRule.setContent {
            OmniBoxHMI(
                state = OmniBoxUiState(soh = 96.0f),
                onDispatch = {},
                onRefresh = {},
            )
        }
        composeTestRule.onNodeWithText("96.0%").assertExists()
    }

    @Test
    fun fullHMI_showsTransport() {
        composeTestRule.setContent {
            OmniBoxHMI(
                state = OmniBoxUiState(transport = Transport.Ble),
                onDispatch = {},
                onRefresh = {},
            )
        }
        composeTestRule.onNodeWithText("Ble").assertExists()
    }

    @Test
    fun fullHMI_showsOnlineStatus() {
        composeTestRule.setContent {
            OmniBoxHMI(
                state = OmniBoxUiState(isOnline = true),
                onDispatch = {},
                onRefresh = {},
            )
        }
        composeTestRule.onNodeWithText("Online").assertExists()
    }

    @Test
    fun fullHMI_showsOfflineStatus() {
        composeTestRule.setContent {
            OmniBoxHMI(
                state = OmniBoxUiState(isOnline = false),
                onDispatch = {},
                onRefresh = {},
            )
        }
        composeTestRule.onNodeWithText("Offline").assertExists()
    }

    @Test
    fun fullHMI_showsDispatchCount() {
        composeTestRule.setContent {
            OmniBoxHMI(
                state = OmniBoxUiState(dispatchCount = 42),
                onDispatch = {},
                onRefresh = {},
            )
        }
        composeTestRule.onNodeWithText("42").assertExists()
    }

    @Test
    fun fullHMI_showsUptime() {
        composeTestRule.setContent {
            OmniBoxHMI(
                state = OmniBoxUiState(uptimeSeconds = 3600),
                onDispatch = {},
                onRefresh = {},
            )
        }
        composeTestRule.onNodeWithText("3600").assertExists()
    }
}
