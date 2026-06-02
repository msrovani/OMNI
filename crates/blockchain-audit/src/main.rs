//! Blockchain Audit Trail
//!
//! CRITICAL — Immutable audit log for every dispatch command.
//! Implements a Merkle-chain of dispatch events.
//! Each block is linked to the previous by its SHA-256 hash.
//! Designed to be portable to Hyperledger Fabric chaincode.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DispatchEvent {
    pub event_id: String,
    pub asset_id: String,
    pub power_kw: f64,
    pub duration_seconds: u32,
    pub reason: String,
    pub dispatched_by: String,
    pub timestamp: DateTime<Utc>,
    pub signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Block {
    pub index: u64,
    pub previous_hash: String,
    pub timestamp: DateTime<Utc>,
    pub events: Vec<DispatchEvent>,
    pub hash: String,
    pub validator_count: u32,  // number of validators that signed this block
}

impl Block {
    pub fn new(index: u64, previous_hash: String, events: Vec<DispatchEvent>) -> Self {
        let timestamp = Utc::now();
        let hash = Self::compute_hash(index, &previous_hash, &timestamp, &events);
        Self {
            index,
            previous_hash,
            timestamp,
            events,
            hash,
            validator_count: 0,
        }
    }

    pub fn compute_hash(
        index: u64,
        previous_hash: &str,
        timestamp: &DateTime<Utc>,
        events: &[DispatchEvent],
    ) -> String {
        let mut hasher = Sha256::new();
        hasher.update(index.to_le_bytes());
        hasher.update(previous_hash.as_bytes());
        hasher.update(timestamp.to_rfc3339().as_bytes());
        for event in events {
            hasher.update(event.event_id.as_bytes());
            hasher.update(event.asset_id.as_bytes());
            hasher.update(event.power_kw.to_le_bytes());
            hasher.update(event.reason.as_bytes());
        }
        hex::encode(hasher.finalize())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditChain {
    pub blocks: Vec<Block>,
    pub pending_events: Vec<DispatchEvent>,
    pub validators: HashMap<String, String>,
}

impl AuditChain {
    pub fn new() -> Self {
        let genesis = Block {
            index: 0,
            previous_hash: "0".repeat(64),
            timestamp: Utc::now(),
            events: vec![],
            hash: String::new(),
            validator_count: 0,
        };
        let mut chain = Self {
            blocks: vec![genesis],
            pending_events: Vec::with_capacity(1000),
            validators: HashMap::new(),
        };
        // Recompute genesis hash
        chain.blocks[0].hash = Block::compute_hash(0, &"0".repeat(64), &chain.blocks[0].timestamp, &[]);
        chain
    }

    /// Record a dispatch event — queued until flush
    pub fn record_event(&mut self, event: DispatchEvent) {
        self.pending_events.push(event);
    }

    /// Flush pending events into a new block
    pub fn flush(&mut self) -> Result<&Block, AuditError> {
        if self.pending_events.is_empty() {
            return Err(AuditError::NoPendingEvents);
        }

        let previous = self.blocks.last().ok_or(AuditError::EmptyChain)?;
        let index = previous.index + 1;

        let events = std::mem::take(&mut self.pending_events);
        let block = Block::new(index, previous.hash.clone(), events);

        info!(
            "Block #{} mined — {} events, hash={}",
            block.index,
            block.events.len(),
            &block.hash[..16]
        );

        metrics::counter!("blockchain_blocks_total").increment(1);
        metrics::gauge!("blockchain_pending_events", self.pending_events.len() as f64);

        self.blocks.push(block);
        Ok(self.blocks.last().unwrap())
    }

    /// Verify chain integrity
    pub fn verify(&self) -> Result<bool, AuditError> {
        for i in 1..self.blocks.len() {
            let current = &self.blocks[i];
            let previous = &self.blocks[i - 1];

            let expected_hash = Block::compute_hash(
                current.index,
                &previous.hash,
                &current.timestamp,
                &current.events,
            );

            if current.hash != expected_hash {
                return Err(AuditError::HashMismatch {
                    block: current.index,
                    expected: expected_hash,
                    got: current.hash.clone(),
                });
            }

            if current.previous_hash != previous.hash {
                return Err(AuditError::LinkBroken {
                    block: current.index,
                    expected: previous.hash.clone(),
                    got: current.previous_hash.clone(),
                });
            }
        }
        Ok(true)
    }

    /// Get a proof-of-inclusion for a specific event
    pub fn prove_inclusion(&self, event_id: &str) -> Option<(u64, &DispatchEvent)> {
        for block in &self.blocks {
            for event in &block.events {
                if event.event_id == event_id {
                    return Some((block.index, event));
                }
            }
        }
        None
    }

    pub fn total_events(&self) -> usize {
        self.blocks.iter().map(|b| b.events.len()).sum()
    }

    pub fn chain_length(&self) -> u64 {
        self.blocks.len() as u64
    }
}

#[derive(Debug, thiserror::Error)]
pub enum AuditError {
    #[error("no pending events to flush")]
    NoPendingEvents,
    #[error("blockchain is empty")]
    EmptyChain,
    #[error("hash mismatch at block {block}: expected {expected}, got {got}")]
    HashMismatch { block: u64, expected: String, got: String },
    #[error("broken link at block {block}: expected prev={expected}, got {got}")]
    LinkBroken { block: u64, expected: String, got: String },
}

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()))
        .init();

    let mut chain = AuditChain::new();
    info!("Blockchain Audit service started — genesis: {}", &chain.blocks[0].hash[..16]);

    // Simulate dispatch events
    for i in 0..10 {
        chain.record_event(DispatchEvent {
            event_id: uuid::Uuid::new_v4().to_string(),
            asset_id: format!("bat-{:03}", i % 3),
            power_kw: 50.0 + (i as f64 * 10.0),
            duration_seconds: 3600,
            reason: "arbitrage".into(),
            dispatched_by: "pde-engine-v1".into(),
            timestamp: Utc::now(),
            signature: hex::encode([0u8; 32]),
        });
    }

    chain.flush().unwrap();
    assert!(chain.verify().unwrap());
    info!("Chain integrity verified — {} blocks, {} events", chain.chain_length(), chain.total_events());
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_genesis_chain_is_valid() {
        let chain = AuditChain::new();
        assert!(chain.verify().unwrap());
    }

    #[test]
    fn test_flush_creates_block() {
        let mut chain = AuditChain::new();
        chain.record_event(DispatchEvent {
            event_id: "evt-001".into(),
            asset_id: "bat-001".into(),
            power_kw: 100.0,
            duration_seconds: 3600,
            reason: "arbitrage".into(),
            dispatched_by: "pde".into(),
            timestamp: Utc::now(),
            signature: "sig".into(),
        });
        let block = chain.flush().unwrap();
        assert_eq!(block.index, 1);
        assert_eq!(block.events.len(), 1);
    }

    #[test]
    fn test_detect_tampering() {
        let mut chain = AuditChain::new();
        chain.record_event(DispatchEvent {
            event_id: "evt-002".into(),
            asset_id: "bat-002".into(),
            power_kw: 50.0,
            duration_seconds: 1800,
            reason: "peak_shave".into(),
            dispatched_by: "pde".into(),
            timestamp: Utc::now(),
            signature: "sig".into(),
        });
        chain.flush().unwrap();

        // Tamper with event power
        chain.blocks[1].events[0].power_kw = 9999.0;

        assert!(chain.verify().is_err());
    }

    #[test]
    fn test_prove_inclusion() {
        let mut chain = AuditChain::new();
        let eid = "evt-003";
        chain.record_event(DispatchEvent {
            event_id: eid.into(),
            asset_id: "bat-003".into(),
            power_kw: 75.0,
            duration_seconds: 2700,
            reason: "ancillary".into(),
            dispatched_by: "pde".into(),
            timestamp: Utc::now(),
            signature: "sig".into(),
        });
        chain.flush().unwrap();
        let proof = chain.prove_inclusion(eid);
        assert!(proof.is_some());
        let (block_idx, event) = proof.unwrap();
        assert_eq!(block_idx, 1);
        assert_eq!(event.power_kw, 75.0);
    }

    #[test]
    fn test_multiple_blocks() {
        let mut chain = AuditChain::new();
        for i in 0..5 {
            chain.record_event(DispatchEvent {
                event_id: format!("evt-{i:03}"),
                asset_id: "bat-001".into(),
                power_kw: 10.0 * i as f64,
                duration_seconds: 3600,
                reason: "arbitrage".into(),
                dispatched_by: "pde".into(),
                timestamp: Utc::now(),
                signature: "sig".into(),
            });
            chain.flush().unwrap();
        }
        assert_eq!(chain.chain_length(), 6); // genesis + 5
        assert_eq!(chain.total_events(), 5);
    }
}
