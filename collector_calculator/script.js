/*** GLOBAL VARIABLES ***/
const numPoints = document.getElementById("pgge-points");
const numTime = document.getElementById("pgge-time");
const lblResult = document.getElementById("result");

let browserDate = new Date();
let points = 0;
let time = 0;

/*** CONSTANTS ***/
const POINTS_MAX = 1000000;
const POINTS_MIN = 0;
const TIME_MAX = 7;
const TIME_MIN = 0;

/*** EVENT LISTENERS ***/
numPoints.addEventListener("input", calculate);
numTime.addEventListener("input", calculate);

/*** FUNCTIONS ***/
function calculate() {
    points = numPoints.value;
    time = numTime.value;

    if (points === "" || time === "") {
        lblResult.innerHTML = "You need X points now to reach the target at the end.";
        return;
    }

    if (points > POINTS_MAX) {
        numPoints.value = POINTS_MAX;
        points = POINTS_MAX;
    }
    if (time > TIME_MAX) {
        numTime.value = TIME_MAX;
        time = TIME_MAX;
    }
    if (points < POINTS_MIN) {
        numPoints.value = POINTS_MIN;
        points = POINTS_MIN;
    }
    if (time < TIME_MIN) {
        numTime.value = TIME_MIN;
        time = TIME_MIN;
    }

    time = parseFloat(time, 10);
    points = parseInt(points, 10);

    const targetScore = Math.trunc(
        points / Math.pow(1.35, time)
    ) + 1;

    lblResult.innerHTML =
        "You need <strong>" + targetScore.toLocaleString() +
        "</strong> points now to reach the target at the end.";
}
