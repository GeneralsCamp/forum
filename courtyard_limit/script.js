function calculateDefenders() {
    var input = document.getElementById('generalPoints');
    if (input.value > 12) {
        input.value = 12;
    }

    var keepValue = document.getElementById("keep").value;
    var strongholdValue = document.getElementById("stronghold").value;
    var vaultValue = document.getElementById("vault").value;
    var guardhouseValue = document.getElementById("guardhouse").value;
    var guardhouseLevelValue = document.getElementById("guardhouselevel").value;
    var generalRarityValue = document.getElementById("generalrarity").value;
    var generalPointsValue = document.getElementById("generalPoints").value;
    var othersValue1 = parseInt(document.getElementById("otherBonuses1").value);
    var othersValue2 = parseInt(document.getElementById("otherBonuses2").value);
    var tciValue = parseInt(document.getElementById("tci").value);
    var decoValue = parseInt(document.getElementById("deco").value);

    if (isNaN(othersValue1)) {
        othersValue1 = 0;
    }
    if (isNaN(othersValue2)) {
        othersValue2 = 0;
    }
    if (isNaN(tciValue)) {
        tciValue = 0;
    }
    if (isNaN(decoValue)) {
        decoValue = 0;
    }

    var keepSupportCY = [100000, 100000, 100000, 150000, 200000, 200000, 200000, 250000];
    var strongholdSupportCY = [0, 2500, 5000, 10000, 15000, 20000];
    var vaultSupportCY = [0, 25000, 30000, 35000, 40000, 45000, 50000, 60000, 70000, 80000, 100000];
    var guardhouseSupportCY = [0, 500, 1000, 1500, 2000, 2500, 3000, 3500];
    var generalSupportCY = [0, 0, 0, 0];

    var keepSupport = keepSupportCY[keepValue - 1];
    var strongholdSupport = strongholdSupportCY[strongholdValue];
    var vaultSupport = vaultSupportCY[vaultValue];
    var guardhouseSupport = guardhouseSupportCY[guardhouseLevelValue] * guardhouseValue;
    var generalSupport = generalSupportCY[generalRarityValue] * generalPointsValue;

    var keepValues = [10000, 50000, 100000, 150000, 200000, 250000, 300000, 350000];
    var strongholdValues = [0, 7500, 15000, 30000, 45000, 60000];
    var vaultValues = [0, 5000, 10000, 15000, 20000, 25000, 30000, 40000, 50000, 55000, 65000];
    var guardhouseValues = [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000];
    var generalRarityValues = [0, 7500, 6500, 5000];

    var keep = keepValues[keepValue - 1];
    var stronghold = strongholdValues[strongholdValue];
    var vault = vaultValues[vaultValue];
    var guardhouse = guardhouseValues[guardhouseLevelValue] * guardhouseValue;
    var general = generalRarityValues[generalRarityValue] * generalPointsValue;

    var totalCY = keep + stronghold + vault + guardhouse + general + othersValue1 + othersValue2;
    var totalDefenders = totalCY * (1 + tciValue / 100);

    var totalSupportCY = keepSupport + strongholdSupport + vaultSupport + guardhouseSupport + generalSupport + decoValue;

    document.getElementById("total-defenders").innerHTML = formatNumber(totalDefenders) + " units";
    document.getElementById("total-support-cy").innerHTML = formatNumber(totalSupportCY) + " units";

    saveToCache();
}

function formatNumber(number) {
    return number.toLocaleString('en-US');
}

function saveToCache() {
    var inputs = document.querySelectorAll('input, select');
    inputs.forEach(input => {
        localStorage.setItem(input.id, input.value);
    });
}

function loadFromCache() {
    var inputs = document.querySelectorAll('input, select');
    inputs.forEach(input => {
        if (localStorage.getItem(input.id)) {
            input.value = localStorage.getItem(input.id);
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    loadFromCache();
    calculateDefenders();
});
