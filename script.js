const SUPABASE_URL = 'https://fjbwugejjlieqqufmiya.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqYnd1Z2VqamxpZXFxdWZtaXlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NDExOTIsImV4cCI6MjA5MjUxNzE5Mn0.KZ0L2ds7egV2hksbNpU4bA-oCjRTsJYVOy4vlbZq3M8';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const currentIGN = localStorage.getItem('raytown_ign');
const currentEmail = localStorage.getItem('raytown_email');
const CEO_WALLET = "0xe46AcfE53b92010B5A9742c88278a57f00f28C25".toLowerCase();

let state = {
    wallet: null, playerBalance: 0, treasuryBalance: 0, totalProjects: 0,
    currentCycle: 1, gamePhase: 0, manualDone: 0,
    fragments: 0, overclocked: false, gen: { working: false, endTime: 0, claimed: true }
};

const RANKS = [
    { title: "Node Builder", min: 0, bonus: 0 },
    { title: "Node Foreman", min: 75, bonus: 0.05 },
    { title: "Node Manager", min: 150, bonus: 0.05 },
    { title: "Raytown Legend", min: 600, bonus: 0.15 }
];

function getManualReq() {
    if (state.gamePhase !== 1) return 0;
    if (state.currentCycle >= 8) return 3;
    if (state.currentCycle >= 6) return 2;
    if (state.currentCycle >= 3) return 1;
    return 0;
}

async function linkWallet() {
    let addr = prompt("Enter your Base Wallet Address for payouts:");
    if (addr && addr.startsWith("0x")) {
        state.wallet = addr.toLowerCase();
        save();
        alert("Wallet Linked Successfully!");
    } else { alert("Invalid Address."); }
}

function startProject() {
    if (state.gen.working) return;
    let time = state.overclocked ? 30000 : 60000;
    state.gen.working = true;
    state.gen.claimed = false;
    state.gen.endTime = Date.now() + time;
    save();
}

function processPayout() {
    const rank = [...RANKS].reverse().find(r => state.totalProjects >= r.min) || RANKS[0];
    const totalYield = 100 * (1 + rank.bonus);
    
    // --- LOCKED 95/5 REVENUE SPLIT ---
    state.playerBalance += (totalYield * 0.95);
    state.treasuryBalance += (totalYield * 0.05);
    state.totalProjects++;
    state.manualDone++;

    // Progression Logic
    if (state.manualDone >= getManualReq() && state.totalProjects % 10 === 0) {
        state.currentCycle++;
        state.manualDone = 0;
        if (state.currentCycle > 9) {
            state.gamePhase = Math.min(state.gamePhase + 1, 2);
            state.currentCycle = 1;
        }
    }
    state.overclocked = false;
    save();
}

async function save() {
    await supabase.from('operators').upsert({
        upland_ign: currentIGN, email: currentEmail, wallet: state.wallet,
        player_balance: state.playerBalance, treasury_balance: state.treasuryBalance,
        total_projects: state.totalProjects, game_phase: state.gamePhase,
        current_cycle: state.currentCycle, manual_done: state.manualDone
    });
    updateUI();
}

async function load() {
    const { data } = await supabase.from('operators').select('*').eq('upland_ign', currentIGN).single();
    if (data) { state = { ...state, ...data }; }
    updateUI();
}

function updateUI() {
    const rank = [...RANKS].reverse().find(r => state.totalProjects >= r.min) || RANKS[0];
    document.getElementById('tnb-balance').innerText = state.playerBalance.toFixed(2);
    document.getElementById('cycle-display').innerText = state.currentCycle;
    document.getElementById('player-rank-title').innerText = rank.title;
    document.getElementById('dash-projects').innerText = state.totalProjects;
    document.getElementById('manual-done').innerText = state.manualDone;
    document.getElementById('manual-req').innerText = getManualReq();
    document.getElementById('phase-tag').innerText = ["FOUNDATION", "MANAGEMENT", "CORPORATE"][state.gamePhase];
    document.getElementById('ceo-treasury').innerText = state.treasuryBalance.toFixed(2);
    document.getElementById('wallet-display-text').innerText = state.wallet || "Not Linked";

    if (state.gen.working) {
        document.getElementById('green-btn').style.display = 'none';
        document.getElementById('sync-btn').style.display = 'block';
        document.getElementById('green-status').innerText = "BUILDING...";
    } else {
        document.getElementById('green-btn').style.display = 'block';
        document.getElementById('sync-btn').style.display = 'none';
        document.getElementById('green-status').innerText = "IDLE";
    }

    if (state.wallet === CEO_WALLET) document.getElementById('ceo-nav-btn').style.display = 'block';
}

function switchTab(id, btn) {
    document.querySelectorAll('main').forEach(m => m.style.display = 'none');
    document.getElementById(`${id}-screen`).style.display = 'block';
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

window.onload = load;
setInterval(() => {
    if (state.gen.working && Date.now() > state.gen.endTime && !state.gen.claimed) {
        state.gen.claimed = true;
        processPayout();
        state.gen.working = false;
        updateUI();
    }
}, 1000);
