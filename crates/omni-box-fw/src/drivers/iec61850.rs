//! IEC 61850 Driver
//!
//! Protocolo de automação de subestações (GOOSE, MMS, SV).
//! Essencial para comunicação com utilities e equipamentos de média/alta tensão.

/// Tipos de mensagem IEC 61850
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Iec61850MessageType {
    Goose,  // Generic Object Oriented Substation Event
    Mms,    // Manufacturing Message Specification
    Sv,     // Sampled Values
}

/// Estado de um disjuntor (position)
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum BreakerPosition {
    Open,
    Closed,
    Intermediate,
    Fault,
}

/// Comando de proteção IEC 61850
#[derive(Debug, Clone)]
pub struct ProtectionCommand {
    pub control_block: u16,
    pub position: BreakerPosition,
    pub origin: u16,
    pub timestamp_s: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_iec61850_types() {
        assert_ne!(Iec61850MessageType::Goose as u8, Iec61850MessageType::Mms as u8);
    }
}
