const API_URL = 'https://loteriascaixa-api.herokuapp.com/api/lotofacil';
const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23];

let allDraws = [];
let stats = {
    frequency: {},
    recency: {},
    delay: {},
    totalGames: 0
};

document.addEventListener('DOMContentLoaded', () => {
    fetchHistory();

    document.getElementById('generate-btn').addEventListener('click', () => {
        if (allDraws.length === 0) {
            alert('Aguarde o carregamento dos dados...');
            return;
        }
        generateStrategicGames();
    });
});

async function fetchHistory() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();

        // A API retorna um array de objetos (mais recente primeiro ou antigo primeiro?)
        // Vamos garantir que organizamos os dados
        allDraws = data.sort((a, b) => b.concurso - a.concurso);

        updateUIStats();
        processStats();
    } catch (error) {
        console.error('Erro ao buscar dados:', error);
        document.getElementById('last-draw-num').innerText = 'Erro';
    }
}

function updateUIStats() {
    if (allDraws.length > 0) {
        document.getElementById('last-draw-num').innerText = allDraws[0].concurso;
        document.getElementById('total-draws').innerText = allDraws.length;
    }
}

function processStats() {
    stats.totalGames = allDraws.length;

    // Inicializar contadores
    for (let i = 1; i <= 25; i++) {
        stats.frequency[i] = 0;
        stats.recency[i] = 0;
        stats.delay[i] = 0;
    }

    // Calcular Frequência Total
    allDraws.forEach(draw => {
        draw.dezenas.forEach(num => {
            const n = parseInt(num);
            stats.frequency[n]++;
        });
    });

    // Calcular Recência (últimos 20 jogos)
    const recentDraws = allDraws.slice(0, 20);
    recentDraws.forEach(draw => {
        draw.dezenas.forEach(num => {
            const n = parseInt(num);
            stats.recency[n]++;
        });
    });

    // Calcular Atraso
    for (let i = 1; i <= 25; i++) {
        let count = 0;
        for (let j = 0; j < allDraws.length; j++) {
            if (allDraws[j].dezenas.includes(i.toString().padStart(2, '0'))) {
                break;
            }
            count++;
        }
        stats.delay[i] = count;
    }
}

function calculateWeights() {
    let weights = [];
    for (let i = 1; i <= 25; i++) {
        // Pontuação baseada em frequência histórico (0-100)
        let score = (stats.frequency[i] / stats.totalGames) * 100;

        // Bônus de recência (tendência atual)
        score += (stats.recency[i] / 20) * 50;

        // Bônus de atraso (equilíbrio estatístico - números que não saem há 1-3 concursos)
        if (stats.delay[i] > 0 && stats.delay[i] < 4) {
            score += 15;
        } else if (stats.delay[i] >= 4) {
            score += 25; // Números muito "atrasados"
        }

        weights.push({ number: i, score: score });
    }
    return weights.sort((a, b) => b.score - a.score);
}

function generateStrategicGames() {
    const resultsContainer = document.getElementById('results-container');
    resultsContainer.innerHTML = '';

    const weightedNumbers = calculateWeights();

    for (let i = 1; i <= 3; i++) {
        const game = createSingleGame(weightedNumbers, i);
        displayGame(game, i, weightedNumbers);
    }
}

function createSingleGame(weightedNumbers, gameIndex) {
    let attempts = 0;
    const maxAttempts = 1000;

    while (attempts < maxAttempts) {
        attempts++;
        let selected = [];

        // Pools de seleção para garantir diversidade
        const topPool = weightedNumbers.slice(0, 18);
        const midPool = weightedNumbers.slice(12, 22);
        const fullPool = weightedNumbers.slice(0, 25);

        if (gameIndex === 1) {
            // Jogo 1: Elite (embaralhado entre os top 18)
            selected = topPool.sort(() => Math.random() - 0.5).slice(0, 15).map(n => n.number);
        } else if (gameIndex === 2) {
            // Jogo 2: Mix Equilibrado (10 top + 5 mid)
            selected = [
                ...topPool.sort(() => Math.random() - 0.5).slice(0, 10).map(n => n.number),
                ...midPool.sort(() => Math.random() - 0.5).slice(0, 5).map(n => n.number)
            ];
        } else {
            // Jogo 3: Ousado (8 top + 7 aleatórios do pool total)
            selected = [
                ...topPool.sort(() => Math.random() - 0.5).slice(0, 8).map(n => n.number),
                ...fullPool.sort(() => Math.random() - 0.5).slice(0, 7).map(n => n.number)
            ];
        }

        selected = [...new Set(selected)].sort((a, b) => a - b);

        // Garante 15 números caso o Set tenha removido duplicatas das faixas sobrepostas
        while (selected.length < 15) {
            const randomNum = Math.floor(Math.random() * 25) + 1;
            if (!selected.includes(randomNum)) {
                selected.push(randomNum);
            }
        }
        selected.sort((a, b) => a - b);

        // --- VALIDAÇÕES EXPERT (Relaxadas para evitar fallback repetitivo) ---
        const sum = selected.reduce((a, b) => a + b, 0);
        if (sum < 165 || sum > 225) continue;

        if (allDraws.length > 0) {
            const lastDraw = allDraws[0].dezenas.map(n => parseInt(n));
            const repeated = selected.filter(n => lastDraw.includes(n)).length;
            if (repeated < 7 || repeated > 12) continue;
        }

        const evens = selected.filter(n => n % 2 === 0).length;
        if (evens < 5 || evens > 10) continue;

        return selected;
    }

    // Fallback ÚNICO caso falhe 1000 tentativas
    let fallback = [];
    while (fallback.length < 15) {
        let n = Math.floor(Math.random() * 25) + 1;
        if (!fallback.includes(n)) fallback.push(n);
    }
    return fallback.sort((a, b) => a - b);
}

function checkPerformance(numbers) {
    let stats = { hits15: 0, hits14: 0, hits13: 0, hits12: 0, hits11: 0 };
    const numStrings = numbers.map(n => n.toString().padStart(2, '0'));

    allDraws.forEach(draw => {
        let hits = 0;
        draw.dezenas.forEach(d => {
            if (numStrings.includes(d)) hits++;
        });

        if (hits === 15) stats.hits15++;
        else if (hits === 14) stats.hits14++;
        else if (hits === 13) stats.hits13++;
        else if (hits === 12) stats.hits12++;
        else if (hits === 11) stats.hits11++;
    });

    return stats;
}

async function copyToClipboard(text, btn) {
    try {
        await navigator.clipboard.writeText(text);
        const originalText = btn.innerText;
        btn.innerText = 'Copiado!';
        btn.style.background = '#00c853';
        setTimeout(() => {
            btn.innerText = originalText;
            btn.style.background = '';
        }, 2000);
    } catch (err) {
        console.error('Erro ao copiar:', err);
    }
}

function displayGame(numbers, index, weightedNumbers) {
    const resultsContainer = document.getElementById('results-container');

    // Encontrar o maior e menor score para normalizar a porcentagem (apenas para exibição visual)
    const maxScore = Math.max(...weightedNumbers.map(n => n.score));
    const minScore = Math.min(...weightedNumbers.map(n => n.score));

    const card = document.createElement('div');
    card.className = 'game-card glass';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '1.5rem';

    const title = document.createElement('div');
    title.className = 'game-title';
    title.style.marginBottom = '0';
    title.innerText = `Sugestão #0${index}`;

    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn-copy';
    copyBtn.innerText = 'Copiar Jogo';
    copyBtn.onclick = () => copyToClipboard(numbers.map(n => n.toString().padStart(2, '0')).join(' '), copyBtn);

    header.appendChild(title);
    header.appendChild(copyBtn);

    const grid = document.createElement('div');
    grid.className = 'numbers-grid';

    numbers.forEach(num => {
        const itemContainer = document.createElement('div');
        itemContainer.className = 'number-item-container';

        const ball = document.createElement('div');
        ball.className = 'number-ball';
        ball.innerText = num.toString().padStart(2, '0');

        // Calcular porcentagem de força baseada no peso
        const weightObj = weightedNumbers.find(w => w.number === num);
        // Normalização simples para ficar entre 60% e 99% (mais intuitivo para o usuário)
        const percent = weightObj ? Math.round(((weightObj.score - minScore) / (maxScore - minScore)) * 39 + 60) : 50;

        const chance = document.createElement('div');
        chance.className = 'number-chance';
        chance.innerText = `${percent}%`;

        itemContainer.appendChild(ball);
        itemContainer.appendChild(chance);
        grid.appendChild(itemContainer);
    });

    // Simulador de Performance
    const perf = checkPerformance(numbers);
    const perfDisplay = document.createElement('div');
    perfDisplay.className = 'performance-badge';
    perfDisplay.innerHTML = `
        <div class="perf-title">Teste de Performance (Histórico):</div>
        <div class="perf-stats">
            <span>15 pts: <strong>${perf.hits15}</strong></span>
            <span>14 pts: <strong>${perf.hits14}</strong></span>
            <span>13 pts: <strong>${perf.hits13}</strong></span>
            <span>11-12 pts: <strong>${perf.hits11 + perf.hits12}</strong></span>
        </div>
    `;

    const info = document.createElement('div');
    info.className = 'game-info-footer';

    const evens = numbers.filter(n => n % 2 === 0).length;
    const primesCount = numbers.filter(n => PRIMES.includes(n)).length;
    const sum = numbers.reduce((a, b) => a + b, 0);

    info.innerHTML = `
        <span>Soma: ${sum}</span>
        <span>Pares/Ímpar: ${evens}/${15 - evens}</span>
        <span>Primos: ${primesCount}</span>
    `;

    card.appendChild(header);
    card.appendChild(grid);
    card.appendChild(perfDisplay);
    card.appendChild(info);
    resultsContainer.appendChild(card);
}
