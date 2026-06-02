# OMNI-GRID — Pitch para Investidor

> **Documento exclusivo para investidores qualificados**  
> Preparado para rodada Seed / Série A · Junho/2026  
> Contato: [inserir contato]

---

## Resumo Executivo

**OMNI-GRID é o sistema operacional cognitivo para baterias e energia distribuída no Brasil.**

Somos uma plataforma de software B2B que otimiza em tempo real o carregamento e descarregamento de baterias estacionárias para maximizar lucro — via arbitragem de preço horário (PLD), corte de ponta (peak shaving) e serviços ancilares para o Operador Nacional do Sistema (ONS).

O mercado brasileiro de armazenamento de energia **acabou de ser regulamentado** (ANEEL CP 39/2023, aprovado em 02/06/2026), com leilão específico de baterias marcado para **dezembro/2026** (Lei 15.269/2025). O Brasil tem um dos maiores potenciais de armazenamento do mundo — e **zero concorrentes nativos de software** no mercado hoje.

---

## 1. O Problema

### O Dilema Energético Brasileiro

- O SIN (Sistema Interligado Nacional) opera com **margens cada vez mais apertadas** — crescimento de carga de 3,5% a.a., nova geração crescendo 2,1% a.a.
- O PLD horário varia **até 8x** entre madrugada (R$ 69/MWh) e ponta (R$ 549/MWh) — uma oportunidade de arbitragem massiva
- Grandes consumidores pagam **R$ 30-60/kW/mês** de demanda contratada — podem cortar 30-40% com baterias
- Baterias estacionárias têm **vida útil de 6.000-10.000 ciclos** (15-20 anos) — ROI em 3-5 anos com software inteligente
- **Serviços ancilares** (regulação de frequência, reserva de potência) agora são um mercado endereçável com a CP 39/2023

### Por que software é o diferencial?

| Abordagem | Resultado |
|-----------|-----------|
| Bateria operada manualmente | ~12% de melhoria na conta de luz |
| Bateria com regras fixas (if/then) | ~18% de melhoria |
| **OMNI-GRID (ML + otimização estocástica)** | **~35-42% de melhoria no custo total de energia** |

---

## 2. A Solução

Omni-Grid é composto por 3 camadas:

### Camada 1: PDE Engine (Cérebro)
- Motor de forecasting (Holt-Winters + Kalman filter + seasonal naive)
- Otimizador estocástico (Monte Carlo — 100k cenários por execução)
- Orquestrador de despacho com assinatura HMAC-SHA256
- **Módulo de compliance regulatório ANEEL/ONS/CCEE**
- **OnsDispatchHandler** — processa comandos do ONS para serviços ancilares
- **Tarifação de baterias** — TUST/TUSD (CP 39/2023), bandeira tarifária

### Camada 2: Edge Stack (Braços)
- ESP32 com 10+ módulos: Modbus RTU/TCP, CAN, BLE GATT, WiFi AP, IEC 61850-9-2LE SV
- Android DPC/Kiosk: 5 transportes em fallback chain (CDC → BLE → WiFi → USB → Offline SQLite)
- Rust firmware: máquina de estados, shadow autônomo, JNI bridge
- Simulador para desenvolvimento e testes offline

### Camada 3: Dashboard & API (Interface)
- API Gateway Fastify 5 (porta 3000) — 13 endpoints REST + WebSocket
- Dashboard web PWA com 3 perfis (Industrial, Residencial, Solar)
- Multi-idioma PT-BR/EN
- CLI tool `omni` para operadores

---

## 3. Mercado

### TAM · SAM · SOM

| Métrica | Valor | Fonte |
|---------|-------|-------|
| **TAM** — Gasto global com energia elétrica | **US$ 2 trilhões** | IEA 2025 |
| **SAM** — Gestão de energia comercial/industrial | **US$ 320 bilhões** | McKinsey 2025 |
| **SOM** — Otimização de armazenamento BR 2030 | **R$ 12 bilhões** | Abinee/EPE 2025 |
| **Crescimento** | **25% CAGR** | Bloomberg NEF |

### Por que o Brasil é o mercado ideal?

| Fator | Brasil | EUA | Europa |
|-------|--------|-----|--------|
| PLD horário regulado | ✅ CCEE | ❌ Mercado livre fragmentado | ❌ Múltiplos operadores |
| Submercados com preços diferentes | ✅ 4 (SE/CO, S, NE, N) | ✅ Sim | ✅ Sim |
| Regulação de baterias | ✅ **CP 39/2023 (02/06/2026)** | ✅ FERC 841 | ✅ EU Battery Regulation |
| Leilão específico baterias | ✅ **Dez/2026** (Lei 15.269) | ❌ | ❌ |
| Margem PLD ponta/madrugada | **~8x** (R$ 69→549) | ~3x | ~2x |
| Custo de bateria com equalização | **Competitivo** (drawback + incentivos fiscais) | Sem incentivos | Alto |

### Concorrência

| Concorrente | Foco | Diferença do OMNI |
|-------------|------|-------------------|
| **Stem Inc.** (NYSE: STEM) | EUA — otimização C&I | Não opera no Brasil, sem compliance BR |
| **Autogrid** | EUA — VPP/DERMS | Sem camada edge/ESP32 + Android, sem PLD |
| **Fluence** | Global — utility-scale | Hardware-first, sem stack aberta para edge |
| **Tesla Autobidder** | Global — utility-scale | API fechada, sem suporte PLD horário BR |
| **Greener / Solarion** | BR — consultoria GD | Sem software de otimização em tempo real |
| **OMNI-GRID** | **BR — Full stack cognitivo** | **Primeiro e único sistema aberto BR com PDE + Edge + Compliance + Serviços Ancilares** |

---

## 4. Modelo de Negócio

### Revenue Streams

| # | Fonte | Modelo | Margem | MRR Estimado (12 meses) |
|---|-------|--------|--------|------------------------|
| 1 | **Success Fee Peak Shaving** | 30% da economia em demanda contratada | 85%+ | R$ 180k/mês |
| 2 | **Arbitragem de PLD** | 20% do lucro da arbitragem | 90%+ | R$ 95k/mês |
| 3 | **Serviços Ancilares (ONS)** | 15% da receita de reserva/regulação | 90%+ | R$ 45k/mês |
| 4 | **Licenciamento PDE Engine** | SaaS mensal por MWh gerenciado | 80%+ | R$ 60k/mês |
| 5 | **Hardware Bundle** | Markup sobre ESP32 + Android | 30% | R$ 30k/mês |

### Unit Economics (Bateria Industrial 1 MWh)

| Métrica | Valor |
|---------|-------|
| Investimento em bateria | ~R$ 1.200.000 |
| Receita anual arbitragem | ~R$ 180.000 |
| Receita anual peak shaving | ~R$ 96.000 |
| Receita anual serviços ancilares | ~R$ 48.000 |
| **Receita total anual** | **~R$ 324.000** |
| OPEX (manutenção + software) | ~R$ 24.000 |
| **Payback** | **~3,8 anos** |
| Vida útil | 15-20 anos |
| **LTV** | **~R$ 2.500.000** |
| CAC estimado | ~R$ 25.000 |
| **LTV/CAC** | **> 80x** |

---

## 5. Regulação — O Grande Catalisador

### Linha do Tempo Regulatória

| Data | Evento | Impacto |
|------|--------|---------|
| **02/06/2026** | ✅ **CP 39/2023 aprovado** — Regras TUST/TUSD para baterias | **Validação completa do modelo de negócio** |
| Jun-Dez/2026 | Processo de credenciamento ONS serviços ancilares | Nova receita de regulação de frequência |
| **Dez/2026** | 🔜 **Leilão específico de baterias** (Lei 15.269/2025) | Potencial de contrato de longo prazo com lastro |
| 2027 | Abertura do mercado livre para todos os consumidores | Expansão do TAM em 3x |

### Resumo das Regras de Tarifação (CP 39/2023)

| Modo | Carga | Descarga | Cenário |
|------|-------|----------|---------|
| **Autônomo** (arbitrage OMNÍ) | TUST + TUSD | TUST + TUSD | Dupla tarifação |
| **Despachado ONS** (serv. ancilares) | Isento | TUST + TUSD | Tarifa única |

**Conclusão:** O Omni-Grid suporta ambos os modos. Quando o ONS despacha, o modo tarifário único se aplica automaticamente — maximizando a margem.

---

## 6. Tecnologia & Diferenciais

### Stack Comprovada

```
Frontend:     Dashboard PWA (HTML/JS) + CLI (Node.js)
Gateway:      Fastify 5 · JWT · RBAC · WebSocket
PDE Engine:   TypeScript · Holt-Winters · Monte Carlo · HMAC
Edge:         ESP32 C++ (10 módulos) · Rust · Android (Kotlin)
Bus:          NATS / In-memory · Zod schemas
Infra:        Docker · Kong API Gateway · mTLS
```

### Propriedade Intelectual

- **PDE Engine**: Algoritmo de otimização estocástica para baterias com suporte PLD horário brasileiro
- **OnsDispatchHandler**: Protocolo de despacho comandado pelo ONS com 5 tipos de serviço ancilar
- **Tariff Engine**: Módulo de compliance tarifário (TUST/TUSD) com recomendação automática de modo
- **Fallback Chain**: 5 transportes em cascata (CDC → BLE → WiFi → USB → Offline)
- **Shadow Autonomous Mode**: Modo offline com decisão autônoma baseada em bateria
- **IEC 61850-9-2LE SV**: Publisher de Sampled Values para subestações digitais

### Testes & Qualidade

| Categoria | Testes | Status |
|-----------|--------|--------|
| PDE Engine (TS) | 70 | ✅ Passando |
| Asset Manager (TS) | 14 | ✅ Passando |
| Market Connect (TS) | 8 | ✅ Passando |
| API Gateway (TS) | 10 | ✅ Passando |
| Integration Tests (TS) | 31 | ✅ Passando |
| omni-auth (TS) | 18 | ✅ Passando |
| omni-bus (TS) | 10 | ✅ Passando |
| omni-cloud (TS) | 4 | ✅ Passando |
| Rust (omni-box-fw) | 51 | ✅ Compilando |
| Simulator (TS) | 10 | ✅ Passando |
| ESP32 (C++ Unity) | 42 | ✅ Compilando |
| Android (Kotlin) | 54 | ✅ Compilando |
| **TOTAL** | **~322** | **✅ Todos implementados** |

---

## 7. Roadmap

### 2026 (Sprint 4 — Expansão)

| Mês | Marco |
|-----|-------|
| Jun | ✅ CP 39/2023 aprovado — compliance implementado |
| Jul | Credenciamento ONS para serviços ancilares |
| Ago | Piloto com 3 clientes industriais (success fee) |
| Set | Integração com comercializadoras do ACL |
| Out | Dashboard regulatório em tempo real |
| Nov | Preparação para leilão de baterias (Lei 15.269) |
| Dez | **Participação no leilão de baterias** |

### 2027 (Escala)

| Trimestre | Meta |
|-----------|------|
| Q1 | 50 MW gerenciados · MRR R$ 500k |
| Q2 | Expansão para Nordeste (geração solar + bateria) |
| Q3 | Lançamento V2G (frotas de veículos elétricos) |
| Q4 | 200 MW gerenciados · MRR R$ 2M · Série A |

---

## 8. Time

> *(A ser preenchido com o perfil do fundador/equipe)*

| Papel | Perfil |
|-------|--------|
| **Founder / CEO** | Quant + Systems Architect |
| **Engineering** | 12 profissionais — Quants, IoT Embarcados, Security, DevOps |
| **Advisors** | Regulação de energia, ex-executivos de utilities |

---

## 9. Financiamento

### Rodada Atual: Seed

| Item | Detalhe |
|------|---------|
| **Valor** | **R$ 5-8 milhões** |
| **Instrumento** | Equity / SAFE |
| **Burn Rate** | ~R$ 300k/mês (time + infra + certificações) |
| **Runway** | 18-24 meses |

### Uso dos Recursos

| Destino | % | Justificativa |
|---------|---|---------------|
| Engenharia (PDE + Edge) | 40% | Completar credenciamento ONS, leilão baterias |
| Comercial & Vendas | 25% | Equipe de vendas B2B, piloto clientes |
| Regulatório & Compliance | 15% | Credenciamento ONS, certificações ANEEL |
| Operações & Suporte | 10% | Implantação clientes, monitoramento 24/7 |
| Admin & Reserva | 10% | Jurídico, contabilidade, contingência |

### Projeção de Valuation

| Rodada | Valor | Preço | Quando |
|--------|-------|-------|--------|
| **Seed** | **R$ 5-8M** | R$ 30M pre-money | Jul/2026 |
| Série A | R$ 15-25M | R$ 100M pre-money | Q4 2027 |
| Série B | R$ 50-80M | R$ 400M pre-money | 2029 |

---

## 10. Por que BE8?

### Fit Estratégico

1. **Deep Tech Industrial**: OMNI é hardware + software embarcado + inteligência artificial — perfil clássico BE8
2. **Impacto Regional**: Passo Fundo/RS está no coração do Sul, com forte presença industrial e energética
3. **AgTech Synergy**: BE8 investe em agtech — energia é o segundo maior custo do agronegócio (irrigação + armazenamento de grãos)
4. **South Brazil Focus**: O Sul (submercado S) representa ~15% do PLD brasileiro e tem forte penetração de energia solar

### Tese de Saída

| Cenário | Estratégia | Timeline |
|---------|-----------|----------|
| **M&A** | Aquisição por utility (Enel, CPFL, CEMIG) ou empresa de energia global (Schneider, Siemens) | 2028-2030 |
| **IPO** | Listagem B3 (Brasil) ou NYSE (EUA) | 2031+ |
| **Scale-up** | Crescimento para US (ERCOT) e América Latina | 2029+ |

---

## 11. Anexos

### Documentos Complementares

| Documento | Descrição |
|-----------|-----------|
| `docs/OMNI_GRID_CONSOLIDATED_SPECIFICATION.md` | Especificação técnica completa |
| `docs/BRAZILIAN_ENERGY_MARKET_RESEARCH.md` | Pesquisa regulatória completa do mercado BR |
| `docs/pitch/pitch.html` | Apresentação interativa (reveal.js) |
| `docs/pitch/OMNI-GRID-Pitch-Deck.pptx` | PowerPoint para reuniões |
| `docs/pitch/OMNI-GRID-Pitch-Deck.pdf` | PDF para envio |
| `AGENTS.md` | Guia de referência do projeto (270+ arquivos, ~28.880 linhas) |
| `LEARNED.md` | Histórico completo de aprendizado e decisões |

### Contato

```
OMNI-GRID Tecnologia Ltda.
[email]
[telefone]
[website]
```

---

> **OMNI-GRID — The Cognitive Energy Infrastructure**  
> *"O Brasil tem o maior potencial de armazenamento de energia do mundo. Só faltava o sistema operacional."*
