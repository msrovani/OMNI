//! Safety Module — Critical safety checks
//!
//! Implementa as regras de segurança obrigatórias:
//! - IEEE 1547 (anti-ilhamento)
//! - Proteção de sobrecarga
//! - Limites de frequência e tensão

/// Status de segurança
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SafetyStatus {
    Normal,
    Warning,
    Critical,
    EmergencyShutdown,
}

/// Verificador de segurança da rede
pub struct GridSafetyCheck {
    pub v_min: f32,           // Tensão mínima (V)
    pub v_max: f32,           // Tensão máxima (V)
    pub f_min: f32,           // Frequência mínima (Hz)
    pub f_max: f32,           // Frequência máxima (Hz)
    pub overload_threshold_a: f32,  // Corrente máxima (A)
}

impl GridSafetyCheck {
    pub fn new(
        v_nominal: f32,       // Tensão nominal (ex: 220V)
        f_nominal: f32,       // Frequência nominal (ex: 60Hz)
    ) -> Self {
        Self {
            v_min: v_nominal * 0.9,
            v_max: v_nominal * 1.1,
            f_min: f_nominal - 0.5,
            f_max: f_nominal + 0.5,
            overload_threshold_a: 100.0,
        }
    }

    /// Avalia segurança com base em uma leitura de telemetria
    pub fn evaluate(
        &self,
        voltage_v: f32,
        frequency_hz: f32,
        current_a: f32,
    ) -> SafetyStatus {
        if voltage_v < self.v_min || voltage_v > self.v_max {
            return SafetyStatus::Critical;
        }
        if frequency_hz < self.f_min || frequency_hz > self.f_max {
            return SafetyStatus::Warning;
        }
        if current_a > self.overload_threshold_a {
            return SafetyStatus::Critical;
        }
        SafetyStatus::Normal
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normal_voltage() {
        let safety = GridSafetyCheck::new(220.0, 60.0);
        assert_eq!(safety.evaluate(220.0, 60.0, 50.0), SafetyStatus::Normal);
    }

    #[test]
    fn test_over_voltage_critical() {
        let safety = GridSafetyCheck::new(220.0, 60.0);
        assert_eq!(safety.evaluate(260.0, 60.0, 50.0), SafetyStatus::Critical);
    }

    #[test]
    fn test_over_frequency_warning() {
        let safety = GridSafetyCheck::new(220.0, 60.0);
        assert_eq!(safety.evaluate(220.0, 61.0, 50.0), SafetyStatus::Warning);
    }

    #[test]
    fn test_overload_critical() {
        let safety = GridSafetyCheck::new(220.0, 60.0);
        assert_eq!(safety.evaluate(220.0, 60.0, 150.0), SafetyStatus::Critical);
    }
}
