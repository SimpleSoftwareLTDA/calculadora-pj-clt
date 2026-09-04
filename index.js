/**
 * Calculadora PJ vs CLT para DEVs no Brasil e Exterior
 * Integração com APIs Abertas do Banco Central do Brasil (BACEN) e BrasilAPI
 * Alíquotas com tratamento para exportação de serviços (Simples Nacional LC 123/2006)
 */

const TABLES = {
    INSS_TETO: 7786.02,
    INSS_CLT: [
        { limit: 1412.00, rate: 0.075, deduction: 0 },
        { limit: 2666.68, rate: 0.090, deduction: 21.18 },
        { limit: 4000.03, rate: 0.120, deduction: 101.18 },
        { limit: 7786.02, rate: 0.140, deduction: 181.18 }
    ],
    IRPF: [
        { limit: 2259.20, rate: 0, deduction: 0 },
        { limit: 2826.65, rate: 0.075, deduction: 169.44 },
        { limit: 3751.05, rate: 0.150, deduction: 381.44 },
        { limit: 4664.68, rate: 0.225, deduction: 662.77 },
        { limit: Infinity, rate: 0.275, deduction: 896.00 }
    ],
    // Simples Nacional - Mercado Nacional
    SIMPLES_DOMESTIC_III: 0.060, // Anexo III padrão
    SIMPLES_DOMESTIC_V: 0.155,   // Anexo V padrão

    // Simples Nacional - Exportação de Serviços (Isenção PIS, COFINS, ISS - LC 123/2006)
    SIMPLES_EXPORT_III: 0.0305,  // Anexo III exportação (~3,05% IRPJ + CSLL + CPP)
    SIMPLES_EXPORT_V: 0.0930     // Anexo V exportação (~9,30%)
};

// Estado Global da Aplicação
const appState = {
    selectedCurrency: 'BRL',
    minWage: 1621.00, // Fallback oficial BACEN SGS 1619
    ptaxRate: 5.10,   // Fallback oficial BACEN SGS 1
    ipcaRate: 4.44,   // Fallback IPCA 12m
    selicRate: 14.00  // Fallback Selic
};

// Mapeamento dos elementos do DOM
const dom = {
    // API Status
    statusDot: document.getElementById('status-dot'),
    statusText: document.getElementById('api-status-text'),
    tagPtax: document.getElementById('tag-ptax'),
    tagSalarioMinimo: document.getElementById('tag-salario-minimo'),
    tagIpca: document.getElementById('tag-ipca'),

    // Moeda & Alternadores
    btnCurrBrl: document.getElementById('btn-curr-brl'),
    btnCurrUsd: document.getElementById('btn-curr-usd'),
    currencySymbol: document.getElementById('pj-currency-symbol'),
    labelPjRate: document.getElementById('label-pj-rate'),
    intlFieldsGrid: document.getElementById('intl-fields-grid'),
    conversionPreview: document.getElementById('conversion-preview'),
    pjConvertedBrl: document.getElementById('pj-converted-brl'),

    // Entradas CLT
    cltSalary: document.getElementById('clt-salary'),
    cltBenefits: document.getElementById('clt-benefits'),

    // Entradas PJ
    pjRate: document.getElementById('pj-rate'),
    pjExchangeRate: document.getElementById('pj-exchange-rate'),
    pjSpread: document.getElementById('pj-spread'),
    pjAccounting: document.getElementById('pj-accounting'),
    pjExport: document.getElementById('pj-export'),
    pjFatorR: document.getElementById('pj-fator-r'),
    labelFatorR: document.getElementById('label-fator-r'),

    // Saídas CLT
    cltNetMonthly: document.getElementById('clt-net-monthly'),
    cltNetAnnual: document.getElementById('clt-net-annual'),
    cltTaxInss: document.getElementById('clt-tax-inss'),
    cltTaxIrpf: document.getElementById('clt-tax-irpf'),
    cltTotalFgts: document.getElementById('clt-total-fgts'),

    // Saídas PJ
    pjNetMonthly: document.getElementById('pj-net-monthly'),
    pjNetMonthlyUsdRow: document.getElementById('pj-net-monthly-usd-row'),
    pjNetMonthlyUsd: document.getElementById('pj-net-monthly-usd'),
    pjNetAnnual: document.getElementById('pj-net-annual'),
    pjTaxDas: document.getElementById('pj-tax-das'),
    pjTaxInss: document.getElementById('pj-tax-inss'),
    pjTaxIrpf: document.getElementById('pj-tax-irpf'),
    pjSpreadLine: document.getElementById('pj-spread-line'),
    pjCostSpread: document.getElementById('pj-cost-spread'),

    // Comparativo & Veredito
    comparisonFill: document.getElementById('comparison-fill'),
    verdictText: document.getElementById('verdict-text'),
    breakEvenPj: document.getElementById('break-even-pj'),
    breakEvenPjUsd: document.getElementById('break-even-pj-usd'),
    annualDiff: document.getElementById('annual-diff')
};

// Funções de Formatação
function formatBRL(value) {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatUSD(value) {
    return Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

// Funções de Cálculo Fiscal CLT
function calculateINSS_CLT(gross) {
    if (gross <= 0) return 0;
    const maxContribution = 908.85;
    if (gross >= TABLES.INSS_TETO) return maxContribution;

    for (const bracket of TABLES.INSS_CLT) {
        if (gross <= bracket.limit) {
            return Math.max(0, (gross * bracket.rate) - bracket.deduction);
        }
    }
    return maxContribution;
}

function calculateIRPF(taxableIncome) {
    if (taxableIncome <= 0) return 0;
    for (const bracket of TABLES.IRPF) {
        if (taxableIncome <= bracket.limit) {
            return Math.max(0, (taxableIncome * bracket.rate) - bracket.deduction);
        }
    }
    return 0;
}

function calculateCLT(gross, benefits) {
    const inss = calculateINSS_CLT(gross);
    const taxableIncome = Math.max(0, gross - inss);
    const irpf = calculateIRPF(taxableIncome);

    const netSalaryMonthly = gross - inss - irpf;
    const netMonthlyWithBenefits = netSalaryMonthly + benefits;

    // Anual: 13,33 salários líquidos (12 meses + 13º + 1/3 de férias) + 12 meses benefícios + FGTS (8% s/ 13,33)
    const fgtsAnual = gross * 13.33 * 0.08;
    const netAnnual = (netSalaryMonthly * 13.33) + (benefits * 12) + fgtsAnual;

    return {
        netMonthly: netMonthlyWithBenefits,
        netAnnual: netAnnual,
        breakdown: { inss, irpf, netSalary: netSalaryMonthly, fgtsAnual }
    };
}

// Funções de Cálculo Fiscal PJ
function calculatePJ(grossInput, currency, exchangeRate, spreadPercent, accounting, isExport, useFatorR, minWage) {
    let effectiveExchangeRate = 1;
    let grossBRL = grossInput;
    let cambioCost = 0;

    if (currency === 'USD') {
        effectiveExchangeRate = exchangeRate * (1 - (spreadPercent / 100));
        grossBRL = grossInput * effectiveExchangeRate;
        cambioCost = grossInput * exchangeRate * (spreadPercent / 100);
    }

    // Alíquota Simples Nacional
    let taxRate;
    if (isExport) {
        taxRate = useFatorR ? TABLES.SIMPLES_EXPORT_III : TABLES.SIMPLES_EXPORT_V;
    } else {
        taxRate = useFatorR ? TABLES.SIMPLES_DOMESTIC_III : TABLES.SIMPLES_DOMESTIC_V;
    }

    const das = grossBRL * taxRate;

    // Pró-labore: para Anexo III é necessário ao menos 28% do faturamento, respeitando o salário mínimo
    let proLabore = 0;
    let inssPL = 0;
    let irpfPL = 0;

    if (useFatorR) {
        proLabore = Math.max(minWage, grossBRL * 0.28);
    } else {
        // Sem Fator R, o sócio que trabalha retira no mínimo o piso previdenciário (salário mínimo)
        proLabore = minWage;
    }

    // INSS do Sócio no Simples Nacional: 11% fixo até o teto do INSS (Contribuinte Individual)
    const inssBase = Math.min(proLabore, TABLES.INSS_TETO);
    inssPL = inssBase * 0.11;

    // IRPF sobre o Pró-labore
    const taxablePL = Math.max(0, proLabore - inssPL);
    irpfPL = calculateIRPF(taxablePL);

    const totalTaxes = das + inssPL + irpfPL;
    const netMonthlyBRL = grossBRL - totalTaxes - accounting;
    const netAnnualBRL = netMonthlyBRL * 12;

    const netMonthlyUSD = effectiveExchangeRate > 0 ? (netMonthlyBRL / effectiveExchangeRate) : 0;

    return {
        grossBRL,
        das,
        proLabore,
        inssPL,
        irpfPL,
        accounting,
        cambioCost,
        effectiveExchangeRate,
        netMonthlyBRL,
        netAnnualBRL,
        netMonthlyUSD
    };
}

// Cálculo Exato de Break-Even (Convergência Numérica)
function calculateBreakEven(targetAnnualCLT, currency, exchangeRate, spreadPercent, accounting, isExport, useFatorR, minWage) {
    if (targetAnnualCLT <= 0) return { breakEvenBRL: 0, breakEvenUSD: 0 };

    let low = 0;
    let high = Math.max(10000, targetAnnualCLT * 2);
    let breakEvenBRL = 0;

    // Busca binária com 30 iterações (precisão de centavos)
    for (let i = 0; i < 30; i++) {
        const mid = (low + high) / 2;
        const sim = calculatePJ(mid, 'BRL', 1, 0, accounting, isExport, useFatorR, minWage);
        if (sim.netAnnualBRL < targetAnnualCLT) {
            low = mid;
        } else {
            high = mid;
        }
        breakEvenBRL = mid;
    }

    const effectiveExchangeRate = exchangeRate * (1 - (spreadPercent / 100));
    const breakEvenUSD = effectiveExchangeRate > 0 ? (breakEvenBRL / effectiveExchangeRate) : 0;

    return { breakEvenBRL, breakEvenUSD };
}

// Atualização da Interface
function updateUI() {
    const cltVal = parseFloat(dom.cltSalary.value) || 0;
    const cltBen = parseFloat(dom.cltBenefits.value) || 0;
    const pjInputVal = parseFloat(dom.pjRate.value) || 0;
    const exchangeRate = parseFloat(dom.pjExchangeRate.value) || appState.ptaxRate;
    const spreadVal = parseFloat(dom.pjSpread.value) || 0;
    const pjAcc = parseFloat(dom.pjAccounting.value) || 0;
    const isExport = dom.pjExport.checked;
    const useFatorR = dom.pjFatorR.checked;
    const currency = appState.selectedCurrency;

    // Atualiza label do Fator R conforme status de exportação
    if (isExport) {
        dom.labelFatorR.textContent = 'Aplicar Fator R (Anexo III - ~3,05% exportação / 9,30% sem Fator R)';
    } else {
        dom.labelFatorR.textContent = 'Aplicar Fator R (Anexo III - 6,00% nacional / 15,50% sem Fator R)';
    }

    // Cálculos
    const cltResult = calculateCLT(cltVal, cltBen);
    const pjResult = calculatePJ(pjInputVal, currency, exchangeRate, spreadVal, pjAcc, isExport, useFatorR, appState.minWage);

    // Renderização dos Resultados CLT
    dom.cltNetMonthly.textContent = formatBRL(cltResult.netMonthly);
    dom.cltNetAnnual.textContent = formatBRL(cltResult.netAnnual);
    dom.cltTaxInss.textContent = formatBRL(cltResult.breakdown.inss);
    dom.cltTaxIrpf.textContent = formatBRL(cltResult.breakdown.irpf);
    dom.cltTotalFgts.textContent = formatBRL(cltResult.breakdown.fgtsAnual);

    // Renderização dos Resultados PJ
    dom.pjNetMonthly.textContent = formatBRL(pjResult.netMonthlyBRL);
    dom.pjNetAnnual.textContent = formatBRL(pjResult.netAnnualBRL);
    dom.pjTaxDas.textContent = formatBRL(pjResult.das);
    dom.pjTaxInss.textContent = formatBRL(pjResult.inssPL);
    dom.pjTaxIrpf.textContent = formatBRL(pjResult.irpfPL);

    if (currency === 'USD') {
        dom.conversionPreview.style.display = 'block';
        dom.pjConvertedBrl.textContent = formatBRL(pjResult.grossBRL);
        dom.pjNetMonthlyUsdRow.style.display = 'flex';
        dom.pjNetMonthlyUsd.textContent = formatUSD(pjResult.netMonthlyUSD);
        dom.pjSpreadLine.style.display = 'flex';
        dom.pjCostSpread.textContent = formatBRL(pjResult.cambioCost);
    } else {
        dom.conversionPreview.style.display = 'none';
        dom.pjNetMonthlyUsdRow.style.display = 'none';
        dom.pjSpreadLine.style.display = 'none';
    }

    // Comparativo e Veredito
    const diff = pjResult.netAnnualBRL - cltResult.netAnnual;
    const isPjBetter = diff >= 0;
    const baseAnnual = cltResult.netAnnual > 0 ? cltResult.netAnnual : 1;
    const percentage = (Math.abs(diff) / baseAnnual * 100).toFixed(1);
    const winner = isPjBetter ? 'PJ' : 'CLT';
    const loser = isPjBetter ? 'CLT' : 'PJ';

    dom.verdictText.innerHTML = `${winner} é <span class="percentage" style="color: ${isPjBetter ? 'var(--success)' : 'var(--danger)'}">${percentage}%</span> mais vantajoso que ${loser}.`;

    // Barra proporcional
    const totalAnnual = pjResult.netAnnualBRL + cltResult.netAnnual;
    const ratio = totalAnnual > 0 ? Math.min(100, Math.max(5, (pjResult.netAnnualBRL / totalAnnual) * 100)) : 50;
    dom.comparisonFill.style.width = `${ratio}%`;

    // Diferença Anual
    dom.annualDiff.textContent = `${diff >= 0 ? '+' : ''} ${formatBRL(diff)}`;
    dom.annualDiff.style.color = isPjBetter ? 'var(--success)' : 'var(--danger)';

    // Ponto de Equilíbrio (Break-Even)
    const breakEven = calculateBreakEven(cltResult.netAnnual, currency, exchangeRate, spreadVal, pjAcc, isExport, useFatorR, appState.minWage);
    dom.breakEvenPj.textContent = `${formatBRL(breakEven.breakEvenBRL)} / mês`;

    if (currency === 'USD' || isExport) {
        dom.breakEvenPjUsd.style.display = 'block';
        dom.breakEvenPjUsd.textContent = `Equivalente: ${formatUSD(breakEven.breakEvenUSD)} / mês`;
    } else {
        dom.breakEvenPjUsd.style.display = 'none';
    }
}

// Alternância de Moeda
function setCurrency(currency) {
    appState.selectedCurrency = currency;
    if (currency === 'USD') {
        dom.btnCurrUsd.classList.add('active');
        dom.btnCurrBrl.classList.remove('active');
        dom.currencySymbol.textContent = '$';
        dom.labelPjRate.textContent = 'Valor da Proposta Mensal (em USD)';
        dom.intlFieldsGrid.style.display = 'grid';
        if (parseFloat(dom.pjRate.value) > 10000) {
            dom.pjRate.value = '4000';
            dom.pjRate.step = '250';
        }
    } else {
        dom.btnCurrBrl.classList.add('active');
        dom.btnCurrUsd.classList.remove('active');
        dom.currencySymbol.textContent = 'R$';
        dom.labelPjRate.textContent = 'Valor da Nota Fiscal Mensal (em R$)';
        dom.intlFieldsGrid.style.display = 'none';
        if (parseFloat(dom.pjRate.value) <= 10000) {
            dom.pjRate.value = '18000';
            dom.pjRate.step = '500';
        }
    }
    updateUI();
}

// Integração com APIs Abertas do Governo
async function fetchGovernmentData() {
    let ptaxLoaded = false;
    let minWageLoaded = false;
    let ipcaLoaded = false;

    // 1. Cotação do Dólar PTAX (Banco Central do Brasil - SGS Série 1)
    try {
        const res = await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados/ultimos/1?formato=json', { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0 && data[0].valor) {
                const parsedRate = parseFloat(data[0].valor);
                if (!isNaN(parsedRate) && parsedRate > 0) {
                    appState.ptaxRate = parsedRate;
                    dom.pjExchangeRate.value = parsedRate.toFixed(2);
                    dom.tagPtax.textContent = `Dólar PTAX (BACEN): R$ ${parsedRate.toFixed(2)} (${data[0].data})`;
                    ptaxLoaded = true;
                }
            }
        }
    } catch (e) {
        dom.tagPtax.textContent = `Dólar PTAX (Ref): R$ ${appState.ptaxRate.toFixed(2)}`;
    }

    // 2. Salário Mínimo Nacional (Banco Central do Brasil - SGS Série 1619)
    try {
        const res = await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.1619/dados/ultimos/1?formato=json', { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0 && data[0].valor) {
                const parsedWage = parseFloat(data[0].valor);
                if (!isNaN(parsedWage) && parsedWage > 0) {
                    appState.minWage = parsedWage;
                    dom.tagSalarioMinimo.textContent = `Salário Mínimo: R$ ${parsedWage.toFixed(2)}`;
                    minWageLoaded = true;
                }
            }
        }
    } catch (e) {
        dom.tagSalarioMinimo.textContent = `Salário Mínimo (Ref): R$ ${appState.minWage.toFixed(2)}`;
    }

    // 3. Indicadores de Inflação e Juros (BrasilAPI / BACEN)
    try {
        const res = await fetch('https://brasilapi.com.br/api/taxas/v1', { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
                const ipcaObj = data.find(t => t.nome === 'IPCA');
                if (ipcaObj && ipcaObj.valor) {
                    appState.ipcaRate = parseFloat(ipcaObj.valor);
                    dom.tagIpca.textContent = `IPCA 12m: ${appState.ipcaRate}%`;
                    ipcaLoaded = true;
                }
            }
        }
    } catch (e) {
        dom.tagIpca.textContent = `IPCA 12m: ${appState.ipcaRate}%`;
    }

    // Atualiza status global de conectividade
    if (ptaxLoaded || minWageLoaded || ipcaLoaded) {
        dom.statusDot.className = 'status-dot online';
        dom.statusText.textContent = 'Dados oficiais sincronizados em tempo real (BACEN / BrasilAPI)';
    } else {
        dom.statusDot.className = 'status-dot';
        dom.statusText.textContent = 'Parâmetros econômicos oficiais carregados (modo offline/referência)';
    }

    updateUI();
}

// Configuração dos Event Listeners
function setupListeners() {
    dom.btnCurrBrl.addEventListener('click', () => setCurrency('BRL'));
    dom.btnCurrUsd.addEventListener('click', () => setCurrency('USD'));

    const triggerInputs = [
        dom.cltSalary,
        dom.cltBenefits,
        dom.pjRate,
        dom.pjExchangeRate,
        dom.pjSpread,
        dom.pjAccounting,
        dom.pjExport,
        dom.pjFatorR
    ];

    triggerInputs.forEach(input => {
        input.addEventListener('input', updateUI);
        input.addEventListener('change', updateUI);
    });
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    setupListeners();
    updateUI();
    fetchGovernmentData();
});
