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
    loadQuestions();
});

const totalQuestions = 10;
let selectedQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = new Array(totalQuestions).fill(null);
let playerName = '';
let server = '';
let discordName = '';

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

startBtn.onclick = () => {
    if (allQuestions.length === 0) {
        alert('A kérdések még nem töltődtek be, kérlek várj egy pillanatot.');
        return;
    }
    playerName = document.getElementById('playerName').value.trim();
    server = document.getElementById('server').value.trim();
    discordName = discordServerInput.value.trim();
    if (!playerName || !server || !discordName) {
        alert('Kérlek add meg a játékosneved, a szervert és a Discord neved!');
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
