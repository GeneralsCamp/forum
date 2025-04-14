var numPoints = document.getElementById("pgge-points");
var numTime = document.getElementById("pgge-time");
var lblResult = document.getElementById("result");
let browserDate = new Date();
let points = 0;
let time = 0;

function calculate() {
    points = numPoints.value;
    time = numTime.value;

    if (points === "" || time === "") {
        lblResult.innerHTML = "You need X points now to reach the target at the end.";
        return;
    }

    const pointsMax = 1000000;
    const timeMax = 7;
    const pointsMin = 0;
    const timeMin = 0;

    if (points > pointsMax) {
        numPoints.value = pointsMax;
        points = pointsMax;
    }
    if (time > timeMax) {
        numTime.value = timeMax;
        time = timeMax;
    }
    if (points < pointsMin) {
        numPoints.value = pointsMin;
        points = pointsMin;
    }
    if (time < timeMin) {
        numTime.value = timeMin;
        time = timeMin;
    }

    time = parseFloat(time, 10);
    points = parseInt(points, 10);

    let targetScore = (Math.trunc(points / (Math.pow(1.35, (Math.trunc((browserDate.getHours() / 24) + time))))) + 1);

    lblResult.innerHTML = "You need <strong>" + targetScore.toLocaleString() + "</strong> points now to reach the target at the end.";
}
