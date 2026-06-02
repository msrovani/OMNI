package com.omnigrid.omnibox

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import org.junit.Rule
import org.junit.Test

class KioskScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun kioskScreen_displaysTitle() {
        composeTestRule.setContent {
            KioskScreen(
                soc = 50f,
                mode = DeviceMode.Normal,
                transport = Transport.UsbCdc,
                onRecoveryClick = {},
            )
        }
        composeTestRule.onNodeWithText("OMNI-BOX").assertExists()
    }

    @Test
    fun kioskScreen_displaysSubtitle() {
        composeTestRule.setContent {
            KioskScreen(
                soc = 50f,
                mode = DeviceMode.Normal,
                transport = Transport.UsbCdc,
                onRecoveryClick = {},
            )
        }
        composeTestRule.onNodeWithText("Sistema de Controle Embarcado").assertExists()
    }

    @Test
    fun kioskScreen_showsSoC() {
        composeTestRule.setContent {
            KioskScreen(
                soc = 73.2f,
                mode = DeviceMode.Normal,
                transport = Transport.UsbCdc,
                onRecoveryClick = {},
            )
        }
        composeTestRule.onNodeWithText("73.2%").assertExists()
    }

    @Test
    fun kioskScreen_showsDeviceMode() {
        composeTestRule.setContent {
            KioskScreen(
                soc = 50f,
                mode = DeviceMode.ShadowAutonomous,
                transport = Transport.UsbCdc,
                onRecoveryClick = {},
            )
        }
        composeTestRule.onNodeWithText("Sombra").assertExists()
    }

    @Test
    fun kioskScreen_showsTransport() {
        composeTestRule.setContent {
            KioskScreen(
                soc = 50f,
                mode = DeviceMode.Normal,
                transport = Transport.Ble,
                onRecoveryClick = {},
            )
        }
        composeTestRule.onNodeWithText("Ble").assertExists()
    }

    @Test
    fun kioskScreen_showsRecoveryButton() {
        composeTestRule.setContent {
            KioskScreen(
                soc = 50f,
                mode = DeviceMode.Normal,
                transport = Transport.UsbCdc,
                onRecoveryClick = {},
            )
        }
        composeTestRule.onNodeWithText("Recuperação (PIN)").assertExists()
    }

    @Test
    fun kioskScreen_showsTransportLabel() {
        composeTestRule.setContent {
            KioskScreen(
                soc = 50f,
                mode = DeviceMode.Normal,
                transport = Transport.UsbCdc,
                onRecoveryClick = {},
            )
        }
        composeTestRule.onNodeWithText("Transporte").assertExists()
    }
}
