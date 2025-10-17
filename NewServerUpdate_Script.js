// ==========================================
// ENHANCED TRANSFER FUNCTIONALITY
// ==========================================

// metrics list with transfer modes
// Enhanced metrics configuration for atomic swapping
const METRICS = [
    { key: "Vol", type: "int", mode: "swap", label: "Volume" },
    { key: "BS", type: "int", mode: "swap", label: "Belt Stops" },
    { key: "CF", type: "int", mode: "swap", label: "Chutefulls" },
    { key: "UTPct", type: "percent", mode: "swap", label: "Uptime %" },
    { key: "DecPct", type: "percent", mode: "swap", label: "Decline %" },
    { key: "CFPct", type: "percent", mode: "swap", label: "Chutefull %" },
];

// Station to Outbound mapping - defines which OB each station feeds into
const STATION_TO_OUTBOUND = {
    'S01': 'OB06', 'S02': 'OB06',
    'S03': 'OB07', 'S04': 'OB07',
    'S05': 'OB08', 'S06': 'OB08',
    'S07': 'OB09', 'S08': 'OB09',
    'S09': 'OB10', 'S10': 'OB10',
    'S11': 'OB01', 'S12': 'OB01',
    'S13': 'OB02', 'S14': 'OB02',
    'S15': 'OB03', 'S16': 'OB03',
    'S17': 'OB04', 'S18': 'OB04',
    'S19': 'OB05', 'S20': 'OB05',
    'S21': 'OB01',
    'S22': 'OB02'
};

// All station names for iteration
const ALL_STATIONS = [
    'S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09', 'S10',
    'S11', 'S12', 'S13', 'S14', 'S15', 'S16', 'S17', 'S18', 'S19', 'S20',
    'S21', 'S22'
];

// All outbound names
const ALL_OUTBOUNDS = ['OB01', 'OB02', 'OB03', 'OB04', 'OB05', 'OB06', 'OB07', 'OB08', 'OB09', 'OB10'];

// Transaction history for data preservation
let transactionHistory = [];
const MAX_HISTORY_SIZE = 10;

// ==========================================
// SWAP STATE MANAGER FOR PERSISTENCE
// ==========================================

let swapStateManager = {
    activeSwaps: new Map(),

    init() {
        this.activeSwaps.clear();
        console.log('SwapStateManager initialized');
    },

    registerSwap(stationA, stationB) {
        console.log(`Registering swap: ${stationA} ↔ ${stationB}`);
        this.activeSwaps.set(stationA, stationB);
        this.activeSwaps.set(stationB, stationA);
        console.log('Active swaps:', Array.from(this.activeSwaps.entries()));

        if (currentSortID) {
            saveSwapToServer(currentSortID, this.activeSwaps).then(success => {
                if (success) {
                    console.log('Swap successfully saved to database');
                    refreshSwapDisplay();
                } else {
                    console.warn('Failed to save swap to database');
                }
            });
        } else {
            console.warn('Cannot save swap: currentSortID is not set');
        }
    },

    getSwapPartner(station) {
        return this.activeSwaps.get(station);
    },

    isSwapped(station) {
        return this.activeSwaps.has(station);
    },

    getAllSwappedStations() {
        return Array.from(this.activeSwaps.keys());
    },

    clearSwap(station) {
        const partner = this.activeSwaps.get(station);
        if (partner) {
            this.activeSwaps.delete(station);
            this.activeSwaps.delete(partner);
            console.log(`Cleared swap between ${station} and ${partner}`);
        }
    },

    clearAllSwaps() {
        const swappedStations = this.getAllSwappedStations();
        this.init();
        console.log('Cleared all swaps');

        if (currentSortID) {
            saveSwapToServer(currentSortID, new Map()).then(success => {
                if (success) {
                    console.log('Swaps successfully cleared from database');
                } else {
                    console.warn('Failed to clear swaps from database');
                }
            });
        }

        return swappedStations;
    },

    getSwapSummary() {
        const swaps = [];
        const processed = new Set();

        this.activeSwaps.forEach((target, source) => {
            if (!processed.has(source) && !processed.has(target)) {
                swaps.push({ source, target });
                processed.add(source);
                processed.add(target);
            }
        });

        return swaps;
    }
};

swapStateManager.init();

// ==========================================
// SERVER-SIDE SWAP PERSISTENCE
// ==========================================

let currentSortID = null;

async function saveSwapToServer(sortID, swapMapping) {
    console.log('=== SAVE SWAP TO SERVER ===');
    console.log('SortID:', sortID);
    console.log('Swap Mapping (Map):', Array.from(swapMapping.entries()));

    try {
        const mappingObj = {};
        swapMapping.forEach((target, source) => {
            mappingObj[source] = target;
        });

        const payload = {
            sortid: sortID,
            mapping: mappingObj,
            message: `Swap state updated at ${new Date().toLocaleString()}`
        };

        console.log('Request Payload:', JSON.stringify(payload, null, 2));

        const response = await fetch('SwapStateServer.aspx', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        console.log('Response Status:', response.status, response.statusText);

        const responseText = await response.text();
        console.log('Response Body (raw):', responseText);

        if (!response.ok) {
            console.error('❌ SAVE FAILED - Response not OK');
            return false;
        }

        const result = JSON.parse(responseText);
        console.log('✅ SWAP SAVED SUCCESSFULLY:', result);
        return true;
    } catch (error) {
        console.error('❌ EXCEPTION DURING SAVE:', error);
        return false;
    }
}

async function loadSwapFromServer(sortID) {
    console.log('=== LOAD SWAP FROM SERVER ===');
    console.log('SortID:', sortID);

    try {
        const url = `SwapStateServer.aspx?sortid=${sortID}`;
        console.log('Fetching from URL:', url);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('Response Status:', response.status, response.statusText);

        const responseText = await response.text();
        console.log('Response Body (raw):', responseText);

        if (!response.ok) {
            console.error('❌ LOAD FAILED - Response not OK');
            return null;
        }

        const data = JSON.parse(responseText);
        console.log('Parsed Response Data:', data);

        if (data.mapping && typeof data.mapping === 'object') {
            const swapMap = new Map();
            const entries = Object.entries(data.mapping);
            console.log('Mapping Entries:', entries);

            entries.forEach(([source, target]) => {
                swapMap.set(source, target);
                console.log(`  Adding to Map: ${source} -> ${target}`);
            });

            console.log('✅ SWAP LOADED SUCCESSFULLY - Map size:', swapMap.size);
            return swapMap;
        }

        console.log('⚠️ No valid mapping found in response');
        return null;
    } catch (error) {
        console.error('❌ EXCEPTION DURING LOAD:', error);
        return null;
    }
}

function applyLoadedSwapState(swapMap) {
    if (!swapMap || swapMap.size === 0) {
        console.log('No swap state to apply');
        return;
    }

    console.log('Applying loaded swap state:', Array.from(swapMap.entries()));
    swapStateManager.activeSwaps.clear();

    swapMap.forEach((target, source) => {
        swapStateManager.activeSwaps.set(source, target);
    });

    console.log('Swap state applied. Active swaps:', Array.from(swapStateManager.activeSwaps.entries()));
}

// ==========================================
// DATA LOAD INTERCEPTOR FOR SWAP PERSISTENCE
// ==========================================

const swapInterceptor = {
    beforeDataLoad() {
        console.log('Preserving swap state before data load...');
        return swapStateManager.getAllSwappedStations();
    },

    restoreSwapsByCurrentState() {
        console.log('Restoring swaps using FRESH server data...');

        const swapSummary = swapStateManager.getSwapSummary();
        if (swapSummary.length === 0) {
            console.log('No active swaps to restore');
            return;
        }

        swapSummary.forEach(swap => {
            console.log(`Applying swap: ${swap.source} ↔ ${swap.target} to fresh data`);
            this.swapFreshData(swap.source, swap.target);
        });

        console.log('Swap restoration completed using fresh server data');
        console.log('Recalculating outbound totals after swap restoration...');
        setTimeout(() => recalculateOutboundTotals(), 100);
    },

    swapFreshData(stationA, stationB) {
        const freshDataA = {};
        const freshDataB = {};

        METRICS.forEach(metric => {
            const cellA = document.getElementById(`${stationA}_${metric.key}`);
            const cellB = document.getElementById(`${stationB}_${metric.key}`);

            if (cellA && cellB) {
                freshDataA[metric.key] = readCellValue(cellA, metric.type);
                freshDataB[metric.key] = readCellValue(cellB, metric.type);
            }
        });

        METRICS.forEach(metric => {
            const cellA = document.getElementById(`${stationA}_${metric.key}`);
            const cellB = document.getElementById(`${stationB}_${metric.key}`);

            if (cellA && cellB) {
                writeCellValue(cellA, freshDataB[metric.key], metric.type);
                writeCellValue(cellB, freshDataA[metric.key], metric.type);
            }
        });

        console.log(`Swapped fresh data: ${stationA} ↔ ${stationB}`);
    }
};

// ==========================================
// OUTBOUND RECALCULATION SYSTEM
// ==========================================

function getEffectiveOutbound(station) {
    return STATION_TO_OUTBOUND[station] || null;
}

function recalculateOutboundTotals() {
    console.log('=== RECALCULATING OUTBOUND TOTALS ===');

    const outboundData = {};
    ALL_OUTBOUNDS.forEach(ob => {
        outboundData[ob] = {
            Vol: 0,
            BS: 0,
            CF: 0,
            UTPct_sum: 0,
            UTPct_count: 0,
            DecPct: 0,
            CFPct_sum: 0,
            CFPct_count: 0
        };
    });

    ALL_STATIONS.forEach(stationPosition => {
        const targetOB = getEffectiveOutbound(stationPosition);
        if (!targetOB) return;

        console.log(`Processing ${stationPosition} → ${targetOB}`);

        METRICS.forEach(metric => {
            const cellId = `${stationPosition}_${metric.key}`;
            const cell = document.getElementById(cellId);

            if (cell) {
                const value = readCellValue(cell, metric.type);

                if (value !== null && value !== undefined) {
                    if (metric.key === 'Vol') {
                        outboundData[targetOB].Vol += value;
                    } else if (metric.key === 'BS') {
                        outboundData[targetOB].BS += value;
                    } else if (metric.key === 'CF') {
                        outboundData[targetOB].CF += value;
                    } else if (metric.key === 'UTPct' && value > 0) {
                        outboundData[targetOB].UTPct_sum += value;
                        outboundData[targetOB].UTPct_count++;
                    } else if (metric.key === 'DecPct') {
                        outboundData[targetOB].DecPct = Math.max(outboundData[targetOB].DecPct, value);
                    } else if (metric.key === 'CFPct' && value > 0) {
                        outboundData[targetOB].CFPct_sum += value;
                        outboundData[targetOB].CFPct_count++;
                    }
                }
            }
        });
    });

    ALL_OUTBOUNDS.forEach(ob => {
        if (outboundData[ob].UTPct_count > 0) {
            outboundData[ob].UTPct = outboundData[ob].UTPct_sum / outboundData[ob].UTPct_count;
        } else {
            outboundData[ob].UTPct = 0;
        }

        if (outboundData[ob].CFPct_count > 0) {
            outboundData[ob].CFPct = outboundData[ob].CFPct_sum / outboundData[ob].CFPct_count;
        } else {
            outboundData[ob].CFPct = 0;
        }
    });

    console.log('Calculated Outbound Data:', outboundData);

    ALL_OUTBOUNDS.forEach(ob => {
        const data = outboundData[ob];

        const volCell = document.getElementById(`${ob}_Vol`);
        if (volCell) volCell.textContent = data.Vol.toLocaleString();

        const bsCell = document.getElementById(`${ob}_BS`);
        if (bsCell) bsCell.textContent = data.BS.toLocaleString();

        const cfCell = document.getElementById(`${ob}_CF`);
        if (cfCell) cfCell.textContent = data.CF.toLocaleString();

        const utCell = document.getElementById(`${ob}_UTPct`);
        if (utCell) utCell.textContent = data.UTPct.toFixed(2) + '%';

        const decCell = document.getElementById(`${ob}_DecPct`);
        if (decCell) decCell.textContent = data.DecPct.toFixed(0) + '%';

        const cfPctCell = document.getElementById(`${ob}_CFPct`);
        if (cfPctCell) cfPctCell.textContent = data.CFPct.toFixed(0) + '%';

        console.log(`Updated ${ob}: Vol=${data.Vol}, BS=${data.BS}, CF=${data.CF}, UTPct=${data.UTPct.toFixed(2)}%`);
    });

    recalculateNorthSouthTotals(outboundData);
    console.log('=== OUTBOUND RECALCULATION COMPLETE ===');
}

function recalculateNorthSouthTotals(outboundData) {
    const northOBs = ['OB01', 'OB02', 'OB03', 'OB04', 'OB05'];
    const southOBs = ['OB06', 'OB07', 'OB08', 'OB09', 'OB10'];

    const northTotals = { Vol: 0, BS: 0, CF: 0, UTPct_sum: 0, UTPct_count: 0, DecPct: 0, CFPct_sum: 0, CFPct_count: 0 };
    northOBs.forEach(ob => {
        northTotals.Vol += outboundData[ob].Vol;
        northTotals.BS += outboundData[ob].BS;
        northTotals.CF += outboundData[ob].CF;
        northTotals.DecPct = Math.max(northTotals.DecPct, outboundData[ob].DecPct);
        if (outboundData[ob].UTPct > 0) {
            northTotals.UTPct_sum += outboundData[ob].UTPct;
            northTotals.UTPct_count++;
        }
        if (outboundData[ob].CFPct > 0) {
            northTotals.CFPct_sum += outboundData[ob].CFPct;
            northTotals.CFPct_count++;
        }
    });

    const southTotals = { Vol: 0, BS: 0, CF: 0, UTPct_sum: 0, UTPct_count: 0, DecPct: 0, CFPct_sum: 0, CFPct_count: 0 };
    southOBs.forEach(ob => {
        southTotals.Vol += outboundData[ob].Vol;
        southTotals.BS += outboundData[ob].BS;
        southTotals.CF += outboundData[ob].CF;
        southTotals.DecPct = Math.max(southTotals.DecPct, outboundData[ob].DecPct);
        if (outboundData[ob].UTPct > 0) {
            southTotals.UTPct_sum += outboundData[ob].UTPct;
            southTotals.UTPct_count++;
        }
        if (outboundData[ob].CFPct > 0) {
            southTotals.CFPct_sum += outboundData[ob].CFPct;
            southTotals.CFPct_count++;
        }
    });

    const northVol = document.getElementById('North_Vol');
    if (northVol) northVol.textContent = northTotals.Vol.toLocaleString();

    const northBS = document.getElementById('North_BS');
    if (northBS) northBS.textContent = northTotals.BS.toLocaleString();

    const northCF = document.getElementById('North_CF');
    if (northCF) northCF.textContent = northTotals.CF.toLocaleString();

    const northUTPct = document.getElementById('North_UTPct');
    if (northUTPct) {
        const avgUTPct = northTotals.UTPct_count > 0 ? northTotals.UTPct_sum / northTotals.UTPct_count : 0;
        northUTPct.textContent = avgUTPct.toFixed(2) + '%';
    }

    const northDecPct = document.getElementById('North_DecPct');
    if (northDecPct) northDecPct.textContent = northTotals.DecPct.toFixed(0) + '%';

    const northCFPct = document.getElementById('North_CFPct');
    if (northCFPct) {
        const avgCFPct = northTotals.CFPct_count > 0 ? northTotals.CFPct_sum / northTotals.CFPct_count : 0;
        northCFPct.textContent = avgCFPct.toFixed(0) + '%';
    }

    const southVol = document.getElementById('South_Vol');
    if (southVol) southVol.textContent = southTotals.Vol.toLocaleString();

    const southBS = document.getElementById('South_BS');
    if (southBS) southBS.textContent = southTotals.BS.toLocaleString();

    const southCF = document.getElementById('South_CF');
    if (southCF) southCF.textContent = southTotals.CF.toLocaleString();

    const southUTPct = document.getElementById('South_UTPct');
    if (southUTPct) {
        const avgUTPct = southTotals.UTPct_count > 0 ? southTotals.UTPct_sum / southTotals.UTPct_count : 0;
        southUTPct.textContent = avgUTPct.toFixed(2) + '%';
    }

    const southDecPct = document.getElementById('South_DecPct');
    if (southDecPct) southDecPct.textContent = southTotals.DecPct.toFixed(0) + '%';

    const southCFPct = document.getElementById('South_CFPct');
    if (southCFPct) {
        const avgCFPct = southTotals.CFPct_count > 0 ? southTotals.CFPct_sum / southTotals.CFPct_count : 0;
        southCFPct.textContent = avgCFPct.toFixed(0) + '%';
    }

    console.log('Updated North totals:', northTotals);
    console.log('Updated South totals:', southTotals);
}

function readCellValue(cell, type) {
    const txt = cell.textContent.replace(/\u00A0/g, "").trim();
    if (txt === "" || txt === "&nbsp;") return 0;
    if (type === "percent") {
        const m = txt.match(/-?\d*\.?\d+/);
        if (!m) return null;
        const n = parseFloat(m[0]);
        return Number.isNaN(n) ? null : n;
    }
    if (type === "float") {
        const n = parseFloat(txt.replace(/,/g, ""));
        return Number.isNaN(n) ? null : n;
    }
    const n = parseInt(txt.replace(/,/g, ""), 10);
    return Number.isNaN(n) ? null : n;
}

function writeCellValue(cell, value, type) {
    if (value === 0) {
        cell.textContent = type === "percent" ? "0%" : "0";
        return;
    }
    if (type === "percent") {
        cell.textContent = `${value}%`;
        return;
    }
    if (type === "float") {
        cell.textContent = Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
        return;
    }
    cell.textContent = parseInt(value, 10).toLocaleString();
}

// ==========================================
// DATA PRESERVATION & BACKUP SYSTEM
// ==========================================

function createStateBackup(stations) {
    const backup = {};
    stations.forEach(station => {
        backup[station] = {};
        METRICS.forEach(metric => {
            const cellId = `${station}_${metric.key}`;
            const cell = document.getElementById(cellId);
            if (cell) {
                backup[station][metric.key] = {
                    cellId: cellId,
                    value: readCellValue(cell, metric.type),
                    displayValue: cell.textContent
                };
            }
        });
    });
    return backup;
}

function addToTransactionHistory(transaction) {
    transactionHistory.unshift(transaction);
    if (transactionHistory.length > MAX_HISTORY_SIZE) {
        transactionHistory = transactionHistory.slice(0, MAX_HISTORY_SIZE);
    }
    updateTransactionPanel();
}

function rollbackTransaction(transactionIndex) {
    if (transactionIndex >= 0 && transactionIndex < transactionHistory.length) {
        const transaction = transactionHistory[transactionIndex];

        Object.keys(transaction.backup).forEach(station => {
            Object.keys(transaction.backup[station]).forEach(metricKey => {
                const backupData = transaction.backup[station][metricKey];
                const cell = document.getElementById(backupData.cellId);
                if (cell) {
                    writeCellValue(cell, backupData.value, METRICS.find(m => m.key === metricKey).type);
                }
            });
        });

        transactionHistory.splice(transactionIndex, 1);

        if (transaction.type === 'swap' && transaction.sourceStation && transaction.targetStation) {
            const sourceStation = transaction.sourceStation;
            const targetStation = transaction.targetStation;

            console.log(`Undoing swap: ${sourceStation} ↔ ${targetStation}`);

            swapStateManager.activeSwaps.delete(sourceStation);
            swapStateManager.activeSwaps.delete(targetStation);

            console.log('Updated active swaps after undo:', Array.from(swapStateManager.activeSwaps.entries()));

            if (currentSortID) {
                saveSwapToServer(currentSortID, swapStateManager.activeSwaps).then(success => {
                    if (success) {
                        console.log('Swap state updated in database after undo');
                        refreshSwapDisplay();
                    }
                });
            }
        }

        updateTransactionPanel();

        console.log('Recalculating outbound totals after undo...');
        setTimeout(() => recalculateOutboundTotals(), 50);

        showTransferStatus(`Rolled back: ${transaction.description}`, 'success');
    }
}

// ==========================================
// ATOMIC SWAP SYSTEM
// ==========================================

function atomicSwapStations(sourceStation, targetStation) {
    const backup = createStateBackup([sourceStation, targetStation]);

    swapStateManager.registerSwap(sourceStation, targetStation);

    const sourceValues = {};
    const targetValues = {};

    METRICS.forEach(metric => {
        const sourceCellId = `${sourceStation}_${metric.key}`;
        const targetCellId = `${targetStation}_${metric.key}`;

        const sourceCell = document.getElementById(sourceCellId);
        const targetCell = document.getElementById(targetCellId);

        if (sourceCell && targetCell) {
            sourceValues[metric.key] = readCellValue(sourceCell, metric.type);
            targetValues[metric.key] = readCellValue(targetCell, metric.type);
        }
    });

    let swappedCount = 0;
    METRICS.forEach(metric => {
        const sourceCellId = `${sourceStation}_${metric.key}`;
        const targetCellId = `${targetStation}_${metric.key}`;

        const sourceCell = document.getElementById(sourceCellId);
        const targetCell = document.getElementById(targetCellId);

        if (sourceCell && targetCell) {
            writeCellValue(sourceCell, targetValues[metric.key], metric.type);
            writeCellValue(targetCell, sourceValues[metric.key], metric.type);
            swappedCount++;
        }
    });

    addToTransactionHistory({
        type: 'swap',
        sourceStation: sourceStation,
        targetStation: targetStation,
        backup: backup,
        timestamp: new Date(),
        description: `Swapped all data between ${sourceStation} and ${targetStation}`
    });

    console.log('Recalculating outbound totals after swap...');
    setTimeout(() => recalculateOutboundTotals(), 50);

    return swappedCount === METRICS.length;
}

// ==========================================
// PREVIEW SYSTEM
// ==========================================

function showPreviewModal(sourceStation, targetStation) {
    const sourceData = {};
    const targetData = {};

    METRICS.forEach(metric => {
        const sourceCellId = `${sourceStation}_${metric.key}`;
        const targetCellId = `${targetStation}_${metric.key}`;

        const sourceCell = document.getElementById(sourceCellId);
        const targetCell = document.getElementById(targetCellId);

        if (sourceCell && targetCell) {
            sourceData[metric.key] = {
                current: sourceCell.textContent.trim() || '—',
                afterSwap: targetCell.textContent.trim() || '—'
            };
            targetData[metric.key] = {
                current: targetCell.textContent.trim() || '—',
                afterSwap: sourceCell.textContent.trim() || '—'
            };
        }
    });

    const modalHTML = `
        <div class="preview-modal" id="previewModal">
            <div class="preview-content">
                <div class="preview-header">
                    Transfer Preview: ${sourceStation} to ${targetStation}
                </div>

                <div class="preview-comparison">
                    <div class="station-preview">
                        <h3>${sourceStation} (Source to Target)</h3>
                        ${METRICS.map(metric => `
                            <div class="metric-row">
                                <span>${metric.label}:</span>
                                <span>${sourceData[metric.key].current} to ${sourceData[metric.key].afterSwap}</span>
                            </div>
                        `).join('')}
                    </div>

                    <div class="station-preview">
                        <h3>${targetStation} (Target to Source)</h3>
                        ${METRICS.map(metric => `
                            <div class="metric-row">
                                <span>${metric.label}:</span>
                                <span>${targetData[metric.key].current} to ${targetData[metric.key].afterSwap}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="preview-buttons">
                    <button class="preview-btn confirm" onclick="confirmSwap('${sourceStation}', '${targetStation}')">
                        Confirm Swap
                    </button>
                    <button class="preview-btn cancel" onclick="cancelSwap()">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function confirmSwap(sourceStation, targetStation) {
    const modal = document.getElementById('previewModal');
    if (modal) modal.remove();

    clearHighlights();
    highlightStationSameColor(sourceStation, 3000);
    highlightStationSameColor(targetStation, 3000);

    showTransferStatus(' Swapping station data...');

    setTimeout(() => {
        executeAtomicSwap(sourceStation, targetStation);
    }, 500);
}

function cancelSwap() {
    const modal = document.getElementById('previewModal');
    if (modal) modal.remove();
}

function executeAtomicSwap(sourceStation, targetStation) {
    const success = atomicSwapStations(sourceStation, targetStation);

    if (success) {
        showTransferStatus(`Successfully swapped all data between ${sourceStation} and ${targetStation}!`, 'success');
    } else {
        showTransferStatus(`Transfer failed. Some data could not be swapped.`, 'error');
    }

    return success;
}

function transferEverythingWithPreview() {
    const src = document.getElementById("masterSource").value;
    const dst = document.getElementById("masterTarget").value;

    if (src === dst) {
        alert("Source and target must be different.");
        return false;
    }

    if (!src || !dst) {
        alert("Please select both source and target stations.");
        return false;
    }

    showPreviewModal(src, dst);
    return false;
}

function clearHighlights() {
    document.querySelectorAll(
        '.table-highlight-active,.cell-highlight-active'
    ).forEach(el => el.classList.remove(
        'table-highlight-active', 'cell-highlight-active'
    ));
}

function highlightStationSameColor(station, duration = 3000) {
    const cells = document.querySelectorAll(`[id^="${station}_"]`);
    const tables = new Set();

    cells.forEach(cell => {
        cell.classList.add('cell-highlight-active');
        const td = cell.closest('td') || cell;
        td.classList.add('cell-highlight-active');

        const table = cell.closest('table');
        if (table) {
            table.classList.add('table-highlight-active');
            tables.add(table);
        }
    });

    if (duration > 0) {
        setTimeout(() => {
            cells.forEach(cell => {
                cell.classList.remove('cell-highlight-active');
                const td = cell.closest('td') || cell;
                td.classList.remove('cell-highlight-active');
            });
            tables.forEach(t => t.classList.remove('table-highlight-active'));
        }, duration);
    }
}

function showTransferStatus(message, type = 'info') {
    const statusDiv = document.getElementById('transferStatus');
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';

    if (type === 'success') {
        statusDiv.style.borderColor = '#27ae60';
    } else if (type === 'warning') {
        statusDiv.style.borderColor = '#f39c12';
    } else {
        statusDiv.style.borderColor = '#3498db';
    }

    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 2000);
}

// ==========================================
// TRANSACTION HISTORY UI
// ==========================================

function updateTransactionPanel() {
    let panel = document.getElementById('transactionPanel');

    if (!panel) {
        const panelHTML = `
            <div id="transactionPanel" class="transaction-panel" style="display: none;">
                <h3 style="color: #3498db; text-align: center; margin-bottom: 20px;"> Transaction History</h3>
                <div id="transactionList"></div>
                <div style="text-align: center; margin-top: 15px;">
                    <button onclick="toggleTransactionPanel()" class="transfer-btn">
                        Hide History
                    </button>
                    <button onclick="clearTransactionHistory()" class="transfer-btn" style="background: #e74c3c; margin-left: 10px;">
                        Clear History
                    </button>
                </div>
            </div>
        `;

        const transferSection = document.querySelector('.transfer-section');
        if (transferSection) {
            transferSection.insertAdjacentHTML('afterend', panelHTML);
            panel = document.getElementById('transactionPanel');
        }
    }

    const transactionList = document.getElementById('transactionList');
    if (transactionList) {
        if (transactionHistory.length === 0) {
            transactionList.innerHTML = '<div style="text-align: center; color: #95a5a6; padding: 20px;">No transactions yet</div>';
        } else {
            transactionList.innerHTML = transactionHistory.map((transaction, index) => `
                <div class="transaction-item">
                    <div class="transaction-info">
                        <strong>${transaction.description}</strong><br>
                        <small style="color: #bdc3c7;">${transaction.timestamp.toLocaleString()}</small>
                    </div>
                    <div class="transaction-actions">
                        <button class="undo-btn" onclick="rollbackTransaction(${index})"
                                title="Rollback to this state">
                            ↶ Undo
                        </button>
                    </div>
                </div>
            `).join('');
        }
    }
}

function toggleTransactionPanel() {
    const panel = document.getElementById('transactionPanel');
    if (panel) {
        if (panel.style.display === 'none') {
            panel.style.display = 'block';
            updateTransactionPanel();
        } else {
            panel.style.display = 'none';
        }
    }
}

function clearTransactionHistory() {
    if (confirm('Are you sure you want to clear all transaction history? This cannot be undone.')) {
        transactionHistory = [];
        updateTransactionPanel();
        showTransferStatus('Transaction history cleared', 'success');
    }
}

function handleEnhancedTransfer() {
    const btn = document.getElementById('transferBtn');
    btn.disabled = true;

    const src = document.getElementById('masterSource').value;
    const dst = document.getElementById('masterTarget').value;

    if (src === dst) {
        alert('Source and target must be different.');
        btn.disabled = false;
        return;
    }

    if (!src || !dst) {
        alert('Please select both source and target stations.');
        btn.disabled = false;
        return;
    }

    try {
        transferEverythingWithPreview();
    } finally {
        setTimeout(() => (btn.disabled = false), 500);
    }
}

// ==========================================
// EXISTING FUNCTIONALITY (preserved)
// ==========================================

function GetNow() {
    var currentdate = new Date();
    var datetime = currentdate.getFullYear() + "-" +
        (currentdate.getMonth() + 1) + "-" +
        currentdate.getDate() + " " +
        ("0" + currentdate.getHours()).slice(-2) + ":" +
        ("0" + currentdate.getMinutes()).slice(-2) + ":" +
        ("0" + currentdate.getSeconds()).slice(-2);
    return datetime;
}

var criteria = '1';

function selectCriteria(c) {
    criteria = c;
    $('.button').removeClass('active');
    $('button[data-criteria="' + c + '"]').addClass('active');
    loadOutboundValues($("#sortSel").val(), criteria);
    loadExceptionValues($("#sortSel").val(), criteria);
    loadSmallsValues($("#sortSel").val(), criteria);
    loadIrregValues($("#sortSel").val(), criteria);
    loadPrimaryValues($("#sortSel").val(), criteria);
}

function loadOutboundValues(SortID, Criteria) {
    currentSortID = SortID;

    const preservedStations = swapInterceptor.beforeDataLoad();

    $.ajax({
        url: "HourlyQuicklookServer_DATA.aspx?sortid=" + SortID + "&hourid=" + Criteria,
        success: function (data) {
            $('#South tr').each(function (index) {
                if (index != 0 && index != 1 && index != 8) {
                    $.each(this.cells, function (index) {
                        if (index < 6) {
                            $(this).text("");
                        }
                    });
                }
            });

            $('#North tr').each(function (index) {
                if (index != 0 && index != 1 && index != 8) {
                    $.each(this.cells, function (index) {
                        if (index > 0) {
                            $(this).text("");
                        }
                    });
                }
            });

            names = Array("S11", "S12", "S13", "S14", "S15", "S16", "S17", "S18", "S19", "S20", "S21", "S22"
                , "S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08", "S09", "S10"
                , "OB01", "OB02", "OB03", "OB04", "OB05", "OB06", "OB07", "OB08", "OB09", "OB10"
                , "North", "South");

            for (n of names) {
                $("#" + n + "_CF").text(data[0]["Outbound_" + n + "_Chutefull"].toLocaleString())
                $("#" + n + "_BS").text(data[0]["Outbound_" + n + "_Beltstop"])
                $("#" + n + "_UTPct").text(data[0]["Outbound_" + n + "_UTPct"].toFixed(2) + "%")
                $("#" + n + "_Vol").text(data[0]["Outbound_" + n + "_InputVolume"].toLocaleString())
                $("#" + n + "_DecPct").text(data[0]["Outbound_" + n + "_Decline"] + "%")
                $("#" + n + "_CFPct").text(data[0]["Outbound_" + n + "_CFPct"] + "%")
            }

            setTimeout(() => {
                swapInterceptor.restoreSwapsByCurrentState();
            }, 100);
        }
    });
}

function loadExceptionValues(SortID, Criteria) {
    currentSortID = SortID;
    const preservedStations = swapInterceptor.beforeDataLoad();

    $.ajax({
        url: "HourlyQuicklookServer_DATA.aspx?sortid=" + SortID + "&hourid=" + Criteria,
        success: function (data) {
            $('Exceptions th').each(function (index) {
                if (index != 0 && index != 1 && index != 8) {
                    $.each(this.cells, function (index) {
                        if (index < 6) {
                            $(this).text("");
                        }
                    });
                }
            });

            names = Array("RC01", "RC02", "RC03", "RC04", "DA1C", "DA02", "SSR1", "SSR2", "SSR3");

            for (n of names) {
                $("#" + n + "_UTPct").text(data[0]["Exceptions_" + n + "_UTPct"].toFixed(2) + "%")
            }

            setTimeout(() => {
                swapInterceptor.restoreSwapsByCurrentState();
            }, 100);
        }
    });
}

function loadSmallsValues(SortID, Criteria) {
    currentSortID = SortID;
    const preservedStations = swapInterceptor.beforeDataLoad();

    $.ajax({
        url: "HourlyQuicklookServer_DATA.aspx?sortid=" + SortID + "&hourid=" + Criteria,
        success: function (data) {
            $('Smalls th').each(function (index) {
                if (index != 0 && index != 1 && index != 8) {
                    $.each(this.cells, function (index) {
                        if (index < 6) {
                            $(this).text("");
                        }
                    });
                }
            });

            names = Array("BF1", "BF2", "BF9", "SLS03", "SLS04", "SLS10", "SLS11", "SLS12", "SLS13", "SLS14", "SLS15", "SLS16", "SS1F1", "SS3F1", "SS4F1");

            for (n of names) {
                $("#" + n + "_UTPct").text(data[0]["Smalls_" + n + "_UTPct"].toFixed(2) + "%")
            }

            setTimeout(() => {
                swapInterceptor.restoreSwapsByCurrentState();
            }, 100);
        }
    });
}

function loadIrregValues(SortID, Criteria) {
    currentSortID = SortID;
    const preservedStations = swapInterceptor.beforeDataLoad();

    $.ajax({
        url: "HourlyQuicklookServer_DATA.aspx?sortid=" + SortID + "&hourid=" + Criteria,
        success: function (data) {
            $('Exceptions th').each(function (index) {
                if (index != 0 && index != 1 && index != 8) {
                    $.each(this.cells, function (index) {
                        if (index < 6) {
                            $(this).text("");
                        }
                    });
                }
            });

            names = Array("IR1_D01", "IR1_D02", "IR1_D03", "IR1_D04", "IR1_D05", "IR2_D06", "IR2_D07", "IR2_D08", "IR2_D09", "IR2_D10", "IR2_F1", "IR2_F2", "IR1_F1", "IR1_F2");

            for (n of names) {
                $("#" + n + "_UTPct").text(data[0]["Irreg_" + n + "_UTPct"].toFixed(2) + "%")
            }

            setTimeout(() => {
                swapInterceptor.restoreSwapsByCurrentState();
            }, 100);
        }
    });
}

function loadPrimaryValues(SortID, Criteria) {
    currentSortID = SortID;
    const preservedStations = swapInterceptor.beforeDataLoad();

    $.ajax({
        url: "HourlyQuicklookServer_DATA.aspx?sortid=" + SortID + "&hourid=" + Criteria,
        success: function (data) {
            $('Primary').each(function (index) {
                if (index != 0 && index != 1 && index != 8) {
                    $.each(this.cells, function (index) {
                        if (index < 6) {
                            $(this).text("");
                        }
                    });
                }
            });

            names = Array("NW", "NE", "SW", "SE", "Total", "NoReads");

            for (n of names) {
                $("#" + n + "_InputVolume").text(data[0]["Primary_" + n + "_InputVolume"].toLocaleString())
                $("#" + n + "_BeltStops").text(data[0]["Primary_" + n + "_BeltStops"])
                $("#" + n + "_NoReadsPct").text(data[0]["Primary_" + n + "_NoReadsPct"].toFixed(2) + "%")
            }

            setTimeout(() => {
                swapInterceptor.restoreSwapsByCurrentState();
            }, 100);
        }
    });
}

function openPrintDialog() {
    window.print();
}

// ==========================================
// SWAP MANAGEMENT UI FUNCTIONS
// ==========================================

function clearAllSwaps() {
    if (swapStateManager.getAllSwappedStations().length === 0) {
        showTransferStatus('No active swaps to clear', 'info');
        return;
    }

    const confirmMsg = `Are you sure you want to clear all active swaps?\n\nThis will restore all stations to their original server data.`;
    if (!confirm(confirmMsg)) {
        return;
    }

    const swappedStations = swapStateManager.getAllSwappedStations();

    swapStateManager.clearAllSwaps();

    console.log('Clearing swaps - reloading fresh data from server...');
    const currentSortId = $("#sortSel").val();
    const currentCriteria = criteria;

    loadOutboundValues(currentSortId, currentCriteria);
    loadExceptionValues(currentSortId, currentCriteria);
    loadSmallsValues(currentSortId, currentCriteria);
    loadIrregValues(currentSortId, currentCriteria);
    loadPrimaryValues(currentSortId, currentCriteria);

    refreshSwapDisplay();

    showTransferStatus(`Cleared all swaps and restored ${swappedStations.length} stations to original data`, 'success');
}

function refreshSwapDisplay() {
    const swapsList = document.getElementById('swapsList');
    const swapSummary = swapStateManager.getSwapSummary();

    if (swapSummary.length === 0) {
        swapsList.innerHTML = 'No active swaps';
        swapsList.style.color = '#95a5a6';
    } else {
        const swapTexts = swapSummary.map(swap =>
            `<span style="background: rgba(231, 76, 60, 0.2); padding: 2px 6px; border-radius: 4px; margin: 2px;">${swap.source} to ${swap.target}</span>`
        );
        swapsList.innerHTML = swapTexts.join(' ');
        swapsList.style.color = '#e74c3c';
    }

    const statusInfo = document.getElementById('swapStatusInfo');
    if (swapSummary.length > 0) {
        statusInfo.innerHTML = `${swapSummary.length} active swap(s) - Data will persist across hour changes and auto-refresh`;
        statusInfo.style.color = '#f39c12';
    } else {
        statusInfo.innerHTML = 'Swaps will persist across hour changes and auto-refresh cycles';
        statusInfo.style.color = '#bdc3c7';
    }
}

function showSwapDebugInfo() {
    console.log('=== SWAP DEBUG INFO ===');
    console.log('Active Swaps Map:', Array.from(swapStateManager.activeSwaps.entries()));
    console.log('Swap Summary:', swapStateManager.getSwapSummary());
    console.log('Transaction History:', transactionHistory);
    console.log('Transaction History Length:', transactionHistory.length);
    console.log('Current Sort ID:', currentSortID);

    const swapSummary = swapStateManager.getSwapSummary();

    const transactionSummary = transactionHistory.map((t, i) =>
        `  ${i + 1}. ${t.type}: ${t.description}`
    ).join('\n') || '  None';

    const debugMsg = `=== SWAP DEBUG INFO ===

Active Swaps: ${swapSummary.length} pair(s)
${swapSummary.map(s => `  • ${s.source} ↔ ${s.target}`).join('\n') || '  None'}

Transaction History: ${transactionHistory.length} transaction(s)
${transactionSummary}

Current Sort ID: ${currentSortID || 'Not set'}

(See browser console for detailed logs)`;

    alert(debugMsg);
}

// Initialize swap display on page load
setTimeout(() => {
    refreshSwapDisplay();
}, 1000);

// ==========================================
// DOCUMENT READY
// ==========================================

$(document).ready(function () {

    $('#dt').text(GetNow())

    $.getJSON('SortDateServer.aspx', function (data) {
        console.log('typeof data:', typeof data);
        console.log('raw preview:', JSON.stringify(data).slice(0, 200));

        $('#sortSel')
            .find('option')
            .remove()
            .end();

        for (var i in data) {
            var sortID = data[i].id;
            var sortDate = data[i].SortDate;
            var sortType = data[i].SortType;

            $('#sortSel').append($('<option>', {
                value: sortID,
                text: sortDate + ' - ' + sortType
            }));

            if (i == 0) {
                loadCurrentValues(sortID)
            }
        }
    });

    $("#sortSel").change(function () {
        loadCurrentValues($("#sortSel").val())
    });

    function loadCurrentValues(sortID) {
        console.log('[Hourly] sortid →', sortID);

        currentSortID = sortID;

        loadSwapFromServer(sortID).then(swapMap => {
            if (swapMap && swapMap.size > 0) {
                console.log('Loaded swap state from server, applying...');
                applyLoadedSwapState(swapMap);
                refreshSwapDisplay();
            }
        });

        const preservedStations = swapInterceptor.beforeDataLoad();

        $.ajax({
            url: '/middleware_alocal/HourlyQuicklookServer_BLDG.aspx',
            data: { sortid: sortID },
            dataType: 'json',
            cache: false,
            success: function (data, status, xhr) {
                if (typeof data === 'string') {
                    try { data = JSON.parse(data); } catch (e) {
                        console.error('Not JSON:', data);
                        return;
                    }
                }

                $('#HourlyTable tr').each(function (r) {
                    if (r > 0) $(this).find('td:gt(0)').text('');
                });

                for (let i = 0; i < data.length; i++) {
                    const row = data[i];
                    try {
                        $('#' + row.hourNumber + '_TS').text(row.TS);
                        $('#' + row.hourNumber + '_BUILDVol').text(Number(row.Building_Total_InputVolume || 0).toLocaleString());
                        $('#' + row.hourNumber + '_PriVol').text(Number(row.Primary_Total_InputVolume || 0).toLocaleString());
                        $('#' + row.hourNumber + '_ExVol').text(Number(row.Exceptions_Total_InputVolume || 0).toLocaleString());
                        $('#' + row.hourNumber + '_OBVol').text(Number(row.Outbound_Total_InputVolume || 0).toLocaleString());
                        $('#' + row.hourNumber + '_BFVol').text(Number(row.Bullfrog_Total_InputVolume || 0).toLocaleString());
                        $('#' + row.hourNumber + '_BFVolPct').text(Number(row.Percent_Smalls || 0).toLocaleString() + ' %');
                        $('#' + row.hourNumber + '_CF').text(Number(row.Outbound_Chutefull_Total || 0).toLocaleString());
                        $('#' + row.hourNumber + '_BS').text(Number(row.BeltStops_Total || 0).toLocaleString());
                        $('#' + row.hourNumber + '_DEFPct').text(Number(row.Defects_Percent || 0).toLocaleString() + ' %');
                        $('#' + row.hourNumber + '_PNRPct').text(Number(row.Primary_Total_NoReadsPct || 0).toLocaleString() + ' %');
                    } catch (_) { }
                }

                setTimeout(() => swapInterceptor.restoreSwapsByCurrentState(), 100);
            },
            error: function (jqXHR, textStatus, errorThrown) {
                console.error('[Hourly] request failed:', textStatus, errorThrown);
                console.error('Status:', jqXHR.status, 'Content-Type:', jqXHR.getResponseHeader('Content-Type'));
                console.error('Body:', (jqXHR.responseText || '').slice(0, 1500));
            }
        });
    }

    setInterval(function () {
        $('#dt').text(GetNow())
        loadCurrentValues($("#sortSel").val())
    }, 10000);

    selectCriteria(criteria);
});
