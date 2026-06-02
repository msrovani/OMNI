//! CAN Bus Driver
//!
//! Comunicação direta com BMS (Battery Management System).
//! Protocolo CAN 2.0B (29-bit extended identifier).

/// Identificadores CAN padrão para BMS
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CanId {
    BatteryStatus = 0x100,
    BatteryVoltage = 0x101,
    BatteryCurrent = 0x102,
    BatteryTemperature = 0x103,
    SocRequest = 0x200,
    SocResponse = 0x201,
    DispatchCommand = 0x300,
}

/// Frame CAN
#[derive(Debug, Clone)]
pub struct CanFrame {
    pub id: u32,
    pub extended: bool,
    pub data: [u8; 8],
    pub dlc: u8,
}

impl CanFrame {
    pub fn new(id: u32, data: [u8; 8], dlc: u8) -> Self {
        Self {
            id,
            extended: id > 0x7FF,
            data,
            dlc: dlc.min(8),
        }
    }

    /// Decodifica tensão total da bateria (V) do frame BMS
    pub fn decode_battery_voltage(&self) -> Option<f32> {
        if self.id == 0x101 {
            let volts = u16::from_be_bytes([self.data[0], self.data[1]]);
            Some(volts as f32 * 0.1)
        } else {
            None
        }
    }

    /// Decodifica SoC (%) do frame BMS
    pub fn decode_soc(&self) -> Option<f32> {
        if self.id == 0x201 {
            Some(self.data[0] as f32 * 0.5)
        } else {
            None
        }
    }

    /// Codifica comando de dispatch para o BMS
    pub fn encode_dispatch(power_kw: f32) -> Self {
        let power_w = (power_kw * 1000.0) as u32;
        let mut data = [0u8; 8];
        data[0..4].copy_from_slice(&power_w.to_be_bytes());
        Self::new(0x300, data, 4)
    }
}

/// Driver CAN Bus
pub struct CANDriver {
    interface: heapless::String<32>,
    bitrate_kbps: u32,
}

impl CANDriver {
    pub fn new(interface: &str, bitrate_kbps: u32) -> Self {
        Self {
            interface: heapless::String::from(interface),
            bitrate_kbps,
        }
    }

    pub fn send(&self, frame: &CanFrame) -> Result<(), &'static str> {
        Ok(())
    }

    pub fn receive(&self) -> Result<CanFrame, &'static str> {
        Err("no data")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decode_battery_voltage() {
        let frame = CanFrame::new(0x101, [0x0E, 0x10, 0, 0, 0, 0, 0, 0], 2);
        let volts = frame.decode_battery_voltage();
        assert!(volts.is_some());
        assert!((volts.unwrap() - 360.0).abs() < 0.1);
    }

    #[test]
    fn test_decode_soc() {
        let frame = CanFrame::new(0x201, [0xA0, 0, 0, 0, 0, 0, 0, 0], 1);
        let soc = frame.decode_soc();
        assert!(soc.is_some());
        assert!((soc.unwrap() - 80.0).abs() < 0.1);
    }

    #[test]
    fn test_encode_dispatch() {
        let frame = CanFrame::encode_dispatch(25.0);
        assert_eq!(frame.id, 0x300);
        let power = u32::from_be_bytes([frame.data[0], frame.data[1], frame.data[2], frame.data[3]]);
        assert_eq!(power, 25000);
    }

    #[test]
    fn test_extended_id() {
        let frame = CanFrame::new(0x300, [0; 8], 0);
        assert!(frame.extended);
    }
}
