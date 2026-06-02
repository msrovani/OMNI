//! Shadow Engine — Lógica local de segurança autônoma
//!
//! Executa independente da conexão com a nuvem.
//! Regras de segurança (anti-ilhamento, sobrecarga, SoC mínimo)
//! são avaliadas a cada tick e podem sobrepor comandos remotos.

use super::DeviceMode;

/// Comando emitido pela Shadow Engine
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ShadowCommand {
    /// Tudo normal
    Normal,
    /// Parar descarga — SoC abaixo do mínimo
    HaltDischarge,
    /// Desconectar da rede — risco de ilhamento
    DisconnectFromGrid,
    /// Forçar carga de emergência
    EmergencyCharge,
}

/// Shadow Engine — avalia condições de segurança local
pub struct ShadowEngine {
    /// SoC mínimo absoluto (nunca descarregar abaixo disso)
    pub min_soc: f32,
    /// Potência máxima permitida (kW)
    pub max_power_kw: f32,
    /// Proteção anti-ilhamento ativa?
    pub anti_islanding: bool,
    /// Frequência nominal da rede (Hz)
    pub nominal_freq: f32,
    /// Tolerância de frequência (%)
    pub freq_tolerance_pct: f32,
    /// Contagem de ciclos de shadow ativo
    pub shadow_cycles: u32,
}

impl ShadowEngine {
    pub fn new(
        min_soc: f32,
        max_power_kw: f32,
        anti_islanding: bool,
        nominal_freq: f32,
        freq_tolerance_pct: f32,
    ) -> Self {
        Self {
            min_soc,
            max_power_kw,
            anti_islanding,
            nominal_freq,
            freq_tolerance_pct,
            shadow_cycles: 0,
        }
    }

    /// Avalia condições atuais e retorna comando de segurança
    pub fn evaluate(
        &mut self,
        soc: f32,
        grid_connected: bool,
        _mode: DeviceMode,
    ) -> ShadowCommand {
        // Regra 1: Anti-ilhamento
        // Se a rede caiu e estamos exportando energia, desconectar
        if self.anti_islanding && !grid_connected {
            self.shadow_cycles += 1;
            return ShadowCommand::DisconnectFromGrid;
        }

        // Regra 2: SoC crítico — parar descarga
        if soc <= self.min_soc {
            return ShadowCommand::HaltDischarge;
        }

        // Regra 3: SoC muito baixo — carga forçada
        if soc <= self.min_soc * 0.8 {
            return ShadowCommand::EmergencyCharge;
        }

        ShadowCommand::Normal
    }

    /// Verifica se um comando de dispatch viola as regras locais
    pub fn validate_dispatch(&self, power_kw: f32, soc: f32, is_discharge: bool) -> Result<(), &'static str> {
        if is_discharge && soc <= self.min_soc {
            return Err("SoC below minimum for discharge");
        }
        if power_kw > self.max_power_kw {
            return Err("Power exceeds maximum allowed");
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normal_conditions() {
        let mut shadow = ShadowEngine::new(20.0, 50.0, true, 60.0, 0.5);
        assert_eq!(shadow.evaluate(80.0, true, DeviceMode::Normal), ShadowCommand::Normal);
    }

    #[test]
    fn test_anti_islanding_triggers() {
        let mut shadow = ShadowEngine::new(20.0, 50.0, true, 60.0, 0.5);
        assert_eq!(shadow.evaluate(50.0, false, DeviceMode::Normal), ShadowCommand::DisconnectFromGrid);
    }

    #[test]
    fn test_halt_discharge_at_min_soc() {
        let mut shadow = ShadowEngine::new(20.0, 50.0, true, 60.0, 0.5);
        assert_eq!(shadow.evaluate(20.0, true, DeviceMode::Normal), ShadowCommand::HaltDischarge);
    }

    #[test]
    fn test_emergency_charge_at_critical_soc() {
        let mut shadow = ShadowEngine::new(20.0, 50.0, true, 60.0, 0.5);
        assert_eq!(shadow.evaluate(15.0, true, DeviceMode::Normal), ShadowCommand::EmergencyCharge);
    }

    #[test]
    fn test_validate_dispatch_power_limit() {
        let shadow = ShadowEngine::new(20.0, 50.0, true, 60.0, 0.5);
        assert!(shadow.validate_dispatch(100.0, 80.0, true).is_err());
        assert!(shadow.validate_dispatch(25.0, 80.0, true).is_ok());
    }

    #[test]
    fn test_validate_dispatch_soc_limit() {
        let shadow = ShadowEngine::new(20.0, 50.0, true, 60.0, 0.5);
        assert!(shadow.validate_dispatch(25.0, 15.0, true).is_err());
        assert!(shadow.validate_dispatch(25.0, 15.0, false).is_ok()); // charging is fine
    }
}
