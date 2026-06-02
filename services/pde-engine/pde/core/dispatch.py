import hashlib
import hmac
import json
from typing import List
from datetime import datetime
from pde.core.optimizer import DispatchAction


class DispatchOrchestrator:
    def __init__(self, signing_key: bytes = b"omni-grid-key"):
        self.signing_key = signing_key

    def sign_command(self, action: DispatchAction) -> bytes:
        payload = json.dumps({
            "asset_id": action.asset_id,
            "power_kw": action.power_kw,
            "duration_seconds": action.duration_seconds,
            "reason": action.reason,
            "timestamp": datetime.utcnow().isoformat(),
        }, sort_keys=True)
        return hmac.new(
            self.signing_key, payload.encode(), hashlib.sha256
        ).hexdigest().encode()

    def verify_command(self, action: DispatchAction, signature: bytes) -> bool:
        expected = self.sign_command(action)
        return hmac.compare_digest(expected, signature)

    def execute_plan(self, actions: List[DispatchAction]) -> bool:
        for action in actions:
            signature = self.sign_command(action)
            print(f"[DISPATCH] {action.asset_id}: {action.power_kw}kW "
                  f"for {action.duration_seconds}s | sig={signature[:16].hex()}")
        return True
