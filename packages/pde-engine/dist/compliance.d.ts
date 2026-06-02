import type { PldSubmarket, RegulatoryCompliance } from "./types.js";
export interface ComplianceCheck {
    orgao: string;
    resolucao: string;
    descricao: string;
    status: "conforme" | "pendente" | "nao_aplicavel";
    observacao?: string;
}
declare const BANDEIRAS: {
    readonly verde: {
        readonly nome: "Verde";
        readonly acréscimo: 0;
    };
    readonly amarela: {
        readonly nome: "Amarela";
        readonly acréscimo: 18.85;
    };
    readonly "vermelha-1": {
        readonly nome: "Vermelha Patamar 1";
        readonly acréscimo: 44.63;
    };
    readonly "vermelha-2": {
        readonly nome: "Vermelha Patamar 2";
        readonly acréscimo: 78.77;
    };
};
export declare function getRegulatoryCompliance(): RegulatoryCompliance & {
    moeda: string;
    unidade: string;
};
export declare function getPldParameters(): {
    piso: number;
    teto: number;
    moeda: string;
    unidade: string;
    submercados: {
        codigo: PldSubmarket;
        nome: string;
    }[];
};
export declare function getSubmercadoName(code: PldSubmarket): string;
export declare function getBandeiraTarifaria(): keyof typeof BANDEIRAS;
export declare function getFullComplianceReport(): ComplianceCheck[];
export {};
//# sourceMappingURL=compliance.d.ts.map