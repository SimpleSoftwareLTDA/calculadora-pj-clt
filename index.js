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
    if (!dom.cltSalary) {
        initDom();
    }

    const cltVal = dom.cltSalary ? (parseFloat(dom.cltSalary.value) || 0) : 10000;
    const cltBen = dom.cltBenefits ? (parseFloat(dom.cltBenefits.value) || 0) : 1000;
    const pjInputVal = dom.pjRate ? (parseFloat(dom.pjRate.value) || 0) : 18000;
    const exchangeRate = dom.pjExchangeRate ? (parseFloat(dom.pjExchangeRate.value) || appState.ptaxRate) : appState.ptaxRate;
    const spreadVal = dom.pjSpread ? (parseFloat(dom.pjSpread.value) || 0) : 1.0;
    const pjAcc = dom.pjAccounting ? (parseFloat(dom.pjAccounting.value) || 0) : 300;
    const isExport = dom.pjExport ? dom.pjExport.checked : true;
    const useFatorR = dom.pjFatorR ? dom.pjFatorR.checked : true;
    const currency = appState.selectedCurrency;

    // Atualiza label do Fator R conforme status de exportação
    if (dom.labelFatorR) {
        if (isExport) {
            dom.labelFatorR.textContent = 'Aplicar Fator R (Anexo III - ~3,05% exportação / 9,30% sem Fator R)';
        } else {
            dom.labelFatorR.textContent = 'Aplicar Fator R (Anexo III - 6,00% nacional / 15,50% sem Fator R)';
        }
    }

    // Cálculos
    const cltResult = calculateCLT(cltVal, cltBen);
    const pjResult = calculatePJ(pjInputVal, currency, exchangeRate, spreadVal, pjAcc, isExport, useFatorR, appState.minWage);

    // Renderização dos Resultados CLT
    if (dom.cltNetMonthly) dom.cltNetMonthly.textContent = formatBRL(cltResult.netMonthly);
    if (dom.cltNetAnnual) dom.cltNetAnnual.textContent = formatBRL(cltResult.netAnnual);
    if (dom.cltTaxInss) dom.cltTaxInss.textContent = formatBRL(cltResult.breakdown.inss);
    if (dom.cltTaxIrpf) dom.cltTaxIrpf.textContent = formatBRL(cltResult.breakdown.irpf);
    if (dom.cltTotalFgts) dom.cltTotalFgts.textContent = formatBRL(cltResult.breakdown.fgtsAnual);

    // Renderização dos Resultados PJ
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
        dom.verdictText.innerHTML = `${winner} é <span class="percentage" style="color: ${isPjBetter ? 'var(--success)' : 'var(--danger)'}">${percentage}%</span> mais vantajoso que ${loser}.`;
    }

    // Barra proporcional
    const totalAnnual = pjResult.netAnnualBRL + cltResult.netAnnual;
    const ratio = totalAnnual > 0 ? Math.min(100, Math.max(5, (pjResult.netAnnualBRL / totalAnnual) * 100)) : 50;
    if (dom.comparisonFill) {
        dom.comparisonFill.style.width = `${ratio}%`;
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

    updateURLParams();
}

// Alternância de Moeda
function setCurrency(currency) {
    appState.selectedCurrency = currency;
    if (currency === 'USD') {
        if (dom.btnCurrUsd) dom.btnCurrUsd.classList.add('active');
        if (dom.btnCurrBrl) dom.btnCurrBrl.classList.remove('active');
        if (dom.currencySymbol) dom.currencySymbol.textContent = '$';
        if (dom.labelPjRate) dom.labelPjRate.textContent = 'Valor da Proposta Mensal (em USD)';
        if (dom.intlFieldsGrid) dom.intlFieldsGrid.style.display = 'grid';
        if (dom.pjRate && parseFloat(dom.pjRate.value) > 10000) {
            dom.pjRate.value = '4000';
            dom.pjRate.step = '250';
        }
    } else {
        if (dom.btnCurrBrl) dom.btnCurrBrl.classList.add('active');
        if (dom.btnCurrUsd) dom.btnCurrUsd.classList.remove('active');
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

// Helper seguro para timeout do fetch
function getTimeoutSignal(ms) {
    try {
        if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
            return AbortSignal.timeout(ms);
        }
    } catch (e) {}
    return undefined;
}

// Integração com APIs Abertas do Governo
async function fetchGovernmentData() {
    let ptaxLoaded = false;
    let minWageLoaded = false;
    let ipcaLoaded = false;

    // 1. Cotação do Dólar PTAX (Banco Central do Brasil - SGS Série 1)
    try {
        const signal = getTimeoutSignal(4000);
        const res = await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados/ultimos/1?formato=json', signal ? { signal } : {});
        if (res.ok) {
            const data = await res.json();
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
        }
    } catch (e) {
        if (dom.tagPtax) dom.tagPtax.textContent = `Dólar PTAX (Ref): R$ ${appState.ptaxRate.toFixed(2)}`;
    }

    // 2. Salário Mínimo Nacional (Banco Central do Brasil - SGS Série 1619)
    try {
        const signal = getTimeoutSignal(4000);
        const res = await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.1619/dados/ultimos/1?formato=json', signal ? { signal } : {});
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0 && data[0].valor) {
                const parsedWage = parseFloat(data[0].valor);
                if (!isNaN(parsedWage) && parsedWage > 0) {
                    appState.minWage = parsedWage;
                    if (dom.tagSalarioMinimo) dom.tagSalarioMinimo.textContent = `Salário Mínimo: R$ ${parsedWage.toFixed(2)}`;
                    minWageLoaded = true;
                }
            }
        }
    } catch (e) {
        if (dom.tagSalarioMinimo) dom.tagSalarioMinimo.textContent = `Salário Mínimo (Ref): R$ ${appState.minWage.toFixed(2)}`;
    }

    // 3. Indicadores de Inflação e Juros (BrasilAPI / BACEN)
    try {
        const signal = getTimeoutSignal(4000);
        const res = await fetch('https://brasilapi.com.br/api/taxas/v1', signal ? { signal } : {});
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
                const ipcaObj = data.find(t => t.nome === 'IPCA');
                if (ipcaObj && ipcaObj.valor) {
                    appState.ipcaRate = parseFloat(ipcaObj.valor);
                    if (dom.tagIpca) dom.tagIpca.textContent = `IPCA 12m: ${appState.ipcaRate}%`;
                    ipcaLoaded = true;
                }
            }
        }
    } catch (e) {
        if (dom.tagIpca) dom.tagIpca.textContent = `IPCA 12m: ${appState.ipcaRate}%`;
    }

    // Atualiza status global de conectividade
    if (dom.statusDot && dom.statusText) {
        if (ptaxLoaded || minWageLoaded || ipcaLoaded) {
            dom.statusDot.className = 'status-dot online';
            dom.statusText.textContent = 'Dados oficiais sincronizados em tempo real (BACEN / BrasilAPI)';
        } else {
            dom.statusDot.className = 'status-dot';
            dom.statusText.textContent = 'Parâmetros econômicos oficiais carregados (modo offline/referência)';
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
        if (dom.toastMsg) dom.toastMsg.classList.remove('show');
    }, 3500);
}

// Cópia Segura para a Área de Transferência
async function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (e) {}
    }
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        const successful = document.execCommand('copy');
        textArea.remove();
        return successful;
    } catch (err) {
        textArea.remove();
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
    if (typeof window === 'undefined' || !window.history || !window.history.replaceState) return;
    try {
        const params = new URLSearchParams();
        const clt = dom.cltSalary ? dom.cltSalary.value : '';
        const ben = dom.cltBenefits ? dom.cltBenefits.value : '';
        const pj = dom.pjRate ? dom.pjRate.value : '';
        const curr = appState.selectedCurrency;
        const rate = dom.pjExchangeRate ? dom.pjExchangeRate.value : '';
        const spread = dom.pjSpread ? dom.pjSpread.value : '';
        const exp = dom.pjExport ? (dom.pjExport.checked ? '1' : '0') : '1';
        const fator = dom.pjFatorR ? (dom.pjFatorR.checked ? '1' : '0') : '1';

        if (clt) params.set('clt', clt);
        if (ben) params.set('ben', ben);
        if (pj) params.set('pj', pj);
        if (curr) params.set('curr', curr);
        if (curr === 'USD') {
            if (rate) params.set('rate', rate);
            if (spread) params.set('spread', spread);
        }
        params.set('exp', exp);
        params.set('fator', fator);

        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState(null, '', newUrl);
    } catch (e) {}
}

// Compartilhamento Viral
async function handleShareLink() {
    updateURLParams();
    const url = window.location.href;
    const copied = await copyToClipboard(url);
    if (copied) {
        showToast('Link da simulação copiado com sucesso.');
    } else {
        showToast('Erro ao copiar link.');
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
        '📊 Comparativo CLT vs PJ (Dev no Brasil e no Exterior):',
        `• CLT Bruto: ${formatBRL(cltVal)} (Líquido mensal: ${formatBRL(cltRes.netMonthly)} | Anual: ${formatBRL(cltRes.netAnnual)})`,
        `• PJ Faturamento: ${pjLabel} (Líquido mensal: ${formatBRL(pjRes.netMonthlyBRL)} | Anual: ${formatBRL(pjRes.netAnnualBRL)})`,
        `🏆 Veredito: ${winner} com ${pct}% de vantagem (${diff >= 0 ? '+' : ''}${formatBRL(diff)}/ano).`,
        `📌 Ponto de equilíbrio PJ: ${formatBRL(breakEven.breakEvenBRL)} / mês.`,
        `🔗 Simulação completa: ${window.location.href}`
    ].join('\n');

    const copied = await copyToClipboard(summaryText);
    if (copied) {
        showToast('Resumo copiado com sucesso.');
    } else {
        showToast('Erro ao copiar resumo.');
    }
}

// Captura de Leads Integrada com a API Oficial (eu.robsoncassiano.software)
function initLeadForm() {
    if (!dom.leadForm) return;

    try {
        const registered = localStorage.getItem('calc_lead_registered');
        if (registered === 'true' && dom.btnLeadText) {
            dom.btnLeadText.textContent = 'Relatório Solicitado ✓';
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

        if (!email || !email.includes('@')) {
            if (feedback) {
                feedback.className = 'lead-feedback error';
                feedback.textContent = 'Por favor, informe um e-mail válido.';
                feedback.style.display = 'block';
            }
            return;
        }

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
                    feedback.textContent = data.message || 'Relatório enviado com sucesso. Verifique sua caixa de entrada.';
                    feedback.style.display = 'block';
                }
                if (btnText) btnText.textContent = 'Enviado com Sucesso ✓';
                try {
                    localStorage.setItem('calc_lead_registered', 'true');
                } catch (err) {}
                dom.leadForm.reset();
                showToast('Relatório solicitado. Verifique sua caixa de entrada.');
            } else {
                if (feedback) {
                    feedback.className = 'lead-feedback error';
                    feedback.textContent = data.error || 'Não foi possível registrar seu e-mail no momento. Tente novamente.';
                    feedback.style.display = 'block';
                }
                if (btn) btn.disabled = false;
                if (btnText) btnText.textContent = 'Receber Relatório Gratuito →';
            }
        } catch (err) {
            if (feedback) {
                feedback.className = 'lead-feedback error';
                feedback.textContent = 'Falha de conexão. Verifique sua rede e tente novamente.';
                feedback.style.display = 'block';
            }
            if (btn) btn.disabled = false;
            if (btnText) btnText.textContent = 'Receber Relatório Gratuito →';
        }
    });
}

// Configuração dos Event Listeners
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
            input.addEventListener('input', updateUI);
            input.addEventListener('change', updateUI);
            input.addEventListener('keyup', updateUI);
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
