// --- CONFIGURATION ---
// CLEANED URL: Removed /rest/v1/ to ensure connection to your new vault
const SUPABASE_URL = 'https://fjbwugejjlieqqufmiya.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqYnd1Z2VqamxpZXFxdWZtaXlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NDExOTIsImV4cCI6MjA5MjUxNzE5Mn0.KZ0L2ds7egV2hksbNpU4bA-oCjRTsJYVOy4vlbZq3M8';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const CEO_WALLET = "0xe46AcfE53b92010B5A9742c88278a57f00f28C25".toLowerCase();
const wallet = localStorage.getItem('fasttrack_operator_wallet');

const RANKS = [
    { title: "Node Builder", min: 0, bonus: 0, cut: 0.05 },
    { title: "Node Foreman", min: 75, bonus: 0.05, cut: 0.05 },
    { title: "Node Manager", min: 150, bonus: 0.05, cut: 0.05 },
    { title: "Raytown Legend", min: 600, bonus: 0.15, cut: 0.05 }
];

let state = {
    playerBalance: 0, 
    treasuryBalance: 0, 
    totalProjects: 0,
    currentCycle: 1, 
    gamePhase: 0, // 0: Foundation, 1: Management, 2: Corporate
    manualDone: 0,
    fragments: 0, 
    overclocked: false, 
    botActive: false,
    gen: { working: false, endTime: 0, claimed: true }
};

// --- WORKFORCE SCALING (Cycles 3, 6, 8) ---
function getManualReq() {
    if (state.gamePhase !== 1) return 0; 
    if (state.currentCycle >= 8) return 3;
    if (state.currentCycle >= 6) return 2;
    if (state.currentCycle >= 3) return 1;
    return 0;
}

function toggleMinigame() {
    const area = document.getElementById('minigame-area');
    if (!area) return;
    area.style.display = area.style.display === 'none' ? 'block' : 'none';
    if (area.style.display === 'block') spawnFragment();
}

function spawnFragment() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas || document.getElementById('minigame-area').style.display === 'none') return;
    
    const frag = document.createElement('div');
    frag.className = 'fragment';
    frag.style.left = Math.random() * 80 + '%';
    frag.style.top = Math.random() * 80 + '%';
    frag.onclick = () => {
        state.fragments++;
        const countDisp = document.getElementById('frag-count');
        if (countDisp) countDisp.innerText = state.fragments;
        frag.remove();
        if (state.fragments >= 10) {
            state.overclocked = true;
            state.fragments = 0;
            alert("OVERCLOCK ACTIVE!");
            toggleMinigame();
        } else { spawnFragment(); }
    };
    canvas.appendChild(frag);
    setTimeout(() => { if(frag) frag.remove(); spawnFragment(); }, 2000);
}

function startProject(type) {
    if (state.gen.working) return;
    let buildTime = state.overclocked ? 30000 : 60000;
    state.gen.working = true;
    state.gen.claimed = false;
    state.gen.endTime = Date.now() + buildTime;
    state.overclocked = false; 
    save();
}

function processPayout() {
    const rank = [...RANKS].reverse().find(r => state.totalProjects >= r.min) || RANKS[0];
    const totalYield = 100 * (1 + rank.bonus);
    
    // LOCKED 95/5 REVENUE SPLIT
    state.playerBalance += (totalYield * 0.95);
    state.treasuryBalance += (totalYield * 0.05);
    state.totalProjects++;

    if (!state.botActive) state.manualDone++;
    state.botActive = false;
    
    // Cycle Progression Check
    if (state.manualDone >= getManualReq() && state.totalProjects % 10 === 0) {
        state.currentCycle++;
        state.manualDone = 0;
        if (state.currentCycle > 9) {
            state.gamePhase = Math.min(state.gamePhase + 1, 2);
            state.currentCycle = 1;
        }
    }
    save();
}

// Rename function to buyBoost to match your hq.html button onclick
function buyBoost() {
    if (state.playerBalance < 100) return alert("Insufficient TNB");
    state.playerBalance -= 100;
    state.botActive = true;
    save();
}

async function save() {
    if (!wallet) return;
    await supabase.from('operators').upsert({
        wallet: wallet, 
        player_balance: state.playerBalance,
        treasury_balance: state.treasuryBalance, 
        total_projects: state.totalProjects,
        game_phase: state.gamePhase, 
        current_cycle: state.currentCycle,
        manual_done: state.manualDone
    });
    updateUI();
}

async function load() {
    if (!wallet) return;
    const { data } = await supabase.from('operators').select('*').eq('wallet', wallet).single();
    if (data) {
        state.playerBalance = data.player_balance || 0;
        state.treasuryBalance = data.treasury_balance || 0;
        state.totalProjects = data.total_projects || 0;
        state.gamePhase = data.game_phase || 0;
        state.currentCycle = data.current_cycle || 1;
        state.manualDone = data.manual_done || 0;
    }
    updateUI();
}

function updateUI() {
    const rank = [...RANKS].reverse().find(r => state.totalProjects >= r.min) || RANKS[0];
    
    // Sync displays with HQ.html IDs
    document.getElementById('tnb-balance').innerText = state.playerBalance.toFixed(2);
    document.getElementById('dash-earnings').innerText = state.playerBalance.toFixed(2);
    document.getElementById('dash-projects').innerText = state.totalProjects;
    document.getElementById('cycle-display').innerText = state.currentCycle;
    document.getElementById('dash-rank').innerText = rank.title;
    document.getElementById('player-rank-title').innerText = rank.title;
    document.getElementById('ceo-treasury').innerText = state.treasuryBalance.toFixed(2);
    
    // Conditional displays for phase/bot
    if (document.getElementById('phase-tag')) {
        document.getElementById('phase-tag').innerText = ["FOUNDATION", "MANAGEMENT", "CORPORATE"][state.gamePhase];
    }
    
    const genStatus = document.querySelector('.status');
    const maintBtn = document.getElementById('maint-green');
    
    if (state.gen.working) {
        if (genStatus) genStatus.innerText = "Status: Building...";
        if (maintBtn) maintBtn.style.display = 'block';
    } else {
        if (genStatus) genStatus.innerText = "Status: Idle";
        if (maintBtn) maintBtn.style.display = 'none';
    }
    
    if (wallet && wallet.toLowerCase() === CEO_WALLET) {
        const ceoBtn = document.getElementById('ceo-nav-btn');
        if (ceoBtn) ceoBtn.style.display = 'block';
    }
}

function switchTab(id, btn) {
    document.querySelectorAll('main').forEach(m => m.style.display = 'none');
    document.getElementById(`${id}-screen`).style.display = 'block';
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

function performMaintenance(type) {
    alert("Maintenance complete! Build speed increased.");
    state.gen.endTime -= 10000; // Shave 10 seconds off
}

window.onload = load;
setInterval(() => {
    const now = Date.now();
    if (state.gen.working && now > state.gen.endTime && !state.gen.claimed) {
        state.gen.claimed = true;
        processPayout();
        state.gen.working = false;
        updateUI();
    }
}, 1000);
