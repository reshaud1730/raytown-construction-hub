const SUPABASE_URL = 'https://yjfprmwvzkydruxtogdg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZnBybXd2emt5ZHJ1eHRvZ2RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4OTg0NjAsImV4cCI6MjA5MjQ3NDQ2MH0.yLwEAiFht6i65e4AVtvEJGJSfrqUGG-MbuarRK22BsU';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const CEO_WALLET = "0xe46AcfE53b92010B5A9742c88278a57f00f28C25".toLowerCase();
const wallet = localStorage.getItem('fasttrack_operator_wallet');

const RANKS = [
    { title: "Node Builder", min: 0, bonus: 0, cut: 0.05 },
    { title: "Node Foreman", min: 75, bonus: 0.05, cut: 0.05 },
    { title: "Node Manager", min: 150, bonus: 0.05, cut: 0.04 },
    { title: "Raytown Legend", min: 600, bonus: 0.15, cut: 0.03 }
];

let state = {
    playerBalance: 0, treasuryBalance: 0, totalProjects: 0,
    currentCycle: 1, gamePhase: 0, manualDone: 0, 
    botActive: false, shieldActive: false,
    gen: { working: false, endTime: 0, claimed: true, weatherApplied: false }
};

function switchTab(id, btn) {
    if (id === 'ceo' && wallet.toLowerCase() !== CEO_WALLET) return alert("CEO ACCESS ONLY");
    document.querySelectorAll('main').forEach(m => m.style.display = 'none');
    document.getElementById(`${id}-screen`).style.display = 'block';
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

function getManualReq() {
    if (state.gamePhase === 2) return 0;
    if (state.gamePhase === 1) return Math.floor((state.currentCycle - 1) / 3) + 1;
    return 0;
}

function startProject(type) {
    if (state.gen.working) return;
    state.gen.working = true;
    state.gen.claimed = false;
    state.gen.endTime = Date.now() + 60000;
    save();
}

function processPayout() {
    const rank = [...RANKS].reverse().find(r => state.totalProjects >= r.min) || RANKS[0];
    const totalYield = 100 * (1 + rank.bonus); 
    
    // LOCKED 95/5 LOGIC (WITH RANK CUT REDUCTIONS)
    state.playerBalance += (totalYield * (1 - rank.cut));
    state.treasuryBalance += (totalYield * rank.cut);
    state.totalProjects++;

    if (!state.botActive) state.manualDone++;
    state.botActive = false;
    checkProgression();
    save();
}

function checkProgression() {
    if (state.manualDone >= getManualReq() && state.totalProjects % 10 === 0) {
        state.currentCycle++;
        state.manualDone = 0;
        if (state.currentCycle > 9) {
            state.gamePhase = Math.min(state.gamePhase + 1, 2);
            state.currentCycle = 1;
        }
    }
}

async function save() {
    await supabase.from('operators').upsert({
        wallet: wallet, player_balance: state.playerBalance,
        treasury_balance: state.treasuryBalance, total_projects: state.totalProjects,
        game_phase: state.gamePhase, current_cycle: state.currentCycle
    });
    updateUI();
}

function updateUI() {
    const rank = [...RANKS].reverse().find(r => state.totalProjects >= r.min) || RANKS[0];
    document.getElementById('tnb-balance').innerText = state.playerBalance.toFixed(2);
    document.getElementById('ceo-treasury').innerText = state.treasuryBalance.toFixed(2);
    document.getElementById('dash-projects').innerText = state.totalProjects;
    document.getElementById('dash-cycle').innerText = state.currentCycle;
    document.getElementById('player-rank-title').innerText = rank.title;
    document.getElementById('manual-done').innerText = state.manualDone;
    document.getElementById('manual-req').innerText = getManualReq();
    document.getElementById('phase-tag').innerText = ["FOUNDATION", "MANAGEMENT", "CORPORATE"][state.gamePhase];
    document.getElementById('bot-tag').style.display = state.botActive ? "block" : "none";
    if (wallet && wallet.toLowerCase() === CEO_WALLET) document.getElementById('ceo-nav-btn').style.display = 'block';
}

window.onload = () => { setInterval(loop, 1000); };
function loop() {
    const now = Date.now();
    if (state.gen.working && now > state.gen.endTime && !state.gen.claimed) {
        state.gen.claimed = true;
        processPayout();
    }
    if (state.gen.working && now > state.gen.endTime + 2000) {
        state.gen.working = false;
        updateUI();
    }
}
