const raw = localStorage.getItem("lastMatchResult");
if (!raw) {
    window.location.href = "index.html";
}

const data = JSON.parse(raw);

document.getElementById("resultTitle").textContent =
    data.victory ? "Victory" : "Defeat";

document.getElementById("resultSub").textContent =
    data.victory
        ? "You won the match."
        : "You lost the match.";

document.getElementById("resultScore").textContent =
    `${data.playerScore} - ${data.aiScore}`;

document.getElementById("playAgainBtn").onclick = () => {
    window.location.href = "../game/game.html";
};

document.getElementById("homeBtn").onclick = () => {
    window.location.href = "../index.html";
};
