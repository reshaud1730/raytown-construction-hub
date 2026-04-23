const SUPABASE_URL = 'https://yjfprmwvzkydruxtogdg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZnBybXd2emt5ZHJ1eHRvZ2RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4OTg0NjAsImV4cCI6MjA5MjQ3NDQ2MH0.yLwEAiFht6i65e4AVtvEJGJSfrqUGG-MbuarRK22BsU';
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
    playerBalance: 0, treasuryBalance: 0, totalProjects: 0,
    currentCycle: 1, gamePhase: 0, manualDone: 0,
    fragments: 0, overclocked: false, botActive: false,
    gen: { working: false, endTime: 0, claimed: true }
};

function getManualReq() {
    if (state.gamePhase !== 1) return 0; 
    // Requirement adds a build on cycles 3, 6, and 8
    if (state.currentCycle >= 8) return 3;
    if (state.currentCycle >= 6) return 2;
    if (state.currentCycle >= 3) return 1;
    return 0;
}

function toggleMinigame() {
    const area = document.getElementById('minigame-area');
    area.style.display = area.style.display === 'none' ? 'block' : 'none';
    if (area.style.display === 'block') spawnFragment();
}

function spawnFragment() {
    if (document.getElementById('minigame-area').style.display === 'none') return;
    const canvas = document.getElementById('game-canvas');
    const frag = document.createElement('div');
    frag.className = 'fragment';
    frag.style.left = Math.random() * 80 + '%';
    frag.style.top = Math.random() * 80 + '%';
    frag.onclick = () => {
        state.fragments++;
        document.getElementById('frag-count').innerText = state.fragments;
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
    
    state.playerBalance += (totalYield * 0.95);
    state.treasuryBalance += (totalYield * 0.05);
    state.totalProjects++;

    if (!state.botActive) state.manualDone++;
    state.botActive = false;
    
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

function hireBot() {
    if (state.playerBalance < 100) return alert("Insufficient TNB");
    state.playerBalance -= 100;
    state.botActive = true;
    save();
}

async function save() {
    await supabase.from('operators').upsert({
        wallet: wallet, player_balance: state.playerBalance,
        treasury_balance: state.treasuryBalance, total_projects: state.totalProjects,
        game_phase: state.gamePhase, current_cycle: state.currentCycle,
        manual_done: state.manualDone
    });
    updateUI();
}

async function load() {
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
    document.getElementById('tnb-balance').innerText = state.playerBalance.toFixed(2);
    document.getElementById('ceo-treasury').innerText = state.treasuryBalance.toFixed(2);
    document.getElementById('dash-projects').innerText = state.totalProjects;
    document.getElementById('dash-cycle').innerText = state.currentCycle;
    document.getElementById('dash-rank').innerText = rank.title;
    document.getElementById('player-rank-title').innerText = rank.title;
    document.getElementById('manual-done').innerText = state.manualDone;
    document.getElementById('manual-req').innerText = getManualReq();
    document.getElementById('phase-tag').innerText = ["FOUNDATION", "MANAGEMENT", "CORPORATE"][state.gamePhase];
    document.getElementById('bot-tag').style.display = state.botActive ? "block" : "none";
    
    const genBtn = document.getElementById('green-btn');
    const syncBtn = document.getElementById('sync-btn');
    if (state.gen.working) {
        genBtn.style.display = 'none';
        syncBtn.style.display = 'block';
        document.getElementById('green-status').innerText = "STATUS: BUILDING...";
    } else {
        genBtn.style.display = 'block';
        syncBtn.style.display = 'none';
        document.getElementById('green-status').innerText = "STATUS: IDLE";
    }
    if (wallet && wallet.toLowerCase() === CEO_WALLET) document.getElementById('ceo-nav-btn').style.display = 'block';
}

function switchTab(id, btn) {
    document.querySelectorAll('main').forEach(m => m.style.display = 'none');
    document.getElementById(`${id}-screen`).style.display = 'block';
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
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
