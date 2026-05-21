/*jslint browser: true, undef: true, eqeqeq: true, nomen: true, white: true */
/*global window: false, document: false */

/*
 * add fruits + levels
 * fix what happens when a ghost is eaten (should go back to base)
 * do proper ghost mechanics (blinky/wimpy etc)
 */

const { Neat, Network, architect, methods } = neataptic;
const m = methods.mutation;

const NEAT_CONFIG = {
    mutation: [
        m.MOD_WEIGHT, m.MOD_WEIGHT, m.MOD_WEIGHT,
        m.MOD_BIAS, m.MOD_BIAS,
        m.ADD_CONN, m.ADD_NODE, m.MOD_ACTIVATION
    ],
    popsize: 300,
    mutationRate: 0.2,
    elitism: 10,
    maxNodes: 120,
};

let neat = null;

function initNeat() {
    neat = new Neat(59, 4, null, NEAT_CONFIG);
    neat.population.forEach(genome => {
        genome.connections.forEach(conn => {
            conn.weight = (Math.random() * 0.4) - 0.2;
        });
    });
}

initNeat();

let frameCount = 0;
let cachedQuadrantData = null;

let currentGenome = 0;

let generationCount = 0;
let generationScores = [];
let generationTicks = [];
let generationNodes = [];
let bestFitness = 0;

let accumulatedGhostDistance = 0;
let ghostDistanceSamples = 0;

let biggestSize = 0;


let last_X = 0;
let last_Y = 0;
let stallCounter = 0;

var NONE        = 4,
    UP          = 11,
    LEFT        = 1,
    DOWN        = 3,
    RIGHT       = 2,
    WAITING     = 5,
    PAUSE       = 6,
    PLAYING     = 7,
    COUNTDOWN   = 8,
    EATEN_PAUSE = 9,
    DYING       = 10,
    Pacman      = {};

Pacman.FPS = 30;

const TICKS_PER_FRAME = 512;


Pacman.Ghost = function (game, map, colour) {

    var position  = null,
        direction = null,
        eatable   = null,
        eaten     = null,
        due       = null;
    
    function getNewCoord(dir, current) { 
        
        var speed  = isVunerable() ? 1 : isHidden() ? 4 : 2,
            xSpeed = (dir === LEFT && -speed || dir === RIGHT && speed || 0),
            ySpeed = (dir === DOWN && speed || dir === UP && -speed || 0);
    
        return {
            "x": addBounded(current.x, xSpeed),
            "y": addBounded(current.y, ySpeed)
        };
    };

    /* Collision detection(walls) is done when a ghost lands on an
     * exact block, make sure they dont skip over it 
     */
    function addBounded(x1, x2) { 
        var rem    = x1 % 10, 
            result = rem + x2;
        if (rem !== 0 && result > 10) {
            return x1 + (10 - rem);
        } else if(rem > 0 && result < 0) { 
            return x1 - rem;
        }
        return x1 + x2;
    };
    
    function isVunerable() { 
        return eatable !== null;
    };
    
    function isDangerous() {
        return eaten === null;
    };

    function isHidden() { 
        return eatable === null && eaten !== null;
    };
    
    function getRandomDirection() {
        var moves = (direction === LEFT || direction === RIGHT) 
            ? [UP, DOWN] : [LEFT, RIGHT];
        return moves[Math.floor(Math.random() * 2)];
    };
    
    function reset() {
        eaten = null;
        eatable = null;
        position = {"x": 90, "y": 80};
        direction = getRandomDirection();
        due = getRandomDirection();
    };
    
    function onWholeSquare(x) {
        return x % 10 === 0;
    };
    
    function oppositeDirection(dir) { 
        return dir === LEFT && RIGHT ||
            dir === RIGHT && LEFT ||
            dir === UP && DOWN || UP;
    };

    function makeEatable() {
        direction = oppositeDirection(direction);
        eatable = game.getTick();
    };

    function eat() { 
        eatable = null;
        eaten = game.getTick();
    };

    function pointToCoord(x) {
        return Math.round(x / 10);
    };

    function nextSquare(x, dir) {
        var rem = x % 10;
        if (rem === 0) { 
            return x; 
        } else if (dir === RIGHT || dir === DOWN) { 
            return x + (10 - rem);
        } else {
            return x - rem;
        }
    };

    function onGridSquare(pos) {
        return onWholeSquare(pos.y) && onWholeSquare(pos.x);
    };

    function secondsAgo(tick) { 
        return (game.getTick() - tick) / Pacman.FPS;
    };

    function getColour() { 
        if (eatable) { 
            if (secondsAgo(eatable) > 5) { 
                return game.getTick() % 20 > 10 ? "#FFFFFF" : "#0000BB";
            } else { 
                return "#0000BB";
            }
        } else if(eaten) { 
            return "#222";
        } 
        return colour;
    };

    function draw(ctx) {
  
        var s    = map.blockSize, 
            top  = (position.y/10) * s,
            left = (position.x/10) * s;
    
        if (eatable && secondsAgo(eatable) > 8) {
            eatable = null;
        }
        
        if (eaten && secondsAgo(eaten) > 3) { 
            eaten = null;
        }
        
        var tl = left + s;
        var base = top + s - 3;
        var inc = s / 10;

        var high = game.getTick() % 10 > 5 ? 3  : -3;
        var low  = game.getTick() % 10 > 5 ? -3 : 3;

        ctx.fillStyle = getColour();
        ctx.beginPath();

        ctx.moveTo(left, base);

        ctx.quadraticCurveTo(left, top, left + (s/2),  top);
        ctx.quadraticCurveTo(left + s, top, left+s,  base);
        
        ctx.quadraticCurveTo(tl-(inc*1), base+high, tl - (inc * 2),  base);
        ctx.quadraticCurveTo(tl-(inc*3), base+low, tl - (inc * 4),  base);
        ctx.quadraticCurveTo(tl-(inc*5), base+high, tl - (inc * 6),  base);
        ctx.quadraticCurveTo(tl-(inc*7), base+low, tl - (inc * 8),  base); 
        ctx.quadraticCurveTo(tl-(inc*9), base+high, tl - (inc * 10), base); 

        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = "#FFF";
        ctx.arc(left + 6,top + 6, s / 6, 0, 300, false);
        ctx.arc((left + s) - 6,top + 6, s / 6, 0, 300, false);
        ctx.closePath();
        ctx.fill();

        var f = s / 12;
        var off = {};
        off[RIGHT] = [f, 0];
        off[LEFT]  = [-f, 0];
        off[UP]    = [0, -f];
        off[DOWN]  = [0, f];

        ctx.beginPath();
        ctx.fillStyle = "#000";
        ctx.arc(left+6+off[direction][0], top+6+off[direction][1], 
                s / 15, 0, 300, false);
        ctx.arc((left+s)-6+off[direction][0], top+6+off[direction][1], 
                s / 15, 0, 300, false);
        ctx.closePath();
        ctx.fill();

    };

    function pane(pos) {

        if (pos.y === 100 && pos.x >= 190 && direction === RIGHT) {
            return {"y": 100, "x": -10};
        }
        
        if (pos.y === 100 && pos.x <= -10 && direction === LEFT) {
            return position = {"y": 100, "x": 190};
        }

        return false;
    };
    
    function move(ctx) {
        
        var oldPos = position,
            onGrid = onGridSquare(position),
            npos   = null;
        
        if (due !== direction) {
            
            npos = getNewCoord(due, position);
            
            if (onGrid &&
                map.isFloorSpace({
                    "y":pointToCoord(nextSquare(npos.y, due)),
                    "x":pointToCoord(nextSquare(npos.x, due))})) {
                direction = due;
            } else {
                npos = null;
            }
        }
        
        if (npos === null) {
            npos = getNewCoord(direction, position);
        }
        
        if (onGrid &&
            map.isWallSpace({
                "y" : pointToCoord(nextSquare(npos.y, direction)),
                "x" : pointToCoord(nextSquare(npos.x, direction))
            })) {
            
            due = getRandomDirection();            
            return move(ctx);
        }

        position = npos;        
        
        var tmp = pane(position);
        if (tmp) { 
            position = tmp;
        }
        
        due = getRandomDirection();

        //position = oldPos; // [NO GHOST]
        
        return {
            "new" : position,
            "old" : oldPos
        };
    };
    
    return {
        "eat"         : eat,
        "isVunerable" : isVunerable,
        "isDangerous" : isDangerous,
        "makeEatable" : makeEatable,
        "reset"       : reset,
        "move"        : move,
        "draw"        : draw,
        "getEatableSecondsLeft": function() {
            if (eatable === null) return 0;
            const elapsed = (game.getTick() - eatable) / Pacman.FPS;
            return Math.max(0, 8 - elapsed);
    }
    };
};


function updateInfoPanel() {
    let info = PACMAN.getInfo();

    let userPos = info.userPos;
    if (userPos) {
        document.getElementById("info-userPosX").innerText = Math.round(userPos.x);
        document.getElementById("info-userPosY").innerText = Math.round(userPos.y);
    }

    let quadrantData = cachedQuadrantData || calculateQuadrants(info.map);
    document.getElementById("info-quadrant1").innerText = quadrantData.obenLinks.biscuits   + " | " + quadrantData.obenLinks.pills;
    document.getElementById("info-quadrant2").innerText = quadrantData.obenRechts.biscuits  + " | " + quadrantData.obenRechts.pills;
    document.getElementById("info-quadrant3").innerText = quadrantData.untenLinks.biscuits  + " | " + quadrantData.untenLinks.pills;
    document.getElementById("info-quadrant4").innerText = quadrantData.untenRechts.biscuits + " | " + quadrantData.untenRechts.pills;

    let ghostPos = info.ghostPos;
    if (ghostPos && userPos && ghostPos.length === 4) {
        let ghosts = ghostPos.map((g, i) => {
            let gx      = g["new"].x - userPos.x;
            let gy      = g["new"].y - userPos.y;
            let dist    = Math.sqrt(gx * gx + gy * gy);
            let dir     = getDirection(g);
            let seconds = info.ghosts ? info.ghosts[i].getEatableSecondsLeft() : 0;  // ← NEU

            return { x: Math.round(gx), y: Math.round(gy), dist: Math.round(dist), dir, seconds };
        });

        // Nach Distanz sortieren
        ghosts.sort((a, b) => a.dist - b.dist);

        //document.getElementById("info-ghostPos-nächst").innerText  = ghosts[0].x + " | " + ghosts[0].y + " | " + ghosts[0].dist + " | " + ghosts[0].dir + " | " + (ghosts[0].seconds > 0 ? ghosts[0].seconds.toFixed(1) + "s" : "gefährlich");
        //document.getElementById("info-ghostPos-nahe").innerText    = ghosts[1].x + " | " + ghosts[1].y + " | " + ghosts[1].dist + " | " + ghosts[1].dir + " | " + (ghosts[1].seconds > 0 ? ghosts[1].seconds.toFixed(1) + "s" : "gefährlich");
        //document.getElementById("info-ghostPos-weit").innerText    = ghosts[2].x + " | " + ghosts[2].y + " | " + ghosts[2].dist + " | " + ghosts[2].dir + " | " + (ghosts[2].seconds > 0 ? ghosts[2].seconds.toFixed(1) + "s" : "gefährlich");
        //document.getElementById("info-ghostPos-weitest").innerText = ghosts[3].x + " | " + ghosts[3].y + " | " + ghosts[3].dist + " | " + ghosts[3].dir + " | " + (ghosts[3].seconds > 0 ? ghosts[3].seconds.toFixed(1) + "s" : "gefährlich");

        // Receptive Field
        //const receptiveField = getRadarView(info.map.getMap(), userPos);
        //document.getElementById("info-receptive-field").innerText = receptiveField.map(row => row.join(" ")).join("\n");
    }
}


function aiStep(tick) {
    let info = PACMAN.getInfo();
    let userPos = info.userPos;
    let ghostPos = info.ghostPos;

    if (!userPos || !ghostPos || ghostPos.length < 4) return;

    // ---- ANTI-CAMPING CHECK ----
    let currentGenomeInstance = neat.population[currentGenome];

        // Score initialisieren falls null/NaN
    if (currentGenomeInstance.score == null || isNaN(currentGenomeInstance.score)) {
        currentGenomeInstance.score = 0;
    }
    if (currentGenomeInstance.penalty == null || isNaN(currentGenomeInstance.penalty)) {
        currentGenomeInstance.penalty = 0;
    }
        
        // Präzises Runden auf 2 Stellen
    let curX = parseFloat(userPos.x.toFixed(2));
    let curY = parseFloat(userPos.y.toFixed(2));

    if (curX === last_X && curY === last_Y) {
        stallCounter++;
        // Erst bestrafen, wenn er länger als 3 Ticks wirklich festklebt
        if (stallCounter > 3) {
            currentGenomeInstance.penalty += 0.3;
        }
    }
    else {
        stallCounter = 0;
        //currentGenomeInstance.score += 1; // Bonus für echten Fortschritt
    }

    last_X = parseFloat(userPos.x.toFixed(2));
    last_Y = parseFloat(userPos.y.toFixed(2));
    //---------------------------------
    let inputs = [];

    // Quadrants Biscuits und Pills
    let quadrantData = calculateQuadrants(info.map);
    cachedQuadrantData = quadrantData; // Cache für Info-Panel
    inputs.push(quadrantData.obenLinks.biscuits / 50);
    inputs.push(quadrantData.obenRechts.biscuits / 50);
    inputs.push(quadrantData.untenLinks.biscuits / 50);
    inputs.push(quadrantData.untenRechts.biscuits / 50);

    inputs.push(quadrantData.obenLinks.pills);
    inputs.push(quadrantData.obenRechts.pills);
    inputs.push(quadrantData.untenLinks.pills);
    inputs.push(quadrantData.untenRechts.pills);

    // user Position
    inputs.push(userPos.x / 190);
    inputs.push(userPos.y / 210);

    //===== Ghosts =====
    let ghostsData = ghostData(ghostPos, userPos, info);

    // ← DAS FEHLT KOMPLETT:
    if (ghostsData.length > 0) {
        accumulatedGhostDistance += ghostsData[0].dist;
        ghostDistanceSamples++;
    }

    for (let i = 0; i < 4; i++) {
        let g = ghostsData[i];
        inputs.push(g.x / 190);      // Relative X-Position
        inputs.push(g.y / 210);      // Relative Y-Position
        inputs.push(g.dist / 280);   // Distanz
        
        inputs.push(g.dx);
        inputs.push(g.dy);
        inputs.push(Math.min(g.scared, 1)); 
    }

    let radar = getRadarView(info.map.getMap(), userPos);
    radar.forEach(row => row.forEach(cell => inputs.push(cell / 4)));

    let output = neat.population[currentGenome].activate(inputs);

    //xlet maxIndex = sampleFromOutput(output);
    let maxIndex = output.indexOf(Math.max(...output));

    const moves = [11, 3, 2, 1];
    PACMAN.setDirection(moves[maxIndex]);
}

// ── Charts ────────────────────────────────────────────────────
let avgChart = null;
let bestChart = null;
let avgTick = null;
let generationPenalties = [];
let generationGameScores = [];
let generationSurvivalBonuses = [];

function initCharts() {
    const makeOpts = (borderColor, bgColor) => ({
        type: "line",
        data: {
            labels: [],
            datasets: [{
                data: [],
                borderColor: borderColor,
                backgroundColor: bgColor,
                borderWidth: 1,
                pointRadius: 1,
                pointBackgroundColor: borderColor,
                fill: true,
                tension: 0.3
            },{
                label: "Trend",
                data: [],
                borderColor: "rgba(255, 255, 255, 0.2)",
                borderDash: [3, 3],
                pointRadius: 0,
                fill: false,
                tension: 0, // Muss 0 sein für eine gerade Linie
                spanGaps: true // Wichtig, da wir zwischendrin null-Werte haben
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const label = ctx.dataset.label || "Wert";
                            return " " + label + ": " + ctx.parsed.y.toFixed(2);
                        }
                    },
                    titleFont:  { family: "Courier New", size: 9 },
                    bodyFont:   { family: "Courier New", size: 9 },
                    backgroundColor: "#16213e",
                    borderColor: "#0f3460",
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: "#555",
                        font: { size: 8, family: "Courier New" },
                        maxTicksLimit: 6
                    },
                    grid: { color: "#1e2a4a" },
                    title: {
                        display: true,
                        text: "Generation",
                        color: "#555",
                        font: { size: 8, family: "Courier New" }
                    }
                },
                y: {
                    ticks: {
                        color: "#555",
                        font: { size: 8, family: "Courier New" },
                        maxTicksLimit: 4
                    },
                    grid: { color: "#1e2a4a" },
                    beginAtZero: true
                }
            }
        }
    });

    // Initialisierung mit deinen Original-Farben
    avgChart = new Chart(
        document.getElementById("chart-avg").getContext("2d"),
        makeOpts("#00d4ff", "rgba(0, 212, 255, 0.1)")
    );
    avgChart.data.datasets[0].label = "Avg Fitness";
    avgChart.data.datasets.push({
        label: "Avg Game Score",
        data: [],
        borderColor: "#00ff00",
        backgroundColor: "rgba(0, 255, 0, 0.12)",
        borderWidth: 1,
        pointRadius: 1,
        pointBackgroundColor: "#00ff00",
        fill: true,
        tension: 0.3
    });
    avgChart.data.datasets.push({
        label: "Avg Idle Penalty",
        data: [],
        borderColor: "#ff0000",
        backgroundColor: "rgba(255, 0, 0, 0.12)",
        borderWidth: 1,
        pointRadius: 1,
        pointBackgroundColor: "#ff0000",
        fill: true,
        tension: 0.3
    });
    avgChart.data.datasets.push({
        label: "Avg Survival Bonus",
        data: [],
        borderColor: "#8a2be2",
        backgroundColor: "rgba(138, 43, 226, 0.12)",
        borderWidth: 1,
        pointRadius: 1,
        pointBackgroundColor: "#8a2be2",
        fill: true,
        tension: 0.3
    });
    avgChart.options.plugins.legend.display = false;

    bestChart = new Chart(
        document.getElementById("chart-best").getContext("2d"),
        makeOpts("#e94560", "rgba(233, 69, 96, 0.1)")
    );

    avgTick = new Chart(
        document.getElementById("chart-tick").getContext("2d"),
        makeOpts("#e9c46a", "rgba(233, 196, 106, 0.15)")
    );

    nodesChart = new Chart(
        document.getElementById("chart-nodes").getContext("2d"),
        makeOpts("#ff6b6b", "rgba(255, 107, 107, 0.15)")
    );
}

function pushToChart(chart, value, scoreValue, penaltyValue, survivalValue) {
    chart.data.labels.push(generationCount);
    chart.data.datasets[0].data.push(parseFloat(value.toFixed(1)));
    if (chart.data.datasets[2] && scoreValue !== undefined) {
        chart.data.datasets[2].data.push(parseFloat(scoreValue.toFixed(1)));
    }
    if (chart.data.datasets[3] && penaltyValue !== undefined) {
        chart.data.datasets[3].data.push(parseFloat(penaltyValue.toFixed(1)));
    }
    if (chart.data.datasets[4] && survivalValue !== undefined) {
        chart.data.datasets[4].data.push(parseFloat(survivalValue.toFixed(1)));
    }

    updateTrendline(chart);
    chart.update();
}

// ── Save / Load ───────────────────────────────────────────────
function autoSave() {
    try {
        const data = JSON.stringify({
            neat: neat.export(), generationCount, bestFitness, generationScores, generationGameScores, generationPenalties, generationSurvivalBonuses, generationTicks
        });
        localStorage.setItem('pacman-neat', data);
        document.getElementById('stat-autosave').innerText =
            'Auto @ ' + new Date().toLocaleTimeString();
    } catch(e) { console.warn('Autosave failed', e); }
}

function exportSave() {
    const data = JSON.stringify({
        neat:             neat.export(),
        generationCount,
        bestFitness,
        generationTicks,
        generationNodes,
        chartAvg:         avgChart.data.datasets[0].data.slice(),
        chartAvgGame:     avgChart.data.datasets[2].data.slice(),
        chartAvgPenalty:  avgChart.data.datasets[3].data.slice(),
        chartAvgSurvival: avgChart.data.datasets[4].data.slice(),
        chartBest:        bestChart.data.datasets[0].data.slice(),
        chartTick:        avgTick.data.datasets[0].data.slice(),
        chartNodes:       nodesChart.data.datasets[0].data.slice(),
        chartLabels:      avgChart.data.labels.slice()
    }, null, 2);

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    a.download = 'pacman-neat-gen' + generationCount + '.json';
    a.click();
}

function importSave(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const save = JSON.parse(e.target.result);
            neat.import(save.neat);

            generationCount = save.generationCount || 0;
            bestFitness     = save.bestFitness      || 0;
            generationTicks = save.generationTicks  || [];
            generationNodes = save.generationNodes  || [];

            // Partielle Generation-Arrays immer verwerfen
            generationScores          = [];
            generationGameScores      = [];
            generationPenalties       = [];
            generationSurvivalBonuses = [];
            currentGenome             = 0;

            // Runtime-State resetten
            stallCounter             = 0;
            last_X                   = 0;
            last_Y                   = 0;
            accumulatedGhostDistance = 0;
            ghostDistanceSamples     = 0;

            // Charts wiederherstellen
            const labels      = save.chartLabels     || [];
            const avg         = save.chartAvg        || [];
            const avgGame     = save.chartAvgGame    || [];
            const avgPenalty  = save.chartAvgPenalty || [];
            const avgSurvival = save.chartAvgSurvival|| [];
            const best        = save.chartBest       || [];
            const tick        = save.chartTick       || [];
            const nodes       = save.chartNodes      || [];

            avgChart.data.labels              = labels.slice();
            avgChart.data.datasets[0].data    = avg.slice();
            avgChart.data.datasets[2].data    = avgGame.slice();
            avgChart.data.datasets[3].data    = avgPenalty.slice();
            avgChart.data.datasets[4].data    = avgSurvival.slice();
            bestChart.data.labels             = labels.slice();
            bestChart.data.datasets[0].data   = best.slice();
            avgTick.data.labels               = labels.slice();
            avgTick.data.datasets[0].data     = tick.slice();
            nodesChart.data.labels            = labels.slice();
            nodesChart.data.datasets[0].data  = nodes.slice();

            updateTrendline(avgChart);  avgChart.update();
            updateTrendline(bestChart); bestChart.update();
            updateTrendline(avgTick);   avgTick.update();
            updateTrendline(nodesChart);nodesChart.update();

            document.getElementById('stat-autosave').innerText = '✅ Imported!';
        } catch(err) { alert('Import fehlgeschlagen: ' + err.message); }
    };
    reader.readAsText(file);
}

function updateTrendline(chart) {
    const data = chart.data.datasets[0].data;
    if (!data || data.length < 2) return;

    let n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    for (let i = 0; i < n; i++) {
        const x = i + 1;
        const y = data[i];
        sumX  += x;
        sumY  += y;
        sumXY += x * y;
        sumX2 += x * x;
    }

    const m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const b = (sumY - m * sumX) / n;

    const trendPoints = new Array(n).fill(null);
    trendPoints[0]     = m * 1 + b;
    trendPoints[n - 1] = m * n + b;

    chart.data.datasets[1].data = trendPoints;
    chart.update();
}

function clearSave() {
    if (!confirm('Alle Trainingsdaten löschen?')) return;
    localStorage.removeItem('pacman-neat');
    initNeat();
    generationCount = 0; bestFitness = 0;
    generationScores = []; generationGameScores = []; generationPenalties = []; generationSurvivalBonuses = []; generationTicks = []; generationNodes = []; currentGenome = 0;
    if (avgChart)  { avgChart.data.labels  = []; avgChart.data.datasets[0].data  = []; avgChart.data.datasets[1].data = []; avgChart.data.datasets[2].data = []; avgChart.data.datasets[3].data = []; avgChart.data.datasets[4].data = []; avgChart.update(); }
    if (bestChart) { bestChart.data.labels = []; bestChart.data.datasets[0].data = []; bestChart.data.datasets[1].data = []; bestChart.update(); }
    if (avgTick)  { avgTick.data.labels  = []; avgTick.data.datasets[0].data  = []; avgTick.data.datasets[1].data = []; avgTick.update(); }
    if (nodesChart){ nodesChart.data.labels= []; nodesChart.data.datasets[0].data= []; nodesChart.data.datasets[1].data= []; nodesChart.update(); }
    document.getElementById('stat-autosave').innerText = '🗑 Reset';
}
function updateStatsPanel(neatScore, tick) {
    let s = neat.population[currentGenome]?.score ?? 0;
    
    document.getElementById("stat-generation").innerText   = generationCount;
    document.getElementById("stat-genome").innerText       = currentGenome + " / " + neat.population.length;
    document.getElementById("stat-best-fitness").innerText = bestFitness.toFixed(0);
    document.getElementById("stat-avg-score").innerText = isNaN(s) ? "0" : s.toFixed(0);
    document.getElementById("stat-current-game-score").innerText = isNaN(neatScore) ? "0" : neatScore.toFixed(0);
    document.getElementById("stat-current-penalty").innerText = (neat.population[currentGenome]?.penalty || 0).toFixed(1);

    let anz_nodes = neat.population[currentGenome].nodes.length;
    if (anz_nodes > biggestSize) {
        biggestSize = anz_nodes;
        document.getElementById('stat-eta-score').innerText = biggestSize;
    }
}

Pacman.User = function (game, map) {

    var position  = null,
        direction = null,
        eaten     = null,
        due       = null, 
        lives     = null,
        score     = 0,
        keyMap    = {};
    
    keyMap[KEY.ARROW_LEFT]  = LEFT;
    keyMap[KEY.ARROW_UP]    = UP;
    keyMap[KEY.ARROW_RIGHT] = RIGHT;
    keyMap[KEY.ARROW_DOWN]  = DOWN;

    function addScore(nScore) { 
        score += nScore;
        if (score >= 10000 && score - nScore < 10000) { 
            lives += 1;
        }
    };

    function theScore() { 
        return score;
    };

    function loseLife() { 
        lives -= 1;
    };

    function getLives() {
        return lives;
    };

    function initUser() {
        score = 0;
        lives = 1;
        newLevel();
    }
    
    function newLevel() {
        resetPosition();

        eaten = 0;
    };
    
    function resetPosition() {
        position = {"x": 90, "y": 120};
        direction = LEFT;
        due = LEFT;
    };
    
    function reset() {
        initUser();
        resetPosition();
    };        
    
    function keyDown(e) {
        if (typeof keyMap[e.keyCode] !== "undefined") { 
            due = keyMap[e.keyCode];
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
        return false;
	};

    function getNewCoord(dir, current) {   
        return {
            "x": current.x + (dir === LEFT && -2 || dir === RIGHT && 2 || 0),
            "y": current.y + (dir === DOWN && 2 || dir === UP    && -2 || 0)
        };
    };

    function onWholeSquare(x) {
        return x % 10 === 0;
    };

    function pointToCoord(x) {
        return Math.round(x/10);
    };
    
    function nextSquare(x, dir) {
        var rem = x % 10;
        if (rem === 0) { 
            return x; 
        } else if (dir === RIGHT || dir === DOWN) { 
            return x + (10 - rem);
        } else {
            return x - rem;
        }
    };

    function next(pos, dir) {
        return {
            "y" : pointToCoord(nextSquare(pos.y, dir)),
            "x" : pointToCoord(nextSquare(pos.x, dir)),
        };                               
    };

    function onGridSquare(pos) {
        return onWholeSquare(pos.y) && onWholeSquare(pos.x);
    };

    function isOnSamePlane(due, dir) { 
        return ((due === LEFT || due === RIGHT) && 
                (dir === LEFT || dir === RIGHT)) || 
            ((due === UP || due === DOWN) && 
             (dir === UP || dir === DOWN));
    };

    function move(ctx) {
        
        var npos        = null, 
            nextWhole   = null, 
            oldPosition = position,
            block       = null;
        
        if (due !== direction) {
            npos = getNewCoord(due, position);
            
            if (isOnSamePlane(due, direction) || 
                (onGridSquare(position) && 
                 map.isFloorSpace(next(npos, due)))) {
                direction = due;
            } else {
                npos = null;
            }
        }

        if (npos === null) {
            npos = getNewCoord(direction, position);
        }
        
        if (onGridSquare(position) && map.isWallSpace(next(npos, direction))) {
            direction = NONE;
        }

        if (direction === NONE) {
            return {"new" : position, "old" : position};
        }
        
        if (npos.y === 100 && npos.x >= 190 && direction === RIGHT) {
            npos = {"y": 100, "x": -10};
        }
        
        if (npos.y === 100 && npos.x <= -12 && direction === LEFT) {
            npos = {"y": 100, "x": 190};
        }
        
        position = npos;        
        nextWhole = next(position, direction);
        
        block = map.block(nextWhole);        
        
        if ((isMidSquare(position.y) || isMidSquare(position.x)) &&
            block === Pacman.BISCUIT || block === Pacman.PILL) {
            
            map.setBlock(nextWhole, Pacman.EMPTY);           
            addScore((block === Pacman.BISCUIT) ? 10 : 50);
            eaten += 1;
            
            if (eaten === 182) {
                game.completedLevel();
            }
            
            if (block === Pacman.PILL) { 
                game.eatenPill();
            }
        }   
                
        return {
            "new" : position,
            "old" : oldPosition
        };
    };

    function isMidSquare(x) { 
        var rem = x % 10;
        return rem > 3 || rem < 7;
    };

    function calcAngle(dir, pos) { 
        if (dir == RIGHT && (pos.x % 10 < 5)) {
            return {"start":0.25, "end":1.75, "direction": false};
        } else if (dir === DOWN && (pos.y % 10 < 5)) { 
            return {"start":0.75, "end":2.25, "direction": false};
        } else if (dir === UP && (pos.y % 10 < 5)) { 
            return {"start":1.25, "end":1.75, "direction": true};
        } else if (dir === LEFT && (pos.x % 10 < 5)) {             
            return {"start":0.75, "end":1.25, "direction": true};
        }
        return {"start":0, "end":2, "direction": false};
    };

    function drawDead(ctx, amount) { 

        var size = map.blockSize, 
            half = size / 2;

        if (amount >= 1) { 
            return;
        }

        ctx.fillStyle = "#FFFF00";
        ctx.beginPath();        
        ctx.moveTo(((position.x/10) * size) + half, 
                   ((position.y/10) * size) + half);
        
        ctx.arc(((position.x/10) * size) + half, 
                ((position.y/10) * size) + half,
                half, 0, Math.PI * 2 * amount, true); 
        
        ctx.fill();    
    };

    function draw(ctx) { 

        var s     = map.blockSize, 
            angle = calcAngle(direction, position);

        ctx.fillStyle = "#FFFF00";

        ctx.beginPath();        

        ctx.moveTo(((position.x/10) * s) + s / 2,
                   ((position.y/10) * s) + s / 2);
        
        ctx.arc(((position.x/10) * s) + s / 2,
                ((position.y/10) * s) + s / 2,
                s / 2, Math.PI * angle.start, 
                Math.PI * angle.end, angle.direction); 
        
        ctx.fill();    
    };
    
    initUser();

    return {
        "draw"          : draw,
        "drawDead"      : drawDead,
        "loseLife"      : loseLife,
        "getLives"      : getLives,
        "score"         : score,
        "addScore"      : addScore,
        "theScore"      : theScore,
        "keyDown"       : keyDown,
        "move"          : move,
        "newLevel"      : newLevel,
        "reset"         : reset,
        "resetPosition" : resetPosition,
        "setDue"        : function(dir) { due = dir; }
    };
};

Pacman.Map = function (size) {
    
    var height    = null, 
        width     = null, 
        blockSize = size,
        pillSize  = 0,
        map       = null;
    
    function withinBounds(y, x) {
        return y >= 0 && y < height && x >= 0 && x < width;
    }
    
    function isWall(pos) {
        return withinBounds(pos.y, pos.x) && map[pos.y][pos.x] === Pacman.WALL;
    }
    
    function isFloorSpace(pos) {
        if (!withinBounds(pos.y, pos.x)) {
            return false;
        }
        var peice = map[pos.y][pos.x];
        return peice === Pacman.EMPTY || 
            peice === Pacman.BISCUIT ||
            peice === Pacman.PILL;
    }
    
    function drawWall(ctx) {

        var i, j, p, line;
        
        ctx.strokeStyle = "#0000FF";
        ctx.lineWidth   = 5;
        ctx.lineCap     = "round";
        
        for (i = 0; i < Pacman.WALLS.length; i += 1) {
            line = Pacman.WALLS[i];
            ctx.beginPath();

            for (j = 0; j < line.length; j += 1) {

                p = line[j];
                
                if (p.move) {
                    ctx.moveTo(p.move[0] * blockSize, p.move[1] * blockSize);
                } else if (p.line) {
                    ctx.lineTo(p.line[0] * blockSize, p.line[1] * blockSize);
                } else if (p.curve) {
                    ctx.quadraticCurveTo(p.curve[0] * blockSize, 
                                         p.curve[1] * blockSize,
                                         p.curve[2] * blockSize, 
                                         p.curve[3] * blockSize);   
                }
            }
            ctx.stroke();
        }
    }
    
    function reset() {       
        map    = JSON.parse(JSON.stringify(Pacman.MAP));
        height = map.length;
        width  = map[0].length;        
    };

    function block(pos) {
        return map[pos.y][pos.x];
    };
    
    function setBlock(pos, type) {
        map[pos.y][pos.x] = type;
    };

    function drawPills(ctx) { 

        if (++pillSize > 30) {
            pillSize = 0;
        }
        
        for (i = 0; i < height; i += 1) {
		    for (j = 0; j < width; j += 1) {
                if (map[i][j] === Pacman.PILL) {
                    ctx.beginPath();

                    ctx.fillStyle = "#000";
		            ctx.fillRect((j * blockSize), (i * blockSize), 
                                 blockSize, blockSize);

                    ctx.fillStyle = "#FFF";
                    ctx.arc((j * blockSize) + blockSize / 2,
                            (i * blockSize) + blockSize / 2,
                            Math.abs(5 - (pillSize/3)), 
                            0, 
                            Math.PI * 2, false); 
                    ctx.fill();
                    ctx.closePath();
                }
		    }
	    }
    };
    
    function draw(ctx) {
        
        var i, j, size = blockSize;

        ctx.fillStyle = "#000";
	    ctx.fillRect(0, 0, width * size, height * size);

        drawWall(ctx);
        
        for (i = 0; i < height; i += 1) {
		    for (j = 0; j < width; j += 1) {
			    drawBlock(i, j, ctx);
		    }
	    }
    };
    
    function drawBlock(y, x, ctx) {

        var layout = map[y][x];

        if (layout === Pacman.PILL) {
            return;
        }

        ctx.beginPath();
        
        if (layout === Pacman.EMPTY || layout === Pacman.BLOCK || 
            layout === Pacman.BISCUIT) {
            
            ctx.fillStyle = "#000";
		    ctx.fillRect((x * blockSize), (y * blockSize), 
                         blockSize, blockSize);

            if (layout === Pacman.BISCUIT) {
                ctx.fillStyle = "#FFF";
		        ctx.fillRect((x * blockSize) + (blockSize / 2.5), 
                             (y * blockSize) + (blockSize / 2.5), 
                             blockSize / 6, blockSize / 6);
	        }
        }
        ctx.closePath();	 
    };

    reset();
    
    return {
        "draw"         : draw,
        "drawBlock"    : drawBlock,
        "drawPills"    : drawPills,
        "block"        : block,
        "setBlock"     : setBlock,
        "reset"        : reset,
        "isWallSpace"  : isWall,
        "isFloorSpace" : isFloorSpace,
        "height"       : height,
        "width"        : width,
        "blockSize"    : blockSize,
        "map"          : map,
        "getMap"       : function() { return map; }  // ← hinzufügen
    };
};


var PACMAN = (function () {

    var state        = WAITING,
        audio        = null,
        ghosts       = [],
        ghostSpecs   = ["#00FFDE", "#FF0000", "#FFB8DE", "#FFB847"],
        eatenCount   = 0,
        level        = 0,
        tick         = 0,
        ghostPos, userPos, 
        stateChanged = true,
        timerStart   = null,
        lastTime     = 0,
        ctx          = null,
        timer        = null,
        map          = null,
        user         = null,
        stored       = null;

    function getTick() { 
        return tick;
    };

    function drawScore(text, position) {
        ctx.fillStyle = "#FFFFFF";
        ctx.font      = "12px BDCartoonShoutRegular";
        ctx.fillText(text, 
                     (position["new"]["x"] / 10) * map.blockSize, 
                     ((position["new"]["y"] + 5) / 10) * map.blockSize);
    }
    
    function dialog(text) {
        ctx.fillStyle = "#FFFF00";
        ctx.font      = "14px BDCartoonShoutRegular";
        var width = ctx.measureText(text).width,
            x     = ((map.width * map.blockSize) - width) / 2;        
        ctx.fillText(text, x, (map.height * 10) + 8);
    }
    
    function startLevel() {        
        user.resetPosition();
        for (var i = 0; i < ghosts.length; i += 1) { 
            ghosts[i].reset();
        }
        timerStart = tick;
        setState(COUNTDOWN);
    }    

    function startNewGame() {
        tick = 0;
        setState(WAITING);
        level = 1;
        user.reset();
        map.reset();
        map.draw(ctx);
        startLevel();
    }

    function keyDown(e) {
        if (e.keyCode === KEY.N) {
            startNewGame();
        } else if (e.keyCode === KEY.P && state === PAUSE) {
            map.draw(ctx);
            setState(stored);
        } else if (e.keyCode === KEY.P) {
            stored = state;
            setState(PAUSE);
            map.draw(ctx);
            dialog("Paused");
        } else if (state !== PAUSE) {   
            return user.keyDown(e);
        }
        return true;
    }    

    function loseLife() {   
        
        const penalty = neat.population[currentGenome].penalty || 0;
        let fitness = calcFitness(user.theScore(), penalty, tick);

        stallCounter = 0;
        last_X = 0;
        last_Y = 0;

        if (fitness > bestFitness) bestFitness = fitness;

        neat.population[currentGenome].score = fitness;
        generationScores.push(fitness);
        generationGameScores.push(user.theScore());
        generationPenalties.push(penalty);
        generationSurvivalBonuses.push(tick * 0.2); //[chart]
        generationTicks.push(tick);
        generationNodes.push(neat.population[currentGenome].nodes.length);
        accumulatedGhostDistance = 0;
        ghostDistanceSamples = 0;
        currentGenome++;
        drawNetwork();
        
        
        if (currentGenome >= neat.population.length) {
            let avgFitness = generationScores.reduce((a, b) => a + b, 0) / generationScores.length;
            let avgGameScore = generationGameScores.reduce((a, b) => a + b, 0) / generationGameScores.length;
            let avgPenalty = generationPenalties.reduce((a, b) => a + b, 0) / generationPenalties.length;
            let avgSurvivalBonus = generationSurvivalBonuses.reduce((a, b) => a + b, 0) / generationSurvivalBonuses.length;
            let avgLifespan = generationTicks.reduce((a, b) => a + b, 0) / generationTicks.length;
            let avgNodes = generationNodes.reduce((a, b) => a + b, 0) / generationNodes.length;

            neat.evolve();
            currentGenome = 0;
            generationCount++;
            generationScores = []; // ← Reset für nächste Generation
            generationGameScores = []; // ← Reset für nächste Generation
            generationPenalties = []; // ← Reset für nächste Generation
            generationSurvivalBonuses = []; // ← Reset für nächste Generation
            generationTicks = []; // ← Reset für nächste Generation

            
            if (generationCount % 2 === 0) {
                const sorted = [...neat.population].sort((a, b) => (b.score || 0) - (a.score || 0));
                const best = sorted[0];
                
                if (best) {
                    const replaceCount = Math.max(1, Math.floor(neat.population.length * 0.05));
                    for (let i = 0; i < replaceCount; i++) {
                        const mutant = Network.fromJSON(best.toJSON()); // statt best.clone()
                        for (let j = 0; j < 10; j++) {
                            mutant.mutate(neat.selectMutationMethod(mutant));
                        }
                        neat.population[neat.population.length - 1 - i] = mutant;
                    }
                }
            }

            // Charts nur hier updaten
            if (avgChart && bestChart && avgTick && nodesChart) {
                pushToChart(avgChart,  avgFitness, avgGameScore, avgPenalty, avgSurvivalBonus);
                pushToChart(bestChart, bestFitness);
                pushToChart(avgTick,  avgLifespan);
                pushToChart(nodesChart, avgNodes);
            }

            updateStatsPanel(fitness, tick);
            //autoSave();
        }

        setState(WAITING);
        user.loseLife();
        if (user.getLives() > 0) {
            startLevel();
        }  else {
            startNewGame();
        }
    }

    function setState(nState) { 
        state = nState;
        stateChanged = true;
    };
    
    function collided(user, ghost) {
        return (Math.sqrt(Math.pow(ghost.x - user.x, 2) + 
                          Math.pow(ghost.y - user.y, 2))) < 10;
    };

    function drawFooter() {
        
        var topLeft  = (map.height * map.blockSize),
            textBase = topLeft + 17;
        
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, topLeft, (map.width * map.blockSize), 30);
        
        ctx.fillStyle = "#FFFF00";

        for (var i = 0, len = user.getLives(); i < len; i++) {
            ctx.fillStyle = "#FFFF00";
            ctx.beginPath();
            ctx.moveTo(150 + (25 * i) + map.blockSize / 2,
                       (topLeft+1) + map.blockSize / 2);
            
            ctx.arc(150 + (25 * i) + map.blockSize / 2,
                    (topLeft+1) + map.blockSize / 2,
                    map.blockSize / 2, Math.PI * 0.25, Math.PI * 1.75, false);
            ctx.fill();
        }

        ctx.font = "bold 16px sans-serif";
        ctx.fillText("s", 10, textBase);

        ctx.fillStyle = "#FFFF00";
        ctx.font      = "14px BDCartoonShoutRegular";
        ctx.fillText("Score: " + user.theScore(), 30, textBase);
        ctx.fillText("Level: " + level, 260, textBase);
    }

    function redrawBlock(pos) {
        map.drawBlock(Math.floor(pos.y/10), Math.floor(pos.x/10), ctx);
        map.drawBlock(Math.ceil(pos.y/10), Math.ceil(pos.x/10), ctx);
    }

    function mainUpdate() {
        var i, len, u, nScore;

        ghostPos = [];
        for (i = 0, len = ghosts.length; i < len; i += 1) {
            ghostPos.push(ghosts[i].move(ctx));
        }
        u = user.move(ctx);
        userPos = u["new"];

        for (i = 0, len = ghosts.length; i < len; i += 1) {
            if (collided(userPos, ghostPos[i]["new"])) {
                if (ghosts[i].isVunerable()) {
                    ghosts[i].eat();
                    eatenCount += 1;
                    nScore = eatenCount * 50;
                    user.addScore(nScore);
                    setState(EATEN_PAUSE);
                    timerStart = tick;
                } else if (ghosts[i].isDangerous()) {
                    setState(DYING);
                    timerStart = tick;
                }
            }
        }

        return u; // brauchen wir für u.old im Draw
    }

    function mainDraw(u) {
        var i, len;

        for (i = 0, len = ghosts.length; i < len; i += 1) {
            redrawBlock(ghostPos[i].old);
        }
        redrawBlock(u.old);

        for (i = 0, len = ghosts.length; i < len; i += 1) {
            ghosts[i].draw(ctx);
        }
        user.draw(ctx);

        if (state === EATEN_PAUSE) {
            // drawScore war vorher im Update — jetzt hier weil es Zeichnen ist
            drawScore(eatenCount * 50, ghostPos.find(g => collided(userPos, g["new"])));
        }
    }

    function mainLoop() {
        if (state !== PAUSE) { ++tick; }
        if (state === PLAYING) {
            if (tick % 3 === 0) { aiStep(tick); }
            const u = mainUpdate();
            if (tick % 500 === 0) {
                mainDraw(u);
            }
        } else if (state === WAITING && stateChanged) {
            stateChanged = false;
            map.draw(ctx);
            dialog("Press N to start a New game");
        } else if (state === EATEN_PAUSE && (tick - timerStart) > (Pacman.FPS / 3)) {
            map.draw(ctx);
            setState(PLAYING);
        } else if (state === DYING) {
            if (tick - timerStart > (Pacman.FPS * 0.3)) {
                loseLife();
            } else {
                redrawBlock(userPos);
                for (i = 0, len = ghosts.length; i < len; i += 1) {
                    if (ghostPos[i]?.old) redrawBlock(ghostPos[i].old);
                    ghostPos.push(ghosts[i].draw(ctx));
                }
                ghostPos = [];
                user.drawDead(ctx, (tick - timerStart) / (Pacman.FPS * 0.3));
            }
        } else if (state === COUNTDOWN) {
            map.draw(ctx);
            setState(PLAYING);
        }
    }

    function eatenPill() {
        timerStart = tick;
        eatenCount = 0;
        for (i = 0; i < ghosts.length; i += 1) {
            ghosts[i].makeEatable(ctx);
        }        
    };
    
    function completedLevel() {
        setState(WAITING);
        level += 1;
        map.reset();
        user.newLevel();
        tick = 0;
        startLevel();
    };

    function keyPress(e) { 
        if (state !== WAITING && state !== PAUSE) { 
            e.preventDefault();
            e.stopPropagation();
        }
    };
    
    function init(wrapper, root) {
        
        var i, len, ghost,
            blockSize = wrapper.offsetWidth / 19,
            canvas    = document.createElement("canvas");
        
        canvas.setAttribute("width", (blockSize * 19) + "px");
        canvas.setAttribute("height", (blockSize * 22) + 30 + "px");

        wrapper.appendChild(canvas);

        ctx  = canvas.getContext('2d');

        map   = new Pacman.Map(blockSize);
        user  = new Pacman.User({ 
            "completedLevel" : completedLevel, 
            "eatenPill"      : eatenPill 
        }, map);

        for (i = 0, len = ghostSpecs.length; i < len; i += 1) {
            ghost = new Pacman.Ghost({"getTick":getTick}, map, ghostSpecs[i]);
            ghosts.push(ghost);
        }
        
        map.draw(ctx);
        dialog("Loading ...");

        loaded()
    };
        
    function loaded() {
        dialog("Press N to Start");
        
        document.addEventListener("keydown", keyDown, true);
        document.addEventListener("keypress", keyPress, true); 

        function loop() {
            frameCount++;

            for (let i = 0; i < TICKS_PER_FRAME; i++) {
                mainLoop();
            }

            // Genau 1× pro echtem Frame:
            if (frameCount % 10 === 0) {
                map.drawPills(ctx);
                drawFooter();
                updateInfoPanel();
                updateStatsPanel(
                    calcFitness(user.theScore(), neat.population[currentGenome]?.penalty || 0, tick),
                    tick
                );
            }

            requestAnimationFrame(loop);
        }

        // Den Loop einmalig anstoßen
        requestAnimationFrame(loop);
    };
    
    return {
        "init" : init,
        "setDirection": function(dir) { user.setDue(dir); },
        "getInfo": function() {
            return {
                "userPos": userPos,
                "ghostPos": ghostPos,
                "map": map,
                "ghosts"   : ghosts        
            };
        },
    };
    
}());

/* Human readable keyCode index */
var KEY = {'BACKSPACE': 8, 'TAB': 9, 'NUM_PAD_CLEAR': 12, 'ENTER': 13, 'SHIFT': 16, 'CTRL': 17, 'ALT': 18, 'PAUSE': 19, 'CAPS_LOCK': 20, 'ESCAPE': 27, 'SPACEBAR': 32, 'PAGE_UP': 33, 'PAGE_DOWN': 34, 'END': 35, 'HOME': 36, 'ARROW_LEFT': 37, 'ARROW_UP': 38, 'ARROW_RIGHT': 39, 'ARROW_DOWN': 40, 'PRINT_SCREEN': 44, 'INSERT': 45, 'DELETE': 46, 'SEMICOLON': 59, 'WINDOWS_LEFT': 91, 'WINDOWS_RIGHT': 92, 'SELECT': 93, 'NUM_PAD_ASTERISK': 106, 'NUM_PAD_PLUS_SIGN': 107, 'NUM_PAD_HYPHEN-MINUS': 109, 'NUM_PAD_FULL_STOP': 110, 'NUM_PAD_SOLIDUS': 111, 'NUM_LOCK': 144, 'SCROLL_LOCK': 145, 'SEMICOLON': 186, 'EQUALS_SIGN': 187, 'COMMA': 188, 'HYPHEN-MINUS': 189, 'FULL_STOP': 190, 'SOLIDUS': 191, 'GRAVE_ACCENT': 192, 'LEFT_SQUARE_BRACKET': 219, 'REVERSE_SOLIDUS': 220, 'RIGHT_SQUARE_BRACKET': 221, 'APOSTROPHE': 222};

(function () {
	/* 0 - 9 */
	for (var i = 48; i <= 57; i++) {
        KEY['' + (i - 48)] = i;
	}
	/* A - Z */
	for (i = 65; i <= 90; i++) {
        KEY['' + String.fromCharCode(i)] = i;
	}
	/* NUM_PAD_0 - NUM_PAD_9 */
	for (i = 96; i <= 105; i++) {
        KEY['NUM_PAD_' + (i - 96)] = i;
	}
	/* F1 - F12 */
	for (i = 112; i <= 123; i++) {
        KEY['F' + (i - 112 + 1)] = i;
	}
})();

Pacman.WALL    = 0;
Pacman.BISCUIT = 1;
Pacman.EMPTY   = 2;
Pacman.BLOCK   = 3;
Pacman.PILL    = 4;

Pacman.MAP = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
	[0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
	[0, 4, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 4, 0],
	[0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0],
	[0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
	[0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0],
	[0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0],
	[0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
	[2, 2, 2, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 2, 2, 2],
	[0, 0, 0, 0, 1, 0, 1, 0, 0, 3, 0, 0, 1, 0, 1, 0, 0, 0, 0],
	[2, 2, 2, 2, 1, 1, 1, 0, 3, 3, 3, 0, 1, 1, 1, 2, 2, 2, 2],
	[0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0],
	[2, 2, 2, 0, 1, 0, 1, 1, 1, 2, 1, 1, 1, 0, 1, 0, 2, 2, 2],
	[0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0],
	[0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
	[0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0],
	[0, 4, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 4, 0],
	[0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0],
	[0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0],
	[0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0],
	[0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
	[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
];

function calculateQuadrants(liveMap) {
    let mapData = null;

    if (liveMap && typeof liveMap.getMap === 'function') {
        mapData = liveMap.getMap();
    }
    if (!mapData) {
        mapData = JSON.parse(JSON.stringify(Pacman.MAP)); // Fallback
    }

    const rows   = mapData.length;
    const cols   = mapData[0].length;
    const midRow = Math.floor(rows / 2);
    const midCol = Math.floor(cols / 2);

    let stats = {
        obenLinks:   { biscuits: 0, pills: 0 },
        obenRechts:  { biscuits: 0, pills: 0 },
        untenLinks:  { biscuits: 0, pills: 0 },
        untenRechts: { biscuits: 0, pills: 0 }
    };

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            let cell = mapData[r][c];
            if (cell === Pacman.BISCUIT || cell === Pacman.PILL) {
                let quadrant = (r < midRow ? "oben" : "unten") +
                               (c < midCol ? "Links" : "Rechts");
                if (cell === Pacman.BISCUIT) stats[quadrant].biscuits++;
                if (cell === Pacman.PILL)    stats[quadrant].pills++;
            }
        }
    }
    return stats;
}

function getDirection(g) {
    let dx = g["new"].x - g["old"].x;
    let dy = g["new"].y - g["old"].y;
    if (Math.abs(dx) > Math.abs(dy)) {
        return dx > 0 ? "Right" : "Left";
    } else {
        return dy > 0 ? "Down" : "Up";
    }
}

function getRadarView(map, userPos) {
    const range = 2; // 2 Felder in jede Richtung = 5x5

    // Umrechnung von Pixel in Array-Index
    let gridX = Math.round(userPos.x / 10);
    let gridY = Math.round(userPos.y / 10);

    let view = [];

    for (let dy = -range; dy <= range; dy++) {
        let row = [];
        for (let dx = -range; dx <= range; dx++) {
            let targetY = gridY + dy;
            let targetX = gridX + dx;

            // Prüfen, ob wir innerhalb der Map-Grenzen sind
            if (targetY >= 0 && targetY < map.length && 
                targetX >= 0 && targetX < map[0].length) {
                row.push(map[targetY][targetX]);
            } else {
                row.push(0); // Alles ausserhalb ist eine Wand
            }
        }
        view.push(row);
    }
    return view;
}

function calcFitness(score, penalty, tick) {
    // Tick in "echte Sekunden" normalisieren
    const realSeconds = tick / (Pacman.FPS * TICKS_PER_FRAME);
    const survivalBonus = realSeconds * 6; // z.B. 6 Punkte/Sekunde
    return survivalBonus + score * 2 - penalty; // Score stärker gewichten
}

function ghostData(ghostPos, userPos, info) {
    if (!ghostPos || !userPos || !Array.isArray(ghostPos)) {
        return [];
    }

    const ghostsData = ghostPos.map((g, i) => {
        let gx = g["new"].x - userPos.x;
        let gy = g["new"].y - userPos.y;
        let dist = Math.sqrt(gx * gx + gy * gy);
        
        // Richtung des Geistes berechnen (dx, dy)
        let dx = (g["old"] != null) ? g["new"].x - g["old"].x : 0;
        let dy = (g["old"] != null) ? g["new"].y - g["old"].y : 0;
        
        let seconds = info && info.ghosts ? info.ghosts[i].getEatableSecondsLeft() : 0;

        return { 
            x: gx, 
            y: gy, 
            dist: dist, 
            dx: Math.sign(dx), // -1, 0, oder 1
            dy: Math.sign(dy), // -1, 0, oder 1
            scared: Math.min(seconds, 4) / 4   // maximal 1.0
        };
    });
    return ghostsData.sort((a, b) => a.dist - b.dist);
}

let networkInstance = null; // Wir speichern die Instanz, um sie zu aktualisieren

function drawNetwork() {
    return;
    const net = neat.population[currentGenome];
    if (!net) return;

    const container = document.getElementById('network-viz');
    const width = container.clientWidth;

    const nodes = net.nodes.map(node => {
        let color = "#00FFAA"; 
        let xPos = 200; // Standard Mitte für Hidden
        let label = "";

        if (node.type === "input") { 
            color = "#555"; 
            xPos = 50; // Fest ganz links
            label = "IN";
        } else if (node.type === "output") { 
            color = "#FF5555"; 
            xPos = 450; // Fest ganz rechts
            label = "OUT";
        }
        
        return {
            id: node.index,
            label: label,
            x: xPos, // Wir setzen die X-Koordinate manuell
            // Wir lassen Y weg, damit die Physik die Knoten vertikal verteilt
            color: { background: color, border: "#1a1aff" },
            font: { color: '#888', size: 8 },
            shape: 'dot',
            size: 6
        };
    });

    const edges = net.connections.map(conn => {
        return {
            from: conn.from.index,
            to: conn.to.index,
            width: 0.5,
            color: {
                color: conn.weight > 0 ? "rgba(0, 255, 170, 0.2)" : "rgba(255, 85, 85, 0.2)"
            },
            arrows: { to: { enabled: true, scaleFactor: 0.3 } }
        };
    });

    const data = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };

    const options = {
        nodes: {
            physics: true // Physik an, damit sie sich vertikal nicht überlagern
        },
        edges: {
            smooth: { type: 'cubicBezier', forceDirection: 'horizontal' }
        },
        layout: {
            hierarchical: { enabled: false } // WICHTIG: Hierarchie aus!
        },
        physics: {
            enabled: true,
            solver: 'barnesHut',
            barnesHut: {
                gravitationalConstant: -2000,
                centralGravity: 0.1,
                springLength: 50,
                springConstant: 0.04
            },
            // Wir fixieren die X-Achse, damit sie nur nach oben/unten ausweichen
            disablePhysicsAfterStabilization: false
        }
    };

    if (networkInstance) {
        networkInstance.destroy();
    }
    networkInstance = new vis.Network(container, data, options);

    // Trick: Wir fixieren die X-Position nach dem Start, damit sie nicht wegdriften
    networkInstance.on("beforeDrawing", function (ctx) {
        nodes.forEach(n => {
            if (n.x !== undefined) {
                networkInstance.moveNode(n.id, n.x, networkInstance.getPositions([n.id])[n.id].y);
            }
        });
    });
}

Pacman.WALLS = [
    
    [{"move": [0, 9.5]}, {"line": [3, 9.5]},
     {"curve": [3.5, 9.5, 3.5, 9]}, {"line": [3.5, 8]},
     {"curve": [3.5, 7.5, 3, 7.5]}, {"line": [1, 7.5]},
     {"curve": [0.5, 7.5, 0.5, 7]}, {"line": [0.5, 1]},
     {"curve": [0.5, 0.5, 1, 0.5]}, {"line": [9, 0.5]},
     {"curve": [9.5, 0.5, 9.5, 1]}, {"line": [9.5, 3.5]}],

    [{"move": [9.5, 1]},
     {"curve": [9.5, 0.5, 10, 0.5]}, {"line": [18, 0.5]},
     {"curve": [18.5, 0.5, 18.5, 1]}, {"line": [18.5, 7]},
     {"curve": [18.5, 7.5, 18, 7.5]}, {"line": [16, 7.5]},
     {"curve": [15.5, 7.5, 15.5, 8]}, {"line": [15.5, 9]},
     {"curve": [15.5, 9.5, 16, 9.5]}, {"line": [19, 9.5]}],

    [{"move": [2.5, 5.5]}, {"line": [3.5, 5.5]}],

    [{"move": [3, 2.5]},
     {"curve": [3.5, 2.5, 3.5, 3]},
     {"curve": [3.5, 3.5, 3, 3.5]},
     {"curve": [2.5, 3.5, 2.5, 3]},
     {"curve": [2.5, 2.5, 3, 2.5]}],

    [{"move": [15.5, 5.5]}, {"line": [16.5, 5.5]}],

    [{"move": [16, 2.5]}, {"curve": [16.5, 2.5, 16.5, 3]},
     {"curve": [16.5, 3.5, 16, 3.5]}, {"curve": [15.5, 3.5, 15.5, 3]},
     {"curve": [15.5, 2.5, 16, 2.5]}],

    [{"move": [6, 2.5]}, {"line": [7, 2.5]}, {"curve": [7.5, 2.5, 7.5, 3]},
     {"curve": [7.5, 3.5, 7, 3.5]}, {"line": [6, 3.5]},
     {"curve": [5.5, 3.5, 5.5, 3]}, {"curve": [5.5, 2.5, 6, 2.5]}],

    [{"move": [12, 2.5]}, {"line": [13, 2.5]}, {"curve": [13.5, 2.5, 13.5, 3]},
     {"curve": [13.5, 3.5, 13, 3.5]}, {"line": [12, 3.5]},
     {"curve": [11.5, 3.5, 11.5, 3]}, {"curve": [11.5, 2.5, 12, 2.5]}],

    [{"move": [7.5, 5.5]}, {"line": [9, 5.5]}, {"curve": [9.5, 5.5, 9.5, 6]},
     {"line": [9.5, 7.5]}],
    [{"move": [9.5, 6]}, {"curve": [9.5, 5.5, 10.5, 5.5]},
     {"line": [11.5, 5.5]}],


    [{"move": [5.5, 5.5]}, {"line": [5.5, 7]}, {"curve": [5.5, 7.5, 6, 7.5]},
     {"line": [7.5, 7.5]}],
    [{"move": [6, 7.5]}, {"curve": [5.5, 7.5, 5.5, 8]}, {"line": [5.5, 9.5]}],

    [{"move": [13.5, 5.5]}, {"line": [13.5, 7]},
     {"curve": [13.5, 7.5, 13, 7.5]}, {"line": [11.5, 7.5]}],
    [{"move": [13, 7.5]}, {"curve": [13.5, 7.5, 13.5, 8]},
     {"line": [13.5, 9.5]}],

    [{"move": [0, 11.5]}, {"line": [3, 11.5]}, {"curve": [3.5, 11.5, 3.5, 12]},
     {"line": [3.5, 13]}, {"curve": [3.5, 13.5, 3, 13.5]}, {"line": [1, 13.5]},
     {"curve": [0.5, 13.5, 0.5, 14]}, {"line": [0.5, 17]},
     {"curve": [0.5, 17.5, 1, 17.5]}, {"line": [1.5, 17.5]}],
    [{"move": [1, 17.5]}, {"curve": [0.5, 17.5, 0.5, 18]}, {"line": [0.5, 21]},
     {"curve": [0.5, 21.5, 1, 21.5]}, {"line": [18, 21.5]},
     {"curve": [18.5, 21.5, 18.5, 21]}, {"line": [18.5, 18]},
     {"curve": [18.5, 17.5, 18, 17.5]}, {"line": [17.5, 17.5]}],
    [{"move": [18, 17.5]}, {"curve": [18.5, 17.5, 18.5, 17]},
     {"line": [18.5, 14]}, {"curve": [18.5, 13.5, 18, 13.5]},
     {"line": [16, 13.5]}, {"curve": [15.5, 13.5, 15.5, 13]},
     {"line": [15.5, 12]}, {"curve": [15.5, 11.5, 16, 11.5]},
     {"line": [19, 11.5]}],

    [{"move": [5.5, 11.5]}, {"line": [5.5, 13.5]}],
    [{"move": [13.5, 11.5]}, {"line": [13.5, 13.5]}],

    [{"move": [2.5, 15.5]}, {"line": [3, 15.5]},
     {"curve": [3.5, 15.5, 3.5, 16]}, {"line": [3.5, 17.5]}],
    [{"move": [16.5, 15.5]}, {"line": [16, 15.5]},
     {"curve": [15.5, 15.5, 15.5, 16]}, {"line": [15.5, 17.5]}],

    [{"move": [5.5, 15.5]}, {"line": [7.5, 15.5]}],
    [{"move": [11.5, 15.5]}, {"line": [13.5, 15.5]}],
    
    [{"move": [2.5, 19.5]}, {"line": [5, 19.5]},
     {"curve": [5.5, 19.5, 5.5, 19]}, {"line": [5.5, 17.5]}],
    [{"move": [5.5, 19]}, {"curve": [5.5, 19.5, 6, 19.5]},
     {"line": [7.5, 19.5]}],

    [{"move": [11.5, 19.5]}, {"line": [13, 19.5]},
     {"curve": [13.5, 19.5, 13.5, 19]}, {"line": [13.5, 17.5]}],
    [{"move": [13.5, 19]}, {"curve": [13.5, 19.5, 14, 19.5]},
     {"line": [16.5, 19.5]}],

    [{"move": [7.5, 13.5]}, {"line": [9, 13.5]},
     {"curve": [9.5, 13.5, 9.5, 14]}, {"line": [9.5, 15.5]}],
    [{"move": [9.5, 14]}, {"curve": [9.5, 13.5, 10, 13.5]},
     {"line": [11.5, 13.5]}],

    [{"move": [7.5, 17.5]}, {"line": [9, 17.5]},
     {"curve": [9.5, 17.5, 9.5, 18]}, {"line": [9.5, 19.5]}],
    [{"move": [9.5, 18]}, {"curve": [9.5, 17.5, 10, 17.5]},
     {"line": [11.5, 17.5]}],

    [{"move": [8.5, 9.5]}, {"line": [8, 9.5]}, {"curve": [7.5, 9.5, 7.5, 10]},
     {"line": [7.5, 11]}, {"curve": [7.5, 11.5, 8, 11.5]},
     {"line": [11, 11.5]}, {"curve": [11.5, 11.5, 11.5, 11]},
     {"line": [11.5, 10]}, {"curve": [11.5, 9.5, 11, 9.5]},
     {"line": [10.5, 9.5]}]
];