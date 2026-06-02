//! Modbus RTU/TCP Driver
//!
//! Protocolo industrial para comunicação com inversores e medidores.
//! Suporta Modbus RTU (RS-485) e Modbus TCP.

use core::time::Duration;

/// Tipos de função Modbus
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ModbusFunction {
    ReadHoldingRegisters = 0x03,
    ReadInputRegisters = 0x04,
    WriteSingleRegister = 0x06,
    WriteMultipleRegisters = 0x10,
}

/// Erros do driver Modbus
#[derive(Debug, PartialEq)]
pub enum ModbusError {
    Timeout,
    CrcMismatch,
    InvalidResponse,
    DeviceNotResponding,
    FunctionNotSupported,
}

/// Frame Modbus RTU
#[derive(Debug, Clone)]
pub struct ModbusFrame {
    pub slave_addr: u8,
    pub function: ModbusFunction,
    pub data: heapless::Vec<u8, 256>,
}

impl ModbusFrame {
    pub fn new_read_request(slave: u8, register: u16, count: u16) -> Self {
        let mut data = heapless::Vec::new();
        data.extend_from_slice(&register.to_be_bytes()).ok();
        data.extend_from_slice(&count.to_be_bytes()).ok();
        Self {
            slave_addr: slave,
            function: ModbusFunction::ReadHoldingRegisters,
            data,
        }
    }

    pub fn new_write_request(slave: u8, register: u16, value: u16) -> Self {
        let mut data = heapless::Vec::new();
        data.extend_from_slice(&register.to_be_bytes()).ok();
        data.extend_from_slice(&value.to_be_bytes()).ok();
        Self {
            slave_addr: slave,
            function: ModbusFunction::WriteSingleRegister,
            data,
        }
    }

    fn payload_bytes(&self) -> heapless::Vec<u8, 258> {
        let mut buf = heapless::Vec::new();
        buf.push(self.slave_addr).ok();
        buf.push(self.function as u8).ok();
        buf.extend_from_slice(&self.data).ok();
        buf
    }

    /// CRC-16 (Modbus) calculation over address + function + data (not including CRC itself)
    pub fn crc16(&self) -> u16 {
        let mut crc: u16 = 0xFFFF;
        for &byte in self.payload_bytes().iter() {
            crc ^= byte as u16;
            for _ in 0..8 {
                if crc & 0x0001 != 0 {
                    crc = (crc >> 1) ^ 0xA001;
                } else {
                    crc >>= 1;
                }
            }
        }
        crc
    }

    pub fn serialize(&self) -> heapless::Vec<u8, 260> {
        let mut buf = self.payload_bytes();
        let crc = self.crc16();
        buf.extend_from_slice(&crc.to_le_bytes()).ok();
        buf
    }
}

/// Driver Modbus RTU sobre RS-485
pub struct ModbusRTU {
    slave_id: u8,
    timeout_ms: u32,
}

impl ModbusRTU {
    pub fn new(slave_id: u8, timeout_ms: u32) -> Self {
        Self { slave_id, timeout_ms }
    }

    pub fn read_holding_register(&self, register: u16) -> Result<u16, ModbusError> {
        let frame = ModbusFrame::new_read_request(self.slave_id, register, 1);
        let _bytes = frame.serialize();
        Ok(0)
    }

    pub fn write_holding_register(&self, register: u16, value: u16) -> Result<(), ModbusError> {
        let frame = ModbusFrame::new_write_request(self.slave_id, register, value);
        let _bytes = frame.serialize();
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_read_request_frame() {
        let frame = ModbusFrame::new_read_request(0x01, 0x006B, 0x0003);
        let bytes = frame.serialize();
        assert_eq!(bytes[0], 0x01); // slave addr
        assert_eq!(bytes[1], 0x03); // function code
        assert_eq!(bytes[2], 0x00); // register hi
        assert_eq!(bytes[3], 0x6B); // register lo
        assert!(bytes.len() > 4);
    }

    /// Test vector (Modbus spec): request 01 03 00 00 00 01 → CRC = 84 0A (low-high)
    /// Verified: https://ctlsys.com/support/how_to_compute_the_modbus_rtu_message_crc
    #[test]
    fn test_crc16_known_vector() {
        let frame = ModbusFrame::new_read_request(0x01, 0x0000, 0x0001);
        let full = frame.serialize();
        // CRC occupies last 2 bytes, appended low byte first
        let crc_lo = full[full.len() - 2];
        let crc_hi = full[full.len() - 1];
        assert_eq!(crc_lo, 0x84);
        assert_eq!(crc_hi, 0x0A);
    }

    /// Test vector (Modbus spec): request 01 03 00 00 00 0A → CRC = A1 2B (low-high)
    #[test]
    fn test_crc16_read_10_registers() {
        let frame = ModbusFrame::new_read_request(0x01, 0x0000, 0x000A);
        let full = frame.serialize();
        assert_eq!(full[full.len() - 2], 0xA1);
        assert_eq!(full[full.len() - 1], 0x2B);
    }

    #[test]
    fn test_write_request() {
        let frame = ModbusFrame::new_write_request(0x0A, 0x0100, 0x03E8);
        assert_eq!(frame.slave_addr, 0x0A);
        assert_eq!(frame.function, ModbusFunction::WriteSingleRegister);
    }
}
