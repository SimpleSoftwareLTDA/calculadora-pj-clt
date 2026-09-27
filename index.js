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

// Mapeamento dinâmico e seguro dos elementos do DOM
let dom = {};

function initDom() {
    const get = (id) => document.getElementById(id);
    dom = {
        // API Status
        statusDot: get('status-dot'),
        statusText: get('api-status-text'),
        tagPtax: get('tag-ptax'),
        tagSalarioMinimo: get('tag-salario-minimo'),
        tagIpca: get('tag-ipca'),

        // Moeda & Alternadores
        btnCurrBrl: get('btn-curr-brl'),
        btnCurrUsd: get('btn-curr-usd'),
        currencySymbol: get('pj-currency-symbol'),
        labelPjRate: get('label-pj-rate'),
        intlFieldsGrid: get('intl-fields-grid'),
        conversionPreview: get('conversion-preview'),
        pjConvertedBrl: get('pj-converted-brl'),

        // Entradas CLT
        cltSalary: get('clt-salary'),
        cltBenefits: get('clt-benefits'),

        // Entradas PJ
        pjRate: get('pj-rate'),
        pjExchangeRate: get('pj-exchange-rate'),
        pjSpread: get('pj-spread'),
        pjAccounting: get('pj-accounting'),
        pjExport: get('pj-export'),
        pjFatorR: get('pj-fator-r'),
        labelFatorR: get('label-fator-r'),

        // Saídas CLT
        cltNetMonthly: get('clt-net-monthly'),
        cltNetAnnual: get('clt-net-annual'),
        cltTaxInss: get('clt-tax-inss'),
        cltTaxIrpf: get('clt-tax-irpf'),
        cltTotalFgts: get('clt-total-fgts'),

        // Saídas PJ
        pjNetMonthly: get('pj-net-monthly'),
        pjNetMonthlyUsdRow: get('pj-net-monthly-usd-row'),
        pjNetMonthlyUsd: get('pj-net-monthly-usd'),
        pjNetAnnual: get('pj-net-annual'),
        pjTaxDas: get('pj-tax-das'),
        pjTaxInss: get('pj-tax-inss'),
        pjTaxIrpf: get('pj-tax-irpf'),
        pjSpreadLine: get('pj-spread-line'),
        pjCostSpread: get('pj-cost-spread'),

        // Comparativo & Veredito
        comparisonFill: get('comparison-fill'),
        comparisonMeter: get('comparison-meter'),
        verdictText: get('verdict-text'),
        breakEvenPj: get('break-even-pj'),
        breakEvenPjUsd: get('break-even-pj-usd'),
        annualDiff: get('annual-diff'),

        // Ações de Compartilhamento
        btnShareLink: get('btn-share-link'),
        btnCopySummary: get('btn-copy-summary'),

        // Captura de Lead
        leadForm: get('lead-form'),
        leadName: get('lead-name'),
        leadEmail: get('lead-email'),
        btnSubmitLead: get('btn-submit-lead'),
        btnLeadText: get('btn-lead-text'),
        leadFeedback: get('lead-feedback'),

        // Toast de Notificação Flutuante
        toastMsg: get('toast-msg')
    };
}

// Funções de Formatação
function formatBRL(value) {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatUSD(value) {
    return Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

// Funções de Cálculo Fiscal CLT
function calculateINSS_CLT(gross) {
    if (!gross || gross <= 0 || isNaN(gross)) return 0;
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
    if (!taxableIncome || taxableIncome <= 0 || isNaN(taxableIncome)) return 0;
    for (const bracket of TABLES.IRPF) {
        if (taxableIncome <= bracket.limit) {
            return Math.max(0, (taxableIncome * bracket.rate) - bracket.deduction);
        }
    }
    return 0;
}

function calculateCLT(gross, benefits) {
    const validGross = Math.max(0, parseFloat(gross) || 0);
    const validBenefits = Math.max(0, parseFloat(benefits) || 0);

    const inss = calculateINSS_CLT(validGross);
    const taxableIncome = Math.max(0, validGross - inss);
    const irpf = calculateIRPF(taxableIncome);

    const netSalaryMonthly = validGross - inss - irpf;
    const netMonthlyWithBenefits = netSalaryMonthly + validBenefits;

    // Anual: 13,33 salários líquidos (12 meses + 13º + 1/3 de férias) + 12 meses benefícios + FGTS (8% s/ 13,33)
    const fgtsAnual = validGross * 13.33 * 0.08;
    const netAnnual = (netSalaryMonthly * 13.33) + (validBenefits * 12) + fgtsAnual;

    return {
        netMonthly: netMonthlyWithBenefits,
        netAnnual: netAnnual,
        breakdown: { inss, irpf, netSalary: netSalaryMonthly, fgtsAnual }
    };
}

function calculatePJ(grossInput, currency, exchangeRate, spreadPercent, accounting, isExport, useFatorR, minWage) {
    const validGrossInput = Math.max(0, parseFloat(grossInput) || 0);
    const validSpread = Math.min(100, Math.max(0, parseFloat(spreadPercent) || 0));
    let effectiveExchangeRate = 1;
    let grossBRL = validGrossInput;
    let cambioCost = 0;

    if (currency === 'USD') {
        effectiveExchangeRate = Math.max(0.01, exchangeRate * (1 - (validSpread / 100)));
        grossBRL = validGrossInput * effectiveExchangeRate;
        cambioCost = validGrossInput * exchangeRate * (validSpread / 100);
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

    if (grossBRL > 0) {
        if (useFatorR) {
            proLabore = Math.max(minWage, grossBRL * 0.28);
        } else {
            proLabore = minWage;
        }

        // INSS do Sócio no Simples Nacional: 11% fixo até o teto do INSS
        const inssBase = Math.min(proLabore, TABLES.INSS_TETO);
        inssPL = inssBase * 0.11;

        // IRPF sobre o Pró-labore
        const taxablePL = Math.max(0, proLabore - inssPL);
        irpfPL = calculateIRPF(taxablePL);
    }

    const totalTaxes = das + inssPL + irpfPL;
    const netMonthlyBRL = Math.max(0, grossBRL - totalTaxes - accounting);
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
    if (!targetAnnualCLT || targetAnnualCLT <= 0 || isNaN(targetAnnualCLT)) {
        return { breakEvenBRL: 0, breakEvenUSD: 0 };
    }

    let low = 0;
    let high = Math.max(10000, targetAnnualCLT * 2);
    let breakEvenBRL = 0;

    for (let i = 0; i < 30; i++) {
        const mid = (low + high) / 2;
        const sim = calculatePJ(mid, 'BRL', 1, 0, accounting, isExport, useFatorR, minWage);
        if (sim.netAnnualBRL >= targetAnnualCLT) {
            breakEvenBRL = mid;
            high = mid;
        } else {
            low = mid;
        }
    }

    const validSpread = Math.min(100, Math.max(0, parseFloat(spreadPercent) || 0));
    const effectiveRate = Math.max(0.01, exchangeRate * (1 - (validSpread / 100)));
    const breakEvenUSD = effectiveRate > 0 ? (breakEvenBRL / effectiveRate) : 0;

    return { breakEvenBRL, breakEvenUSD };
}

// Atualização da Interface
function updateUI() {
    const cltVal = dom.cltSalary ? (parseFloat(dom.cltSalary.value) || 0) : 10000;
    const cltBen = dom.cltBenefits ? (parseFloat(dom.cltBenefits.value) || 0) : 1000;
    const pjInputVal = dom.pjRate ? (parseFloat(dom.pjRate.value) || 0) : 18000;
    const exchangeRate = dom.pjExchangeRate ? (parseFloat(dom.pjExchangeRate.value) || appState.ptaxRate) : appState.ptaxRate;
    const spreadVal = dom.pjSpread ? (parseFloat(dom.pjSpread.value) || 0) : 1.0;
    const pjAcc = dom.pjAccounting ? (parseFloat(dom.pjAccounting.value) || 0) : 300;
    const isExport = dom.pjExport ? dom.pjExport.checked : true;
    const useFatorR = dom.pjFatorR ? dom.pjFatorR.checked : true;
    const currency = appState.selectedCurrency;

    // Atualiza rótulo do Fator R
    if (dom.labelFatorR) {
        if (isExport) {
            dom.labelFatorR.textContent = 'Aplicar Fator R (Anexo III: ~3,05% exportação / 9,30% sem Fator R)';
        } else {
            dom.labelFatorR.textContent = 'Aplicar Fator R (Anexo III: 6,00% nacional / 15,50% sem Fator R)';
        }
    }

    // Cálculos
    const cltResult = calculateCLT(cltVal, cltBen);
    const pjResult = calculatePJ(pjInputVal, currency, exchangeRate, spreadVal, pjAcc, isExport, useFatorR, appState.minWage);

    // Renderiza saídas CLT
    if (dom.cltNetMonthly) dom.cltNetMonthly.textContent = formatBRL(cltResult.netMonthly);
    if (dom.cltNetAnnual) dom.cltNetAnnual.textContent = formatBRL(cltResult.netAnnual);
    if (dom.cltTaxInss) dom.cltTaxInss.textContent = formatBRL(cltResult.breakdown.inss);
    if (dom.cltTaxIrpf) dom.cltTaxIrpf.textContent = formatBRL(cltResult.breakdown.irpf);
    if (dom.cltTotalFgts) dom.cltTotalFgts.textContent = formatBRL(cltResult.breakdown.fgtsAnual);

    // Renderiza saídas PJ
    if (dom.pjNetMonthly) dom.pjNetMonthly.textContent = formatBRL(pjResult.netMonthlyBRL);
    if (dom.pjNetAnnual) dom.pjNetAnnual.textContent = formatBRL(pjResult.netAnnualBRL);
    if (dom.pjTaxDas) dom.pjTaxDas.textContent = formatBRL(pjResult.das);
    if (dom.pjTaxInss) dom.pjTaxInss.textContent = formatBRL(pjResult.inssPL);
    if (dom.pjTaxIrpf) dom.pjTaxIrpf.textContent = formatBRL(pjResult.irpfPL);

    if (currency === 'USD') {
        if (dom.conversionPreview) dom.conversionPreview.style.display = 'block';
        if (dom.pjConvertedBrl) dom.pjConvertedBrl.textContent = formatBRL(pjResult.grossBRL);
        if (dom.pjNetMonthlyUsdRow) dom.pjNetMonthlyUsdRow.style.display = 'flex';
        if (dom.pjNetMonthlyUsd) dom.pjNetMonthlyUsd.textContent = formatUSD(pjResult.netMonthlyUSD);
        if (dom.pjSpreadLine) dom.pjSpreadLine.style.display = 'flex';
        if (dom.pjCostSpread) dom.pjCostSpread.textContent = formatBRL(pjResult.cambioCost);
    } else {
        if (dom.conversionPreview) dom.conversionPreview.style.display = 'none';
        if (dom.pjNetMonthlyUsdRow) dom.pjNetMonthlyUsdRow.style.display = 'none';
        if (dom.pjSpreadLine) dom.pjSpreadLine.style.display = 'none';
    }

    // Comparativo e Veredito
    const diff = pjResult.netAnnualBRL - cltResult.netAnnual;
    const isPjBetter = diff >= 0;
    const baseAnnual = cltResult.netAnnual > 0 ? cltResult.netAnnual : 1;
    const percentage = (Math.abs(diff) / baseAnnual * 100).toFixed(1);
    const winner = isPjBetter ? 'PJ' : 'CLT';
    const loser = isPjBetter ? 'CLT' : 'PJ';

    if (dom.verdictText) {
        dom.verdictText.textContent = '';
        const span = document.createElement('span');
        span.className = 'percentage';
        span.style.color = isPjBetter ? 'var(--success)' : 'var(--danger)';
        span.textContent = `${percentage}%`;
        dom.verdictText.append(
            document.createTextNode(`${winner} é `),
            span,
            document.createTextNode(` mais vantajoso que ${loser}.`)
        );
    }

    // Barra proporcional
    const totalAnnual = pjResult.netAnnualBRL + cltResult.netAnnual;
    const ratio = totalAnnual > 0 ? Math.min(100, Math.max(5, (pjResult.netAnnualBRL / totalAnnual) * 100)) : 50;
    if (dom.comparisonFill) {
        dom.comparisonFill.style.width = `${ratio}%`;
    }
    if (dom.comparisonMeter) {
        dom.comparisonMeter.setAttribute('aria-valuenow', Math.round(ratio));
    }

    // Diferença Anual
    if (dom.annualDiff) {
        dom.annualDiff.textContent = `${diff >= 0 ? '+' : ''} ${formatBRL(diff)}`;
        dom.annualDiff.style.color = isPjBetter ? 'var(--success)' : 'var(--danger)';
    }

    // Ponto de Equilíbrio (Break-Even)
    const breakEven = calculateBreakEven(cltResult.netAnnual, currency, exchangeRate, spreadVal, pjAcc, isExport, useFatorR, appState.minWage);
    if (dom.breakEvenPj) {
        dom.breakEvenPj.textContent = `${formatBRL(breakEven.breakEvenBRL)} / mês`;
    }

    if (dom.breakEvenPjUsd) {
        if (currency === 'USD' || isExport) {
            dom.breakEvenPjUsd.style.display = 'block';
            dom.breakEvenPjUsd.textContent = `Equivalente: ${formatUSD(breakEven.breakEvenUSD)} / mês`;
        } else {
            dom.breakEvenPjUsd.style.display = 'none';
        }
    }
}

// Alternância de Moeda
function setCurrency(currency) {
    appState.selectedCurrency = currency;
    const isUSD = currency === 'USD';

    if (dom.btnCurrUsd) {
        dom.btnCurrUsd.classList.toggle('active', isUSD);
        dom.btnCurrUsd.setAttribute('aria-pressed', isUSD ? 'true' : 'false');
    }
    if (dom.btnCurrBrl) {
        dom.btnCurrBrl.classList.toggle('active', !isUSD);
        dom.btnCurrBrl.setAttribute('aria-pressed', !isUSD ? 'true' : 'false');
    }

    if (isUSD) {
        if (dom.currencySymbol) dom.currencySymbol.textContent = '$';
        if (dom.labelPjRate) dom.labelPjRate.textContent = 'Valor da Proposta Mensal (em USD)';
        if (dom.intlFieldsGrid) dom.intlFieldsGrid.style.display = 'grid';
        if (dom.pjRate && parseFloat(dom.pjRate.value) > 10000) {
            dom.pjRate.value = '4000';
            dom.pjRate.step = '250';
        }
    } else {
        if (dom.currencySymbol) dom.currencySymbol.textContent = 'R$';
        if (dom.labelPjRate) dom.labelPjRate.textContent = 'Valor da Nota Fiscal Mensal (em R$)';
        if (dom.intlFieldsGrid) dom.intlFieldsGrid.style.display = 'none';
        if (dom.pjRate && parseFloat(dom.pjRate.value) <= 10000) {
            dom.pjRate.value = '18000';
            dom.pjRate.step = '500';
        }
    }
    updateUI();
}

function getTimeoutSignal(ms) {
    try {
        if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
            return AbortSignal.timeout(ms);
        }
    } catch (e) {}
    return undefined;
}

// Integração Paralela com APIs Abertas do Governo
async function fetchGovernmentData() {
    let ptaxLoaded = false;
    let minWageLoaded = false;
    let ipcaLoaded = false;

    const signal = getTimeoutSignal(4000);
    const fetchOptions = signal ? { signal } : {};

    const [ptaxRes, minWageRes, ipcaRes] = await Promise.allSettled([
        fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados/ultimos/1?formato=json', fetchOptions),
        fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.1619/dados/ultimos/1?formato=json', fetchOptions),
        fetch('https://brasilapi.com.br/api/taxas/v1', fetchOptions)
    ]);

    // 1. Dólar PTAX
    if (ptaxRes.status === 'fulfilled' && ptaxRes.value.ok) {
        try {
            const data = await ptaxRes.value.json();
            if (Array.isArray(data) && data.length > 0 && data[0].valor) {
                const parsedRate = parseFloat(data[0].valor);
                if (!isNaN(parsedRate) && parsedRate > 0) {
                    appState.ptaxRate = parsedRate;
                    if (dom.pjExchangeRate && !dom.pjExchangeRate.dataset.userModified) {
                        dom.pjExchangeRate.value = parsedRate.toFixed(2);
                    }
                    if (dom.tagPtax) dom.tagPtax.textContent = `Dólar PTAX (BACEN): R$ ${parsedRate.toFixed(2)} (${data[0].data})`;
                    ptaxLoaded = true;
                }
            }
        } catch (e) {}
    }
    if (!ptaxLoaded && dom.tagPtax) {
        dom.tagPtax.textContent = `Dólar PTAX (Ref): R$ ${appState.ptaxRate.toFixed(2)}`;
    }

    // 2. Salário Mínimo
    if (minWageRes.status === 'fulfilled' && minWageRes.value.ok) {
        try {
            const data = await minWageRes.value.json();
            if (Array.isArray(data) && data.length > 0 && data[0].valor) {
                const parsedWage = parseFloat(data[0].valor);
                if (!isNaN(parsedWage) && parsedWage > 0) {
                    appState.minWage = parsedWage;
                    if (dom.tagSalarioMinimo) dom.tagSalarioMinimo.textContent = `Salário Mínimo: R$ ${parsedWage.toFixed(2)}`;
                    minWageLoaded = true;
                }
            }
        } catch (e) {}
    }
    if (!minWageLoaded && dom.tagSalarioMinimo) {
        dom.tagSalarioMinimo.textContent = `Salário Mínimo (Ref): R$ ${appState.minWage.toFixed(2)}`;
    }

    // 3. IPCA
    if (ipcaRes.status === 'fulfilled' && ipcaRes.value.ok) {
        try {
            const data = await ipcaRes.value.json();
            if (Array.isArray(data)) {
                const ipcaObj = data.find(t => t.nome === 'IPCA');
                if (ipcaObj && ipcaObj.valor) {
                    appState.ipcaRate = parseFloat(ipcaObj.valor);
                    if (dom.tagIpca) dom.tagIpca.textContent = `IPCA 12m: ${appState.ipcaRate}%`;
                    ipcaLoaded = true;
                }
            }
        } catch (e) {}
    }
    if (!ipcaLoaded && dom.tagIpca) {
        dom.tagIpca.textContent = `IPCA 12m: ${appState.ipcaRate}%`;
    }

    // Atualiza status de conectividade
    if (dom.statusDot && dom.statusText) {
        if (ptaxLoaded || minWageLoaded || ipcaLoaded) {
            dom.statusDot.className = 'status-dot online';
            dom.statusText.textContent = 'Dados oficiais sincronizados em tempo real (BACEN / BrasilAPI)';
        } else {
            dom.statusDot.className = 'status-dot';
            dom.statusText.textContent = 'Parâmetros econômicos oficiais carregados (modo referência)';
        }
    }

    updateUI();
}

// Notificação Flutuante (Toast)
let toastTimer = null;
function showToast(message) {
    if (!dom.toastMsg) return;
    dom.toastMsg.textContent = message;
    dom.toastMsg.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        dom.toastMsg.classList.remove('show');
    }, 3500);
}

// Cópia Segura
async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (e) {}

    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        return success;
    } catch (e) {
        return false;
    }
}

// Sincronização de Estado com Parâmetros de URL
function syncStateFromURL() {
    if (typeof window === 'undefined' || !window.location.search) return;
    try {
        const params = new URLSearchParams(window.location.search);

        if (params.has('curr')) {
            const curr = params.get('curr').toUpperCase();
            if (curr === 'USD' || curr === 'BRL') {
                setCurrency(curr);
            }
        }

        if (params.has('clt') && dom.cltSalary) {
            const clt = parseFloat(params.get('clt'));
            if (!isNaN(clt) && clt >= 0) dom.cltSalary.value = clt;
        }

        if (params.has('ben') && dom.cltBenefits) {
            const ben = parseFloat(params.get('ben'));
            if (!isNaN(ben) && ben >= 0) dom.cltBenefits.value = ben;
        }

        if (params.has('pj') && dom.pjRate) {
            const pj = parseFloat(params.get('pj'));
            if (!isNaN(pj) && pj >= 0) dom.pjRate.value = pj;
        }

        if (params.has('rate') && dom.pjExchangeRate) {
            const rate = parseFloat(params.get('rate'));
            if (!isNaN(rate) && rate > 0) {
                dom.pjExchangeRate.value = rate.toFixed(2);
                dom.pjExchangeRate.dataset.userModified = 'true';
            }
        }

        if (params.has('spread') && dom.pjSpread) {
            const spread = parseFloat(params.get('spread'));
            if (!isNaN(spread) && spread >= 0) dom.pjSpread.value = spread;
        }

        if (params.has('exp') && dom.pjExport) {
            const exp = params.get('exp');
            dom.pjExport.checked = (exp === '1' || exp === 'true');
        }

        if (params.has('fator') && dom.pjFatorR) {
            const fator = params.get('fator');
            dom.pjFatorR.checked = (fator === '1' || fator === 'true');
        }
    } catch (e) {
        console.warn('Erro ao processar parâmetros da URL:', e);
    }
}

function updateURLParams() {
    if (typeof window === 'undefined') return;
    try {
        const params = new URLSearchParams();
        params.set('curr', appState.selectedCurrency);
        if (dom.cltSalary) params.set('clt', dom.cltSalary.value);
        if (dom.cltBenefits) params.set('ben', dom.cltBenefits.value);
        if (dom.pjRate) params.set('pj', dom.pjRate.value);
        if (dom.pjExchangeRate && appState.selectedCurrency === 'USD') {
            params.set('rate', dom.pjExchangeRate.value);
        }
        if (dom.pjSpread && appState.selectedCurrency === 'USD') {
            params.set('spread', dom.pjSpread.value);
        }
        if (dom.pjExport) params.set('exp', dom.pjExport.checked ? '1' : '0');
        if (dom.pjFatorR) params.set('fator', dom.pjFatorR.checked ? '1' : '0');

        const newURL = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({}, '', newURL);
    } catch (e) {}
}

let urlDebounceTimer = null;
function debouncedUpdateURLParams() {
    if (urlDebounceTimer) clearTimeout(urlDebounceTimer);
    urlDebounceTimer = setTimeout(() => {
        updateURLParams();
    }, 350);
}

// Compartilhamento
async function handleShareLink() {
    updateURLParams();
    const url = window.location.href;
    const copied = await copyToClipboard(url);
    if (copied) {
        showToast('Link da simulação copiado com sucesso.');
    } else {
        showToast('Não foi possível copiar automaticamente. Selecione a URL na barra de navegação.');
    }
}

async function handleCopySummary() {
    updateURLParams();
    const cltVal = dom.cltSalary ? (parseFloat(dom.cltSalary.value) || 0) : 0;
    const cltBen = dom.cltBenefits ? (parseFloat(dom.cltBenefits.value) || 0) : 0;
    const pjInputVal = dom.pjRate ? (parseFloat(dom.pjRate.value) || 0) : 0;
    const currency = appState.selectedCurrency;
    const exchangeRate = dom.pjExchangeRate ? (parseFloat(dom.pjExchangeRate.value) || appState.ptaxRate) : appState.ptaxRate;
    const spreadVal = dom.pjSpread ? (parseFloat(dom.pjSpread.value) || 0) : 1.0;
    const pjAcc = dom.pjAccounting ? (parseFloat(dom.pjAccounting.value) || 0) : 300;
    const isExport = dom.pjExport ? dom.pjExport.checked : true;
    const useFatorR = dom.pjFatorR ? dom.pjFatorR.checked : true;

    const cltRes = calculateCLT(cltVal, cltBen);
    const pjRes = calculatePJ(pjInputVal, currency, exchangeRate, spreadVal, pjAcc, isExport, useFatorR, appState.minWage);
    const diff = pjRes.netAnnualBRL - cltRes.netAnnual;
    const isPjBetter = diff >= 0;
    const baseAnnual = cltRes.netAnnual > 0 ? cltRes.netAnnual : 1;
    const pct = (Math.abs(diff) / baseAnnual * 100).toFixed(1);
    const winner = isPjBetter ? 'PJ' : 'CLT';

    const pjLabel = currency === 'USD'
        ? `US$ ${pjInputVal.toLocaleString('en-US', { minimumFractionDigits: 2 })} (~${formatBRL(pjRes.grossBRL)})`
        : formatBRL(pjInputVal);

    const breakEven = calculateBreakEven(cltRes.netAnnual, currency, exchangeRate, spreadVal, pjAcc, isExport, useFatorR, appState.minWage);

    const summaryText = [
        'Comparativo CLT vs PJ (Dev no Brasil e no Exterior):',
        `• CLT Bruto: ${formatBRL(cltVal)} (Líquido mensal: ${formatBRL(cltRes.netMonthly)} | Anual: ${formatBRL(cltRes.netAnnual)})`,
        `• PJ Faturamento: ${pjLabel} (Líquido mensal: ${formatBRL(pjRes.netMonthlyBRL)} | Anual: ${formatBRL(pjRes.netAnnualBRL)})`,
        `Veredito: ${winner} com ${pct}% de vantagem (${diff >= 0 ? '+' : ''}${formatBRL(diff)}/ano).`,
        `Ponto de equilíbrio PJ: ${formatBRL(breakEven.breakEvenBRL)} / mês.`,
        `Simulação completa: ${window.location.href}`
    ].join('\n');

    const copied = await copyToClipboard(summaryText);
    if (copied) {
        showToast('Resumo copiado com sucesso.');
    } else {
        showToast('Não foi possível copiar automaticamente. Selecione o texto diretamente na tela.');
    }
}

// Captura de Leads
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function initLeadForm() {
    if (!dom.leadForm) return;

    try {
        const registered = localStorage.getItem('calc_lead_registered');
        if (registered === 'true' && dom.btnLeadText) {
            dom.btnLeadText.textContent = 'Material Solicitado ✓';
        }
    } catch (e) {}

    dom.leadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = dom.leadName;
        const emailInput = dom.leadEmail;
        const btn = dom.btnSubmitLead;
        const btnText = dom.btnLeadText;
        const feedback = dom.leadFeedback;

        if (!emailInput || !nameInput) return;

        const name = nameInput.value.trim();
        const email = emailInput.value.trim().toLowerCase();

        if (!EMAIL_REGEX.test(email)) {
            if (feedback) {
                feedback.className = 'lead-feedback error';
                feedback.textContent = 'Informe um endereço de e-mail corporativo ou pessoal válido (exemplo: nome@empresa.com).';
                feedback.style.display = 'block';
            }
            emailInput.setAttribute('aria-invalid', 'true');
            emailInput.setAttribute('aria-describedby', 'lead-feedback');
            emailInput.focus();
            return;
        } else {
            emailInput.removeAttribute('aria-invalid');
        }

        try {
            window.open('https://robsoncassiano.software/7-passos-simples-dev-na-gringa', '_blank', 'noopener,noreferrer');
        } catch (err) {}

        if (btn) btn.disabled = true;
        if (btnText) btnText.textContent = 'Enviando...';
        if (feedback) feedback.style.display = 'none';

        try {
            const response = await fetch('https://eu.robsoncassiano.software/api/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    email: email,
                    source: 'calculadora-pj-clt'
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                if (feedback) {
                    feedback.className = 'lead-feedback success';
                    feedback.innerHTML = 'Material enviado com sucesso. O guia também foi aberto em nova guia (<a href="https://robsoncassiano.software/7-passos-simples-dev-na-gringa" target="_blank" rel="noopener noreferrer" style="color: #4ade80; text-decoration: underline;">clique aqui se a guia foi bloqueada</a>).';
                    feedback.style.display = 'block';
                }
                if (btnText) btnText.textContent = 'Enviado com Sucesso ✓';
                try {
                    localStorage.setItem('calc_lead_registered', 'true');
                } catch (err) {}
                dom.leadForm.reset();
                showToast('Material solicitado. Verifique sua caixa de entrada.');
            } else {
                if (feedback) {
                    feedback.className = 'lead-feedback error';
                    feedback.textContent = data.error || 'O serviço de envio está temporariamente instável. Aguarde alguns instantes e tente novamente.';
                    feedback.style.display = 'block';
                }
                if (btn) btn.disabled = false;
                if (btnText) btnText.textContent = 'Baixar Parecer Fiscal e Minuta B2B →';
            }
        } catch (err) {
            if (feedback) {
                feedback.className = 'lead-feedback error';
                feedback.textContent = 'Falha de comunicação com o servidor. Verifique sua conexão de rede e confirme o envio.';
                feedback.style.display = 'block';
            }
            if (btn) btn.disabled = false;
            if (btnText) btnText.textContent = 'Baixar Parecer Fiscal e Minuta B2B →';
        }
    });
}

// Configuração dos Event Listeners com Debounce
function setupListeners() {
    if (dom.btnCurrBrl) dom.btnCurrBrl.addEventListener('click', () => setCurrency('BRL'));
    if (dom.btnCurrUsd) dom.btnCurrUsd.addEventListener('click', () => setCurrency('USD'));
    if (dom.btnShareLink) dom.btnShareLink.addEventListener('click', handleShareLink);
    if (dom.btnCopySummary) dom.btnCopySummary.addEventListener('click', handleCopySummary);

    initLeadForm();

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

    if (dom.pjExchangeRate) {
        dom.pjExchangeRate.addEventListener('input', () => {
            dom.pjExchangeRate.dataset.userModified = 'true';
        });
    }

    triggerInputs.forEach(input => {
        if (input) {
            input.addEventListener('input', () => {
                updateUI();
                debouncedUpdateURLParams();
            });
        }
    });
}

// Inicialização segura
function init() {
    initDom();
    syncStateFromURL();
    setupListeners();
    updateUI();
    fetchGovernmentData();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
