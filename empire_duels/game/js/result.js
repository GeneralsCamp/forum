const raw = localStorage.getItem("lastMatchResult");
if (!raw) {
    window.location.href = "index.html";
}

const data = JSON.parse(raw);
const outcome = data.outcome || (data.victory ? "victory" : "defeat");

const titleEl = document.getElementById("resultTitle");
const subEl = document.getElementById("resultSub");

if (outcome === "draw") {
    if (titleEl) titleEl.textContent = "Draw";
    if (subEl) subEl.textContent = "The match ended in a draw.";
} else if (outcome === "victory") {
    if (titleEl) titleEl.textContent = "Victory";
    if (subEl) subEl.textContent = "You won the match.";
} else {
    if (titleEl) titleEl.textContent = "Defeat";
    if (subEl) subEl.textContent = "You lost the match.";
}

document.getElementById("resultScore").textContent =
    `${data.playerScore} - ${data.aiScore}`;

document.getElementById("playAgainBtn").onclick = () => {
    window.location.href = "../game/game.html";
};

document.getElementById("homeBtn").onclick = () => {
    window.location.href = "../index.html";
};
