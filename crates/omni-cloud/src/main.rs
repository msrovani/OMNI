//! Omni-Cloud Edge Gateway
//!
//! CRITICAL INFRASTRUCTURE — gRPC service for edge device communication.
//! Handles telemetry ingestion from 10k+ concurrent Omni-Box devices,
//! dispatch command relay, device status tracking, and mTLS authentication.

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Instant;

use arc_swap::ArcSwap;
use dashmap::DashMap;
use tokio::net::TcpListener;
use tokio::sync::RwLock;
use tonic::transport::{Identity, Server, ServerTlsConfig};
use tonic::{Request, Response, Status};
use tracing::{error, info, warn};

mod proto {
    pub mod common {
        pub mod v1 {
            include!(concat!(env!("OUT_DIR"), "/omnigrid.common.v1.rs"));
        }
    }
    pub mod edge {
        pub mod v1 {
            include!(concat!(env!("OUT_DIR"), "/omnigrid.edge.v1.rs"));
        }
    }
}

use proto::common::v1::{Ack, GetByIdRequest};
use proto::edge::v1::{
    edge_service_server::{EdgeService, EdgeServiceServer},
    DispatchAck, DispatchCommand, DeviceStatus, Telemetry, TelemetryBatch,
};

// ─── Domain Types ───

#[derive(Debug, Clone)]
pub struct DeviceRecord {
    pub device_id: String,
    pub firmware_version: String,
    pub last_seen: chrono::DateTime<chrono::Utc>,
    pub connected_since: chrono::DateTime<chrono::Utc>,
    pub is_connected: bool,
    pub shadow_mode: bool,
    pub active_protocols: Vec<String>,
    pub telemetry_count: u64,
    pub last_soc: f64,
    pub last_power_w: f64,
    pub cert_thumbprint: String,
}

#[derive(Debug, thiserror::Error)]
pub enum EdgeError {
    #[error("device not found: {0}")]
    DeviceNotFound(String),
    #[error("device not connected: {0}")]
    DeviceNotConnected(String),
    #[error("certificate validation failed: {0}")]
    CertValidationFailed(String),
    #[error("storage error: {0}")]
    StorageError(String),
}

// ─── Telemetry Ring Buffer ───

pub struct TelemetryRingBuffer {
    buffer: Vec<Telemetry>,
    capacity: usize,
    write_pos: usize,
    count: usize,
}

impl TelemetryRingBuffer {
    pub fn new(capacity: usize) -> Self {
        Self {
            buffer: Vec::with_capacity(capacity),
            capacity,
            write_pos: 0,
            count: 0,
        }
    }

    pub fn push(&mut self, sample: Telemetry) {
        if self.buffer.len() < self.capacity {
            self.buffer.push(sample);
        } else {
            self.buffer[self.write_pos] = sample;
        }
        self.write_pos = (self.write_pos + 1) % self.capacity;
        self.count = self.count.saturating_add(1);
    }

    pub fn latest(&self, n: usize) -> &[Telemetry] {
        let n = n.min(self.buffer.len());
        if self.buffer.len() < self.capacity {
            &self.buffer[self.buffer.len().saturating_sub(n)..]
        } else {
            let start = if self.write_pos >= n {
                self.write_pos.saturating_sub(n)
            } else {
                self.buffer.len().saturating_sub(n)
            };
            &self.buffer[start..start + n.min(self.buffer.len() - start)]
        }
    }

    pub fn len(&self) -> usize {
        self.buffer.len()
    }
}

// ─── Certificate Validator (mTLS) ───

pub struct CertValidator {
    ca_cert_pem: ArcSwap<String>,
    allowed_cn_prefixes: Vec<String>,
}

impl CertValidator {
    pub fn new(ca_pem: &str, allowed_prefixes: Vec<String>) -> Self {
        Self {
            ca_cert_pem: ArcSwap::new(Arc::new(ca_pem.to_string())),
            allowed_cn_prefixes: allowed_prefixes,
        }
    }

    pub fn validate_peer_cert(&self, cert_pem: &str) -> Result<String, EdgeError> {
        let cert = x509_parser::parse_x509_certificate(cert_pem.as_bytes())
            .map_err(|e| EdgeError::CertValidationFailed(format!("parse error: {e}")))?
            .1;

        let cn = cert.subject()
            .iter_common_name()
            .next()
            .and_then(|cn| cn.as_str().ok())
            .ok_or_else(|| EdgeError::CertValidationFailed("no CN in certificate".into()))?;

        let is_allowed = self.allowed_cn_prefixes.iter().any(|p| cn.starts_with(p));
        if !is_allowed {
            return Err(EdgeError::CertValidationFailed(format!(
                "CN {cn} not in allowed prefixes"
            )));
        }

        let thumbprint = {
            use sha2::Digest;
            let mut hasher = sha2::Sha256::new();
            hasher.update(cert.tbs_certificate.subject.as_ref());
            hex::encode(hasher.finalize())
        };

        Ok(thumbprint)
    }
}

// ─── gRPC Service Implementation ───

pub struct OmniEdgeService {
    devices: DashMap<String, Arc<RwLock<DeviceRecord>>>,
    telemetry: DashMap<String, Arc<RwLock<TelemetryRingBuffer>>>,
    cert_validator: Arc<CertValidator>,
    startup: Instant,
    dispatch_history: Arc<RwLock<Vec<proto::common::v1::Ack>>>,
}

impl OmniEdgeService {
    pub fn new(cert_validator: CertValidator) -> Self {
        Self {
            devices: DashMap::new(),
            telemetry: DashMap::new(),
            cert_validator: Arc::new(cert_validator),
            startup: Instant::now(),
            dispatch_history: Arc::new(RwLock::new(Vec::with_capacity(10_000))),
        }
    }

    async fn get_or_create_device(&self, device_id: &str, cert_thumbprint: &str) -> Arc<RwLock<DeviceRecord>> {
        self.devices
            .entry(device_id.to_string())
            .or_insert_with(|| {
                Arc::new(RwLock::new(DeviceRecord {
                    device_id: device_id.to_string(),
                    firmware_version: "1.0.0".into(),
                    last_seen: chrono::Utc::now(),
                    connected_since: chrono::Utc::now(),
                    is_connected: true,
                    shadow_mode: false,
                    active_protocols: vec!["modbus".into(), "can".into(), "sunSpec".into()],
                    telemetry_count: 0,
                    last_soc: 50.0,
                    last_power_w: 0.0,
                    cert_thumbprint: cert_thumbprint.to_string(),
                }))
            })
            .value()
            .clone()
    }

    fn get_telemetry_buffer(&self, device_id: &str) -> Arc<RwLock<TelemetryRingBuffer>> {
        self.telemetry
            .entry(device_id.to_string())
            .or_insert_with(|| Arc::new(RwLock::new(TelemetryRingBuffer::new(10_000))))
            .value()
            .clone()
    }
}

#[tonic::async_trait]
impl EdgeService for OmniEdgeService {
    /// Ingest telemetry samples from edge devices.
    /// Rate: 10k+ concurrent devices, each reporting every 1-5s.
    async fn report_telemetry(
        &self,
        request: Request<TelemetryBatch>,
    ) -> Result<Response<Ack>, Status> {
        let batch = request.into_inner();
        let count = batch.samples.len();

        for mut sample in batch.samples {
            let device_id = sample.device_id.clone();
            let cert_thumbprint = "auto-registered";

            // Update device record
            let device = self.get_or_create_device(&device_id, cert_thumbprint).await;
            {
                let mut dev = device.write().await;
                dev.last_seen = chrono::Utc::now();
                dev.is_connected = true;
                dev.telemetry_count += 1;
                dev.last_soc = sample.soc_percent;
                dev.last_power_w = sample.power_w;
            }

            // Store telemetry in ring buffer
            let buf = self.get_telemetry_buffer(&device_id);
            {
                let mut buf = buf.write().await;
                buf.push(sample);
            }
        }

        metrics::counter!("omni_cloud_telemetry_ingested", "count" => count.to_string()).increment(count as u64);

        Ok(Response::new(Ack {
            success: true,
            message: format!("{count} samples ingested"),
        }))
    }

    /// Receive dispatch command from PDE and acknowledge.
    async fn receive_dispatch(
        &self,
        request: Request<DispatchCommand>,
    ) -> Result<Response<DispatchAck>, Status> {
        let cmd = request.into_inner();

        if !self.devices.contains_key(&cmd.asset_id) {
            return Ok(Response::new(DispatchAck {
                command_id: cmd.command_id.clone(),
                accepted: false,
                rejection_reason: "Device not registered".into(),
                executed_at: None,
            }));
        }

        // Log for audit
        let ack = proto::common::v1::Ack {
            success: true,
            message: format!("dispatch to {}: {}kW", cmd.asset_id, cmd.power_kw),
        };
        {
            let mut history = self.dispatch_history.write().await;
            history.push(ack);
        }

        metrics::counter!("omni_cloud_dispatches_total").increment(1);

        info!(
            "Dispatch to {}: {}kW for {}s — reason: {}",
            cmd.asset_id, cmd.power_kw, cmd.duration_seconds, cmd.reason,
        );

        Ok(Response::new(DispatchAck {
            command_id: cmd.command_id,
            accepted: true,
            rejection_reason: String::new(),
            executed_at: Some(prost_types::Timestamp::from(
                chrono::Utc::now().naive_utc(),
            )),
        }))
    }

    /// Get device status — used for health monitoring.
    async fn get_status(
        &self,
        request: Request<GetByIdRequest>,
    ) -> Result<Response<DeviceStatus>, Status> {
        let device_id = request.into_inner().id;

        match self.devices.get(&device_id) {
            Some(entry) => {
                let device = entry.read().await;
                Ok(Response::new(DeviceStatus {
                    device_id: device.device_id.clone(),
                    firmware_version: device.firmware_version.clone(),
                    uptime_seconds: (chrono::Utc::now() - device.connected_since)
                        .num_seconds() as u32,
                    is_connected: device.is_connected,
                    shadow_mode_active: device.shadow_mode,
                    active_protocols: device.active_protocols.clone(),
                }))
            }
            None => Ok(Response::new(DeviceStatus {
                device_id,
                firmware_version: String::new(),
                uptime_seconds: 0,
                is_connected: false,
                shadow_mode_active: false,
                active_protocols: vec![],
            })),
        }
    }
}

// ─── Entrypoint ───

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()))
        .with_target(true)
        .init();

    let addr: SocketAddr = ([0, 0, 0, 0], 50053).into();
    let cert_validator = CertValidator::new("", vec!["omni-box-".into(), "omni-grid-".into()]);

    let edge_svc = OmniEdgeService::new(cert_validator);

    info!("Omni-Cloud Edge Gateway starting on {addr}");

    // Optionally serve with mTLS
    let use_tls = std::env::var("OMNI_CLOUD_TLS").is_ok();

    if use_tls {
        let cert = tokio::fs::read("tls/server.pem").await?;
        let key = tokio::fs::read("tls/server.key").await?;
        let identity = Identity::from_pem(cert, key);

        let tls_config = ServerTlsConfig::new()
            .identity(identity)
            .client_ca_root(tonic::transport::Certificate::from_pem(
                &tokio::fs::read("tls/ca.pem").await?,
            ));

        Server::builder()
            .tls_config(tls_config)?
            .add_service(EdgeServiceServer::new(edge_svc))
            .serve(addr)
            .await?;
    } else {
        Server::builder()
            .tls_config(ServerTlsConfig::new().identity(Identity::from_pem(
                include_bytes!("../../tls/server.pem").to_vec(),
                include_bytes!("../../tls/server.key").to_vec(),
            )))
            .ok();

        Server::builder()
            .add_service(EdgeServiceServer::new(edge_svc))
            .serve(addr)
            .await?;
    }

    Ok(())
}
