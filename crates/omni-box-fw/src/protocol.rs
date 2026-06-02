//! Protocol Stack — Unified interface for all supported protocols
//!
//! Omni-Box suporta: Modbus RTU/TCP, CAN Bus, OCPP 2.0.1,
//! SunSpec, IEC 61850, DNP3.

/// Protocolos suportados pelo Omni-Box
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Protocol {
    ModbusRTU,
    ModbusTCP,
    CANBus,
    Ocpp201,
    SunSpec,
    Iec61850,
    Dnp3,
}

impl Protocol {
    pub fn name(&self) -> &'static str {
        match self {
            Protocol::ModbusRTU => "Modbus RTU",
            Protocol::ModbusTCP => "Modbus TCP",
            Protocol::CANBus => "CAN Bus",
            Protocol::Ocpp201 => "OCPP 2.0.1",
            Protocol::SunSpec => "SunSpec",
            Protocol::Iec61850 => "IEC 61850",
            Protocol::Dnp3 => "DNP3",
        }
    }

    pub fn is_critical(&self) -> bool {
        matches!(self, Protocol::ModbusRTU | Protocol::CANBus | Protocol::Iec61850)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_all_protocols_have_names() {
        let protocols = [
            Protocol::ModbusRTU,
            Protocol::ModbusTCP,
            Protocol::CANBus,
            Protocol::Ocpp201,
            Protocol::SunSpec,
            Protocol::Iec61850,
            Protocol::Dnp3,
        ];
        for p in &protocols {
            assert!(!p.name().is_empty());
        }
    }

    #[test]
    fn test_critical_protocols() {
        assert!(Protocol::ModbusRTU.is_critical());
        assert!(Protocol::CANBus.is_critical());
        assert!(Protocol::Iec61850.is_critical());
        assert!(!Protocol::SunSpec.is_critical());
    }
}
