# 🇧🇷 Mercado de Energia Brasileiro — Pesquisa Regulatória

## 1. Visão Geral do Setor Elétrico Brasileiro

O Sistema Interligado Nacional (SIN) é dividido em **4 submercados** operados pelo **ONS** (Operador Nacional do Sistema Elétrico), cujo preço de liquidação (PLD) é calculado pela **CCEE** (Câmara de Comercialização de Energia Elétrica).

## 2. Submercados ONS (PLD)

| Submercado | Sigla | Estados | Peso no SIN |
|-----------|-------|---------|------------|
| Sudeste/Centro-Oeste | SE/CO | SP, RJ, MG, ES, DF, GO, MT, MS | ~60% da carga |
| Sul | S | PR, SC, RS | ~15% |
| Nordeste | NE | BA, PE, CE, RN, etc | ~15% |
| Norte | N | PA, AM, RO, AC, RR, AP, TO | ~10% |

## 3. PLD — Preço de Liquidação das Diferenças

- **Calculado semanalmente** pela CCEE com base no **NEWAVE** (modelo de otimização)
- **Horário** desde 2021 (Portaria 50/2021 — MM E): PLD horário para todos os submercados
- **Piso:** R$ 69,07/MWh
- **Teto:** R$ 599,31/MWh (podendo chegar a R$ 1.000+/MWh em cenários críticos)
- **Fonte de dados implementada:** `CceeCollector` em `packages/pde-engine/src/ccee-collector.ts` — consome API JSON da CCEE (`dadosabertos.ccee.org.br`)
- Fatores que afetam o PLD: GSF (risco hidrológico), nível dos reservatórios, carga, disponibilidade térmica

### 3.1 CCEE Resource IDs (PLD Horário) — Implementado

| Ano | Resource ID |
|-----|-------------|
| 2021 | `51922462-16b4-4c64-8327-4e14d6ee8c6c` |
| 2022 | `723cf7e6-6c29-4da6-aa39-e4c8804baf65` |
| 2023 | `5fc317af-7191-4f8a-94e7-f77c56c747b3` |
| 2024 | `1b5b6946-8036-4622-a7a3-b21f33fc52b7` |
| 2025 | `2a180a6b-f092-43eb-9f82-a48798b803dc` |
| 2026 | `3f279d6b-1069-42f7-9b0a-217b084729c4` |

**Formato da resposta:** JSON array — índices: 0=_id, 1=MES_REFERENCIA (AAAAMM), 2=SUBMERCADO, 3=PERIODO_COMERCIALIZACAO, 4=DIA, 5=HORA, 6=PLD_HORA (R$/MWh)

**URL:** `https://dadosabertos.ccee.org.br/datastore/dump/{resource_id}?format=json`

### 3.2 ONS Curva de Carga — Implementado

`OnsCollector` em `packages/pde-engine/src/ons-collector.ts`

- **URL:** `https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/curva-carga-ho/CURVA_CARGA_{year}.csv`
- **Colunas:** id_subsistema (1→SE_CO, 2→S, 3→NE, 4→N), din_instante, val_cargaenergiahomwmed (MWmed)
- **Dicionário:** `https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/curva-carga-ho/DicionarioDados_CurvaCarga.json`

## 4. Ambientes de Contratação

### ACL (Ambiente de Contratação Livre)
- Consumidores com carga ≥ 500 kW (desde 2024)
- Negociam preços livremente com geradores/comercializadores
- **Alvo do OMNI Grid:** clientes industriais no ACL

### ACR (Ambiente de Contratação Regulado)
- Consumidores cativos (distribuidoras)
- Leilões regulados pela ANEEL

## 5. Principais Agentes

| Agente | Sigla | Papel |
|-------|-------|-------|
| Agência Nacional de Energia Elétrica | ANEEL | Regulamentação e fiscalização |
| Operador Nacional do Sistema Elétrico | ONS | Operação do SIN, despacho centralizado |
| Câmara de Comercialização de Energia Elétrica | CCEE | Contabilização e liquidação do mercado de curto prazo |
| Empresa de Pesquisa Energética | EPE | Planejamento de longo prazo |

## 6. Legislação Relevante

### 6.1 Marco Legal do Setor Elétrico (Lei 14.120/2021)
- Abriu o mercado livre para consumidores com carga ≥ 500 kW
- Criou condições para ampliação daGD (geração distribuída)

### 6.2 Lei 14.300/2022 — Marco da Geração Distribuída
- Regulamenta micro e minigeração distribuída (até 5 MW)
- Transição das regras de compensação (Sistema de Compensação de Energia Elétrica — SCEE)
- **Prazo de transição:** até 2045 para sistemas existentes

### 6.3 REN ANEEL 1.000/2022 (atualizada pela REN 1.059/2023)
- Consolida as regras de distribuição
- Procedimentos de conexão de micro e minigeração
- Requisitos técnicos para inversores (IEEE 1547, ABNT NBR 16149)

### 6.4 REN ANEEL 482/2012 (atualizada)
- Marco original da GD no Brasil
- Sistema de Compensação de Energia Elétrica (net metering)

### 6.5 Procedimentos de Rede do ONS
- **Submódulo 14.1:** Requisitos técnicos para recursos energéticos distribuídos
- **Submódulo 26:** Prestação de serviços ancilares
- **Submódulo 18:** Despacho de usinas

## 7. Serviços Ancilares (ONS)

O ONS remunera serviços ancilares prestados por:
- Regulação primária de frequência
- Regulação secundária de frequência
- Reserva de potência operativa
- Suporte de reativos
- **A partir de 2025:** Baterias podem se credenciar como prestadores de serviços ancilares (REN 971/2021)

## 8. Comercialização e Tributação

### ICMS
- Alíquota varia por estado (12% a 25% sobre TUSD + TE)
- **Convênio ICMS 16/2015:** Permite substituição tributária em operações de comercialização de energia

### PIS/COFINS
- Regime monofásico (Lei 10.833/2003)
- Alíquota média: 9,25% sobre faturamento

### Encargos Setoriais
| Encargo | Finalidade | % médio |
|---------|-----------|---------|
| CDE | Conta de Desenvolvimento Energético | ~3-5% |
| PROINFA | Programa de Incentivo a Fontes Alternativas | ~1% |
| TFSEE | Taxa de Fiscalização ANEEL | ~0,5% |
| ESS | Encargos de Serviço do Sistema | Variável |
| EER | Encargo de Energia de Reserva | ~1-2% |

## 9. Oportunidades para OMNI Grid no Brasil

### 9.1 Peak Shaving (Corte de Ponta)
Grandes consumidores pagam **R$/kW** pela demanda contratada. Baterias podem reduzir a demanda de ponta em até 30-40%.

### 9.2 Arbitragem de PLD
Comprar energia nos horários de PLD baixo (mediana noturna) e vender nos horários de ponta (PLD alto). Margem potencial: **R$ 200-400/MWh** entre patamares.

### 9.3 Serviços Ancilares
- Regulação de frequência: ~R$ 100-300/MWh (estimado)
- Reserva de potência: contratos bilaterais com ONS

### 9.4 V2G (Vehicle-to-Grid)
- Frotas de veículos elétricos como recursos distribuídos
- Regulamentação em desenvolvimento pela ANEEL

### 9.5 Armazenamento de Energia com Baterias (NOVO — CP 39/2023)

**Em 02/06/2026, a ANEEL aprovou o CP 39/2023**, criando o marco regulatório para sistemas de armazenamento de energia no SIN:

#### Regras de TUST/TUSD para Baterias
| Modo | Cobrança na Carga | Cobrança na Descarga | Cenário |
|------|:-:|:-:|--------|
| **Autônomo** (arbitrage/peak shave) | Sim | Sim | Operador opta por arbitragem de PLD |
| **Despachado pelo ONS** (serviços ancilares) | Não | Sim | Bateria atende ordem do ONS |

- **Autônomo:** TUST + TUSD em ambos os fluxos (dupla tarifação)
- **ONS despachado:** Tarifa única (somente descarga) — ABEEólica considera vitória parcial contra dupla cobrança
- **TUST referência:** R$ 15,40/MWh | **TUSD referência:** R$ 28,90/MWh

#### Impacto no Modelo de Negócio
1. **Validado:** Baterias autônomas (arbitrage PLD) têm regras claras — viabilidade econômica comprovada
2. **Novo Revenue Stream:** Serviços ancilares ONS com tarifa única — margem maior que arbitrage
3. **Leilão Específico:** Lei 15.269/2025 prevê leilão de baterias para **dezembro/2026**
4. **Ponto de Atenção:** ABEEólica aponta "dupla cobrança" como barreira para expansão

#### Recomendação Estratégica Omni-Grid
- Prioridade **alta**: credenciamento ONS para serviços ancilares
- Prioridade **alta**: módulo de compliance tarifário (TUST/TUSD)
- Prioridade **média**: preparação para leilão de baterias dez/2026
- **Decisão arquitetural:** `DispatchOrchestrator` + `OnsDispatchHandler` em `packages/pde-engine/`

## 10. Utilities Brasileiras (Distribuidoras) — Clientes Potenciais

| Distribuidora | Região | Grupos |
|--------------|--------|--------|
| Enel SP | SE | Enel |
| CEMIG | SE | CEMIG |
| CPFL Paulista | SE | CPFL (State Grid) |
| Light | SE | Light |
| EDP SP | SE | EDP |
| Copel | S | Copel |
| Celesc | S | Celesc |
| Neoenergia Coelba | NE | Neoenergia (Iberdrola) |
| Neoenergia Pernambuco | NE | Neoenergia |
| Equatorial Pará | N | Equatorial |
| Energisa MT | CO | Energisa |

## 11. Provedoras de Energia no ACL (Clientes B2B)

| Comercializadora | Portfólio |
|-----------------|-----------|
| Tradener | Nacional |
| Comerc | Maior comercializadora independente |
| Ecom Energia | Gestão de energia |
| Safira Energia | Varejista |
| Elektro | Distribuidora + comercializadora |
| Delta Energia | Comercialização e gestão |

## 12. Conversão de Unidades

| De | Para | Fator |
|----|------|-------|
| US$/MWh | R$/MWh | × cotação USD (ex: 5,80) |
| R$/MWh | R$/kWh | ÷ 1000 |
| USD | BRL | × 5,80 (referência 2025/2026) |

## 13. ANEEL SIGA (Geração) — Implementado

`SigaClient` em `packages/asset-manager/src/siga-client.ts`

- **CSV:** `https://dadosabertos.aneel.gov.br/dataset/6d90b77c-c5f5-4d81-bdec-7bc619494bb9/resource/11ec447d-698d-4ab8-977f-b424d5deee6a/download/siga-empreendimentos-geracao.csv`
- **Colunas:** ~14+ — nome, estado, cidade, capacidadeMw, fonte, fase, status, registro ANEEL, proprietário, CNPJ, lat/lon, submercado
- **Métodos:** `findByState()`, `findBySource()`, `findByRegistration()`, `getTotalCapacityMw()`

## 14. Conversão de Unidades

| De | Para | Fator |
|----|------|-------|
| US$/MWh | R$/MWh | × cotação USD (ex: 5,80) |
| R$/MWh | R$/kWh | ÷ 1000 |
| USD | BRL | × 5,80 (referência 2025/2026) |

## 15. Bandeira Tarifária (ANEEL)

| Bandeira | Acréscimo (R$/MWh) | Período Típico |
|----------|-------------------|----------------|
| Verde | Sem acréscimo | Maio a outubro (período seco) |
| Amarela | R$ 18,85 | Condições menos favoráveis |
| Vermelha-1 | R$ 44,63 | Condições desfavoráveis |
| Vermelha-2 | R$ 78,77 | Condições muito desfavoráveis |

## 16. Simulação de Preços PLD (Implementado)

`MarketConnectBrazilService` em `packages/market-connect/src/` — simula PLD por submercado com base em bandas horárias (BRT):

| Período | Horário | Faixa de Preço (R$/MWh) |
|---------|---------|------------------------|
| Madrugada | 23h–5h | 69–149 |
| Entre-ponta | 6h–9h / 21h–22h | 100–200 |
| Comercial | 10h–17h | 200–349 |
| Ponta | 18h–20h | 300–549 |

## 17. Referências
- CCEE: https://www.ccee.org.br — Dados Abertos: https://dadosabertos.ccee.org.br
- ONS: https://www.ons.org.br — Open Data S3: https://ons-aws-prod-opendata.s3.amazonaws.com
- ANEEL: https://www.aneel.gov.br — SIGA: https://dadosabertos.aneel.gov.br
- EPE: https://www.epe.gov.br
- Portaria MM E 50/2021 (PLD horário)
- Lei 14.120/2021 (Marco Legal)
- Lei 14.300/2022 (Marco da GD)
- Lei 15.269/2025 (Leilão de baterias — dezembro/2026)
- REN ANEEL 1.000/2022 e 1.059/2023
- **CP 39/2023 (aprovada 02/06/2026)** — Regras de TUST/TUSD para sistemas de armazenamento de energia
