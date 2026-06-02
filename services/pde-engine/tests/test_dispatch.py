import pytest
from pde.core.dispatch import DispatchOrchestrator
from pde.core.optimizer import DispatchAction


def test_sign_and_verify():
    orchestrator = DispatchOrchestrator(signing_key=b"test-key")
    action = DispatchAction(
        asset_id="bat-001",
        power_kw=50.0,
        duration_seconds=3600,
        reason="arbitrage",
    )
    sig = orchestrator.sign_command(action)
    assert orchestrator.verify_command(action, sig)


def test_signature_differs_for_different_actions():
    orchestrator = DispatchOrchestrator(signing_key=b"test-key")
    a1 = DispatchAction("bat-001", 50.0, 3600, "arbitrage")
    a2 = DispatchAction("bat-001", 100.0, 3600, "arbitrage")
    s1 = orchestrator.sign_command(a1)
    s2 = orchestrator.sign_command(a2)
    assert s1 != s2
