/**
 * Calculadora PJ vs CLT para DEVs
 * Lógica baseada nas tabelas de 2024
 */

const TABLES = {
    INSS: [
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
    SIMPLES_ANEXO_III: 0.06,
    SIMPLES_ANEXO_V: 0.155
};

function calculateINSS(gross) {
    let inss = 0;
    const maxContribution = 908.85; // Teto 2024

    if (gross >= 7786.02) return maxContribution;

    for (const bracket of TABLES.INSS) {
        if (gross <= bracket.limit) {
            inss = (gross * bracket.rate) - bracket.deduction;
            break;
        }
    }
    return Math.max(0, inss);
}

function calculateIRPF(taxableIncome) {
    // Simplificação: usando desconto simplificado de R$ 564,80 se for mais vantajoso
    // Para fins da calculadora, usaremos a tabela progressiva padrão
    let irpf = 0;
    for (const bracket of TABLES.IRPF) {
        if (taxableIncome <= bracket.limit) {
            irpf = (taxableIncome * bracket.rate) - bracket.deduction;
            break;
        }
    }
    return Math.max(0, irpf);
}

function calculateCLT(gross, benefits) {
    const inss = calculateINSS(gross);
    const taxableIncome = gross - inss;
    const irpf = calculateIRPF(taxableIncome);

    const netMonthly = gross - inss - irpf;
    const totalMonthly = netMonthly + benefits;

    // Anual: 13 salários + férias (1/3 de 1 salário) + FGTS (8% de 13.33 salários)
    const fgtsAnual = gross * 13.33 * 0.08;
    const netAnnual = (netMonthly * 13.33) + (benefits * 12) + fgtsAnual;

    return {
        netMonthly: totalMonthly,
        netAnnual: netAnnual,
        breakdown: { inss, irpf, netSalary: netMonthly, fgtsAnual }
    };
}

function calculatePJ(gross, accounting, useFatorR) {
    // Se usar Fator R, paga 6% (Anexo III), mas precisa de pro-labore de 28%
    // Para simplificar, assumimos que o DEV faz o Fator R se selecionado.
    const taxRate = useFatorR ? TABLES.SIMPLES_ANEXO_III : TABLES.SIMPLES_ANEXO_V;
    const das = gross * taxRate;

    let proLaboreTaxes = 0;
    if (useFatorR) {
        const proLabore = gross * 0.28;
        const inssPL = calculateINSS(proLabore); // Simplificado: INSS sobre pro-labore
        const irpfPL = calculateIRPF(proLabore - inssPL);
        proLaboreTaxes = inssPL + irpfPL;
    }

    const netMonthly = gross - das - accounting - proLaboreTaxes;
    const netAnnual = netMonthly * 12;

    return {
        netMonthly: netMonthly,
        netAnnual: netAnnual,
        breakdown: { das, accounting, proLaboreTaxes }
    };
}

// UI Controllers
const inputs = {
    cltSalary: document.getElementById('clt-salary'),
    cltBenefits: document.getElementById('clt-benefits'),
    pjRate: document.getElementById('pj-rate'),
    pjAccounting: document.getElementById('pj-accounting'),
    pjFatorR: document.getElementById('pj-fator-r')
};

const outputs = {
    cltNetMonthly: document.getElementById('clt-net-monthly'),
    cltNetAnnual: document.getElementById('clt-net-annual'),
    pjNetMonthly: document.getElementById('pj-net-monthly'),
    pjNetAnnual: document.getElementById('pj-net-annual'),
    comparisonFill: document.getElementById('comparison-fill'),
    verdictText: document.getElementById('verdict-text'),
    breakEvenPj: document.getElementById('break-even-pj'),
    annualDiff: document.getElementById('annual-diff')
};

function formatCurrency(value) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function updateUI() {
    const cltVal = parseFloat(inputs.cltSalary.value) || 0;
    const cltBen = parseFloat(inputs.cltBenefits.value) || 0;
    const pjVal = parseFloat(inputs.pjRate.value) || 0;
    const pjAcc = parseFloat(inputs.pjAccounting.value) || 0;
    const useFatorR = inputs.pjFatorR.checked;

    const cltResult = calculateCLT(cltVal, cltBen);
    const pjResult = calculatePJ(pjVal, pjAcc, useFatorR);

    // Update Card Values
    outputs.cltNetMonthly.textContent = formatCurrency(cltResult.netMonthly);
    outputs.cltNetAnnual.textContent = formatCurrency(cltResult.netAnnual);
    outputs.pjNetMonthly.textContent = formatCurrency(pjResult.netMonthly);
    outputs.pjNetAnnual.textContent = formatCurrency(pjResult.netAnnual);

    // Comparison Logic
    const diff = pjResult.netAnnual - cltResult.netAnnual;
    const isPjBetter = diff > 0;

    // Percentage Comparison
    const percentage = (Math.abs(diff) / cltResult.netAnnual * 100).toFixed(1);
    const winner = isPjBetter ? 'PJ' : 'CLT';

    outputs.verdictText.innerHTML = `${winner} é <span class="percentage" style="color: ${isPjBetter ? 'var(--success)' : 'var(--danger)'}">${percentage}%</span> mais vantajoso que ${isPjBetter ? 'CLT' : 'PJ'}.`;

    // Fill Bar
    const ratio = pjResult.netAnnual / (pjResult.netAnnual + cltResult.netAnnual) * 100;
    outputs.comparisonFill.style.width = `${ratio}%`;

    // Annual Diff
    outputs.annualDiff.textContent = `${diff >= 0 ? '+' : ''} ${formatCurrency(diff)}`;
    outputs.annualDiff.style.color = isPjBetter ? 'var(--success)' : 'var(--danger)';

    // Break-even PJ (Estimated)
    // Roughly: cltNetAnnual / 12 + taxes + accounting
    const estTaxRate = useFatorR ? 0.06 : 0.155;
    const estBreakEven = (cltResult.netAnnual / 12 + pjAcc) / (1 - estTaxRate);
    outputs.breakEvenPj.textContent = formatCurrency(estBreakEven);
}

// Listeners
Object.values(inputs).forEach(input => {
    input.addEventListener('input', updateUI);
});

// Initial call
updateUI();
