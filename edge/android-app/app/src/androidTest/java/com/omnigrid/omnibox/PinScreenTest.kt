package com.omnigrid.omnibox

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import org.junit.Rule
import org.junit.Test

class PinScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun pinScreen_displaysTitle() {
        composeTestRule.setContent {
            PinScreen(
                onPinVerified = {},
                onLocked = {},
            )
        }
        composeTestRule.onNodeWithText("PIN de Recuperação").assertExists()
    }

    @Test
    fun pinScreen_displaysInstruction() {
        composeTestRule.setContent {
            PinScreen(
                onPinVerified = {},
                onLocked = {},
            )
        }
        composeTestRule.onNodeWithText("Insira o PIN para sair do modo quiosque").assertExists()
    }

    @Test
    fun pinScreen_displaysBackButton() {
        composeTestRule.setContent {
            PinScreen(
                onPinVerified = {},
                onLocked = {},
            )
        }
        composeTestRule.onNodeWithText("Voltar ao quiosque").assertExists()
    }
}
