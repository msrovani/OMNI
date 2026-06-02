package internal

import "time"

type BatteryAsset struct {
	AssetID        string    `json:"asset_id"`
	ClientID       string    `json:"client_id"`
	Manufacturer   string    `json:"manufacturer"`
	Model          string    `json:"model"`
	CapacityKWh    float64   `json:"capacity_kwh"`
	NominalPowerKW float64   `json:"nominal_power_kw"`
	CycleLife      int       `json:"cycle_life"`
	MinSOCPercent  float64   `json:"min_soc_percent"`
	MaxSOCPercent  float64   `json:"max_soc_percent"`
	IsActive       bool      `json:"is_active"`
	InstalledAt    time.Time `json:"installed_at"`
}

type Contract struct {
	ContractID              string    `json:"contract_id"`
	ClientID                string    `json:"client_id"`
	AssetID                 string    `json:"asset_id"`
	OmniRevenueSharePercent float64   `json:"omni_revenue_share_percent"`
	MinBackupSOC            float64   `json:"min_backup_soc"`
	StartDate               time.Time `json:"start_date"`
	EndDate                 *time.Time `json:"end_date,omitempty"`
	AutoRenew               bool      `json:"auto_renew"`
	Status                  string    `json:"status"`
}
