const ALL_SUBMARKETS = ["SE_CO", "S", "NE", "N"];
const BANDEIRAS = {
    verde: { nome: "Verde", acréscimo: 0 },
    amarela: { nome: "Amarela", acréscimo: 18.85 },
    "vermelha-1": { nome: "Vermelha Patamar 1", acréscimo: 44.63 },
    "vermelha-2": { nome: "Vermelha Patamar 2", acréscimo: 78.77 },
};
export function getRegulatoryCompliance() {
    return {
        aneelResolution: "REN 1.000/2022, REN 1.059/2023, Lei 14.300/2022",
        gdCompensationModel: "SCEE",
        bandeiraTarifaria: "verde",
        icmsAliquotaPct: 18,
        pisCofinsAliquotaPct: 9.25,
        moeda: "BRL",
        unidade: "R$/MWh",
    };
}
export function getPldParameters() {
    return {
        piso: 69.07,
        teto: 599.31,
        moeda: "BRL",
        unidade: "R$/MWh",
        submercados: ALL_SUBMARKETS.map((sm) => ({
            codigo: sm,
            nome: getSubmercadoName(sm),
        })),
    };
}
export function getSubmercadoName(code) {
    const names = {
        SE_CO: "Sudeste/Centro-Oeste",
        S: "Sul",
        NE: "Nordeste",
        N: "Norte",
    };
    return names[code];
}
export function getBandeiraTarifaria() {
    const month = new Date().getMonth();
    if (month >= 4 && month <= 9)
        return "verde";
    return "verde";
}
export function getFullComplianceReport() {
    return [
        {
            orgao: "ANEEL",
            resolucao: "REN 1.000/2022",
            descricao: "Procedimentos de Distribuição de Energia Elétrica no SIN",
            status: "conforme",
            observacao: "Regras de conexão e compensação GD implementadas",
        },
        {
            orgao: "ANEEL",
            resolucao: "Lei 14.300/2022",
            descricao: "Marco Legal da Geração Distribuída",
            status: "conforme",
            observacao: "Modelos SCEE e ACL suportados",
        },
        {
            orgao: "CCEE",
            resolucao: "Regras de Comercialização",
            descricao: "Contabilização e liquidação PLD horário",
            status: "conforme",
            observacao: "Integração com PLD horário por submercado",
        },
        {
            orgao: "ONS",
            resolucao: "Submódulo 14.1",
            descricao: "Recursos Energéticos Distribuídos",
            status: "pendente",
            observacao: "Credenciamento para serviços ancilares em desenvolvimento",
        },
        {
            orgao: "ONS",
            resolucao: "Procedimentos de Rede",
            descricao: "Despacho de usinas e requisitos técnicos",
            status: "conforme",
            observacao: "Interface com procedimentos do ONS via API",
        },
        {
            orgao: "ANEEL",
            resolucao: "REN 482/2012",
            descricao: "Sistema de Compensação de Energia Elétrica",
            status: "conforme",
            observacao: "Net metering implementado",
        },
    ];
}
//# sourceMappingURL=compliance.js.map