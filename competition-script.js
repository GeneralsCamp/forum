const supabaseUrl = 'https://piycuuegsjpuojpcaeqw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpeWN1dWVnc2pwdW9qcGNhZXF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyMjk0MDksImV4cCI6MjA2NDgwNTQwOX0.thfjZUrxKAdfwStaeWjpEyZ-C70kUuWnjIontibhkxc';

const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

let allQuestions = [];

async function loadQuestions() {
    try {
        const { data, error } = await supabaseClient
            .from('public_questions')
            .select('*')
            .limit(50);

        if (error) {
            console.error("Hiba a lekérdezésben:", error);
            alert('Hiba történt a kérdések betöltésekor!');
            return;
        }

        allQuestions = data;

        if (!allQuestions || allQuestions.length === 0) {
            alert('Nincsenek kérdések az adatbázisban!');
        }
    } catch (error) {
        alert('Nem sikerült betölteni a kérdéseket: ' + error.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const savedPlayerName = localStorage.getItem('playerName');
    const savedGame = localStorage.getItem('game');
    const savedServer = localStorage.getItem('server');
    const savedDiscordName = localStorage.getItem('discordName');

    if (savedPlayerName) document.getElementById('playerName').value = savedPlayerName;
    if (savedGame) {
        gameSelect.value = savedGame;
        gameSelect.dispatchEvent(new Event('change'));
    }
    if (savedServer) {
        const trySelectServer = setInterval(() => {
            const optionExists = Array.from(serverSelect.options).some(opt => opt.value === savedServer);
            if (optionExists) {
                serverSelect.value = savedServer;
                clearInterval(trySelectServer);
            }
        }, 100);
    }

    if (savedDiscordName) document.getElementById('discordServer').value = savedDiscordName;

    loadQuestions();
});

const totalQuestions = 10;
let selectedQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = new Array(totalQuestions).fill(null);
let playerName = '';
let server = '';
let discordName = '';
let game = '';

const mainView = document.getElementById('mainView');
const quizView = document.getElementById('quizView');
const retryView = document.getElementById('retryView');
const quizContent = document.getElementById('quizContent');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const submitBtn = document.getElementById('submitBtn');
const startBtn = document.getElementById('startBtn');
const retryBtn = document.getElementById('retryBtn');
const resultDiv = document.getElementById('result');
const discordServerInput = document.getElementById('discordServer');
const selectedGame = document.getElementById('gameSelect');

startBtn.onclick = () => {
    localStorage.setItem('playerName', document.getElementById('playerName').value.trim());
    localStorage.setItem('game', gameSelect.value);
    localStorage.setItem('server', serverSelect.value);
    localStorage.setItem('discordName', document.getElementById('discordServer').value.trim());

    if (allQuestions.length === 0) {
        alert('A kérdések még nem töltődtek be, kérlek várj egy pillanatot.');
        return;
    }

    playerName = document.getElementById('playerName').value.trim();
    server = serverSelect.options[serverSelect.selectedIndex].text;
    discordName = discordServerInput.value.trim();
    game = gameSelect.value;

    if (!playerName || !game || !server || !discordName || server === "Válassz szervert") {
        alert('Kérlek add meg a játékot, játékosneved, a szervert és a Discord neved!');
        return;
    }

    resetQuiz();
    mainView.style.display = 'none';
    retryView.style.display = 'none';
    quizView.style.display = 'flex';
    loadQuestion();
    updateButtons();
    checkSubmitAvailability();
};


retryBtn.onclick = () => {
    resetQuiz();
    retryView.style.display = 'none';
    quizView.style.display = 'flex';
    loadQuestion();
    updateButtons();
    checkSubmitAvailability();
};

prevBtn.onclick = () => {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        loadQuestion();
        updateButtons();
        checkSubmitAvailability();
    }
};

nextBtn.onclick = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
        currentQuestionIndex++;
        loadQuestion();
        updateButtons();
        checkSubmitAvailability();
    }
};

submitBtn.onclick = async () => {
    if (userAnswers.includes(null)) {
        alert('Kérlek válaszolj az összes kérdésre!');
        return;
    }

    const questionIds = selectedQuestions.map(q => q.id);
    const userAnswerMap = {};

    for (let i = 0; i < totalQuestions; i++) {
        const qid = selectedQuestions[i].id;
        userAnswerMap[qid] = userAnswers[i];
    }

    try {
        const { data, error } = await supabaseClient.rpc('evaluate_quiz', {
            question_ids: questionIds,
            user_answers: userAnswerMap,
            player_name: playerName,
            server: server,
            discord_name: document.getElementById('discordServer').value.trim(),
            game: gameSelect.value
        });

        if (error) {
            console.error(error);
            alert('Hiba történt az eredmény kiértékelésekor!');
            return;
        }

        const correctCount = data;
        const score = correctCount / totalQuestions;
        showResult(score >= 0.8, score);
    } catch (err) {
        console.error(err);
        alert('Ismeretlen hiba történt!');
    }
};

function resetQuiz() {
    selectedQuestions = [];
    userAnswers = new Array(totalQuestions).fill(null);
    currentQuestionIndex = 0;
    resultDiv.innerHTML = '';
    submitBtn.classList.add('d-none');
    nextBtn.classList.remove('d-none');
    prevBtn.classList.remove('d-none');
    submitBtn.disabled = true;
}

function loadQuestion() {
    if (selectedQuestions.length === 0) {
        const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
        selectedQuestions = shuffled.slice(0, totalQuestions);
    }

    const question = selectedQuestions[currentQuestionIndex];

    if (!question.shuffledOptions) {
        const indexedOptions = question.options.map((opt, idx) => ({ opt, idx }));
        question.shuffledOptions = indexedOptions.sort(() => 0.5 - Math.random());
    }

    quizContent.innerHTML = '';
    const qNum = document.createElement('div');
    qNum.className = 'question-number';
    qNum.textContent = `Kérdés ${currentQuestionIndex + 1} / ${totalQuestions}`;
    quizContent.appendChild(qNum);

    const questionTitle = document.createElement('h2');
    questionTitle.textContent = question.question;
    quizContent.appendChild(questionTitle);

    const list = document.createElement('ul');
    list.className = 'list-group';
    quizContent.appendChild(list);

    question.shuffledOptions.forEach(({ opt, idx }, i) => {
        const li = document.createElement('li');
        li.className = 'list-group-item';

        const label = document.createElement('label');
        label.style.width = '100%';
        label.style.cursor = 'pointer';
        label.htmlFor = `option_${i}`;

        const input = document.createElement('input');
        input.type = question.type === 'multiple' ? 'checkbox' : 'radio';
        input.name = 'option';
        input.value = idx;
        input.id = `option_${i}`;

        const ua = userAnswers[currentQuestionIndex];
        if (ua !== null) {
            if (question.type === 'multiple') {
                if (ua.includes(idx)) input.checked = true;
            } else {
                if (ua === idx) input.checked = true;
            }
        }

        input.onchange = () => {
            if (question.type === 'multiple') {
                const checked = [];
                list.querySelectorAll('input[type=checkbox]').forEach((cb) => {
                    if (cb.checked) checked.push(parseInt(cb.value));
                });
                userAnswers[currentQuestionIndex] = checked.length > 0 ? checked : null;
            } else {
                userAnswers[currentQuestionIndex] = parseInt(input.value);
            }
            checkSubmitAvailability();
        };

        label.appendChild(input);
        label.appendChild(document.createTextNode(opt));
        li.appendChild(label);
        list.appendChild(li);
    });
}

function updateButtons() {
    prevBtn.disabled = currentQuestionIndex === 0;
    nextBtn.disabled = currentQuestionIndex === totalQuestions - 1;
    if (currentQuestionIndex === totalQuestions - 1) {
        nextBtn.classList.add('d-none');
        submitBtn.classList.remove('d-none');
    } else {
        nextBtn.classList.remove('d-none');
        submitBtn.classList.add('d-none');
    }
}

function checkSubmitAvailability() {
    submitBtn.disabled = userAnswers.includes(null);
}

function calculateScore() {
    let correctCount = 0;

    for (let i = 0; i < totalQuestions; i++) {
        const question = selectedQuestions[i];
        const userAnswer = userAnswers[i];

        if (question.type === 'multiple') {
            if (Array.isArray(userAnswer) && Array.isArray(question.answer)) {
                const sortedUser = [...userAnswer].sort();
                const sortedCorrect = [...question.answer].sort();

                const allMatch = sortedUser.length === sortedCorrect.length &&
                    sortedUser.every((val, idx) => val === sortedCorrect[idx]);

                if (allMatch) {
                    correctCount++;
                }
            }
        } else {
            if (userAnswer != null && question.answer.length === 1 && userAnswer === question.answer[0]) {
                correctCount++;
            }
        }
    }

    return correctCount / totalQuestions;
}
function calculateScore() {
    let correctCount = 0;

    for (let i = 0; i < totalQuestions; i++) {
        const question = selectedQuestions[i];
        const userAnswer = userAnswers[i];

        if (question.type === 'multiple') {
            if (Array.isArray(userAnswer) && Array.isArray(question.answer)) {
                const sortedUser = [...userAnswer].sort();
                const sortedCorrect = [...question.answer].sort();

                const allMatch = sortedUser.length === sortedCorrect.length &&
                    sortedUser.every((val, idx) => val === sortedCorrect[idx]);

                if (allMatch) {
                    correctCount++;
                }
            }
        } else {
            if (userAnswer != null && question.answer.length === 1 && userAnswer === question.answer[0]) {
                correctCount++;
            }
        }
    }

    return correctCount / totalQuestions;
}

function showResult(passed, score) {
    quizView.style.display = 'none';

    if (passed) {
        retryView.style.display = 'flex';
        retryView.innerHTML = `
            <p class="note">
                <span class="warning-icon">!</span>
                Gratulálunk, sikeresen megoldottad a kvízt.<br/>
                Nincsen több tennivalód!
            </p> 
        `;
    } else {
        retryView.style.display = 'flex';
        retryView.innerHTML = `
            <p class="note">
                <span class="warning-icon">!</span>
                Sajnos nem érted el a 80%-ot...<br />
                Próbáld újra, sok szerencsét!
            </p>
            <button id="retryBtn" class="btn btn-warning btn-fixed mt-3">Újraindítás</button>
        `;
        const retryBtnNew = document.getElementById('retryBtn');
        retryBtnNew.onclick = () => {
            retryView.style.display = 'none';
            quizView.style.display = 'flex';
            resetQuiz();
            loadQuestion();
            updateButtons();
            checkSubmitAvailability();
        };
    }
}

const e4kServers = [
    { value: "EmpirefourkingdomsExGG", text: "Germany 1" },
    { value: "EmpirefourkingdomsExGG_2", text: "France 1" },
    { value: "EmpirefourkingdomsExGG_3", text: "Poland 1" },
    { value: "EmpirefourkingdomsExGG2_3", text: "Closed beta 1" },
    { value: "EmpirefourkingdomsExGG_4", text: "United States 1" },
    { value: "EmpirefourkingdomsExGG_5", text: "United Kingdom 1" },
    { value: "EmpirefourkingdomsExGG_6", text: "Netherlands 1" },
    { value: "EmpirefourkingdomsExGG_7", text: "Spain 1" },
    { value: "EmpirefourkingdomsExGG_8", text: "Portuguese 1" },
    { value: "EmpirefourkingdomsExGG_9", text: "Italy 1" },
    { value: "EmpirefourkingdomsExGG_10", text: "Russia 1" },
    { value: "EmpirefourkingdomsExGG_11", text: "Nordic 1" },
    { value: "EmpirefourkingdomsExGG_12", text: "Hispanic America 1" },
    { value: "EmpirefourkingdomsExGG_13", text: "Brazil 1" },
    { value: "EmpirefourkingdomsExGG_14", text: "Japan 1" },
    { value: "EmpirefourkingdomsExGG_15", text: "South Korea 1" },
    { value: "EmpirefourkingdomsExGG_16", text: "China 1" },
    { value: "EmpirefourkingdomsExGG_17", text: "Australia 1" },
    { value: "EmpirefourkingdomsExGG_18", text: "Philippines 1" },
    { value: "EmpirefourkingdomsExGG_19", text: "Argentina 2" },
    { value: "EmpirefourkingdomsExGG_20", text: "Mexico 1" },
    { value: "EmpirefourkingdomsExGG_21", text: "International 2" },
    { value: "EmpirefourkingdomsExGG_22", text: "Turkey 1" },
    { value: "EmpirefourkingdomsExGG_23", text: "Greece 1" },
    { value: "EmpirefourkingdomsExGG_24", text: "Arab League 1" },
    { value: "EmpirefourkingdomsExGG_25", text: "India 1" },
    { value: "EmpirefourkingdomsExGG_26", text: "Indonesia 1" },
    { value: "EmpirefourkingdomsExGG_27", text: "Asia 1" },
    { value: "EmpirefourkingdomsExGG_28", text: "Germany 2" },
    { value: "EmpirefourkingdomsExGG_29", text: "United States 2" },
    { value: "EmpirefourkingdomsExGG_30", text: "Chinese (traditional) 1" },
    { value: "EmpirefourkingdomsExGG_31", text: "Russia 2" },
    { value: "EmpirefourkingdomsExGG_32", text: "International 3" },
    { value: "EmpirefourkingdomsExGG_34", text: "International 4" },
    { value: "EmpirefourkingdomsExGG_36", text: "World 1" }
];

const ggeServers = [
    { value: "EmpireEx", text: "International 1" },
    { value: "EmpireEx_2", text: "Germany 1" },
    { value: "EmpireEx_3", text: "France 1" },
    { value: "EmpireEx_4", text: "Czech Republic 1" },
    { value: "EmpireEx_5", text: "Poland 1" },
    { value: "EmpireEx_6", text: "Portuguese 1" },
    { value: "EmpireEx_7", text: "International 2" },
    { value: "EmpireEx_8", text: "Spain 1" },
    { value: "EmpireEx_9", text: "Italy 1" },
    { value: "EmpireEx_10", text: "Turkey 1" },
    { value: "EmpireEx_11", text: "Netherlands 1" },
    { value: "EmpireEx_12", text: "Hungary 1" },
    { value: "EmpireEx_13", text: "Nordic 1" },
    { value: "EmpireEx_14", text: "Russia 1" },
    { value: "EmpireEx_15", text: "Romania 1" },
    { value: "EmpireEx_16", text: "Bulgaria 1" },
    { value: "EmpireEx_17", text: "Hungary 2" },
    { value: "EmpireEx_18", text: "Slovakia 1" },
    { value: "EmpireEx_19", text: "United Kingdom 1" },
    { value: "EmpireEx_20", text: "Brazil 1" },
    { value: "EmpireEx_21", text: "United States 1" },
    { value: "EmpireEx_22", text: "Australia 1" },
    { value: "EmpireEx_24", text: "Japan 1" },
    { value: "EmpireEx_25", text: "Hispanic America 1" },
    { value: "EmpireEx_26", text: "India 1" },
    { value: "EmpireEx_27", text: "China 1" },
    { value: "EmpireEx_28", text: "Greece 1" },
    { value: "EmpireEx_29", text: "Lithuania 1" },
    { value: "EmpireEx_32", text: "Saudi Arabia 1" },
    { value: "EmpireEx_33", text: "United Arab Emirates 1" },
    { value: "EmpireEx_34", text: "Egypt 1" },
    { value: "EmpireEx_35", text: "Arab League 1" },
    { value: "EmpireEx_36", text: "Asia 1" },
    { value: "EmpireEx_37", text: "Chinese (traditional) 1" },
    { value: "EmpireEx_38", text: "Spain 2" },
    { value: "EmpireEx_43", text: "International 3" },
    { value: "EmpireEx_46", text: "World 1" },
];

const gameSelect = document.getElementById('gameSelect');
const serverSelect = document.getElementById('serverSelect');

gameSelect.addEventListener('change', () => {
    const selectedGame = gameSelect.value;
    serverSelect.innerHTML = '';

    if (selectedGame === 'GGE') {
        populateServerOptions(ggeServers);
    } else if (selectedGame === 'E4K') {
        populateServerOptions(e4kServers);
    } else {
        serverSelect.disabled = true;
        serverSelect.innerHTML = '<option value="">Előbb válassz játékot</option>';
    }
});

function populateServerOptions(servers) {
    serverSelect.disabled = false;
    serverSelect.innerHTML = '<option value="">Válassz szervert</option>';
    servers.forEach(server => {
        const option = document.createElement('option');
        option.value = server.value;
        option.textContent = server.text;
        serverSelect.appendChild(option);
    });
}