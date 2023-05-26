// Funcție pentru afișarea sau ascunderea containerului de rezultate
function toggleResultBox(visible) {
    const resultDiv = document.getElementById('result');
    resultDiv.style.display = visible ? 'block' : 'none';
}

// Funcție pentru afișarea sau ascunderea containerului de descriere
function toggleDescriptionBox(visible) {
    const descriptionBox = document.querySelector('.description-box');
    descriptionBox.style.display = visible ? 'block' : 'none';
}

const fileInput = document.getElementById('file');
const fileNameSpan = document.getElementById('fileName');

// Eveniment pentru actualizarea numele fișierului selectat în câmpul span
fileInput.addEventListener('change', () => {
  fileNameSpan.textContent = fileInput.files[0].name;
});

document.getElementById('scanForm').addEventListener('submit', async (event) => {
event.preventDefault();
const fileInput = document.getElementById('file');
const urlInput = document.getElementById('url');
const resultDiv = document.getElementById('result');

resultDiv.className = '';

// Verificarea dacă utilizatorul a selectat un fișier sau a introdus un URL
if (!fileInput.files.length && !urlInput.value) {
    alert('Selectează un fișier sau introdu un URL.');
    return;
}

toggleDescriptionBox(false); // Ascunde containerul de descriere

const formData = new FormData();
if (fileInput.files.length) {
    formData.append('file', fileInput.files[0]);
} else {
    formData.append('url', urlInput.value);
}

try {
    resultDiv.innerHTML = `
        <div class="loading-text">
            <div class="loading-spinner"></div>
            Se analizează...
        </div>`;

    toggleResultBox(true);
    resultDiv.className = 'result analyzing';

    const response = await fetch('/analyze', {
        method: 'POST',
        body: formData,
    });

    if (response.ok) {
        const data = await response.json();
        const analysis_id = data.data.id;

        const analysisResult = await pollAnalysisStatus(analysis_id);
        const attributes = analysisResult.data.attributes;

        if (attributes) {
            const status = attributes.status;
            if (status === 'queued') {
                resultDiv.className = 'result info';
                resultDiv.innerHTML = 'Analiza este în curs de desfășurare. Te rugăm să aștepți și să reîncerci mai târziu.';
            } else {
                const engines = attributes.results;
                const totalEngines = Object.keys(engines).length;
                const maliciousEngines = Object.values(engines).filter(result => result.category === 'malicious').length;
                const ratioText = `${maliciousEngines} din ${totalEngines} motoare au detectat acesta ca fiind rău intenționat.`;

                const detectedList = [];
                const undetectedList = [];

                Object.entries(engines).forEach(([engine, result]) => {
                    if (result.category === 'malicious') {
                        detectedList.push(`<li class="malicious"><span class="engine">${engine}:</span> ${result.result}</li>`);
                    } else {
                        undetectedList.push(`<li class="safe"><span class="engine">${engine}:</span> ${result.result}</li>`);
                    }
                });

                resultDiv.className = maliciousEngines > 0 ? 'result malicious' : 'result safe';
                resultDiv.innerHTML = `
                                        <div class="ratio">
                                          <p>${ratioText}</p>
                                        </div>
                                        <div class="engine-results">
                                          <div class="detected">
                                            <h3>Detectat</h3>
                                            <ul>${detectedList.join('')}</ul>
                                          </div>
                                          <div class="undetected">
                                            <h3+Nedetectat</h3>
                                            <ul>${undetectedList.join('')}</ul>
                                          </div>
                                        </div>`;

            }
        } else {
            resultDiv.className = 'result error';
            resultDiv.innerHTML = 'Eroare: Nu s-au putut obține atributele analizei.';
        }
    } else {
        resultDiv.className = 'result error';
        resultDiv.innerHTML = `Eroare: ${response.status} ${response.statusText}`;
    }
} catch (error) {
    resultDiv.className = 'result error';
    resultDiv.innerHTML = `Eroare: ${error.message}`;
}

});

// Funcție asincronă pentru verificarea stării analizei
async function pollAnalysisStatus(analysis_id) {
let analysisResult;
let isCompleted = false;
const pollingInterval = 5000;

while (!isCompleted) {
    await new Promise(resolve => setTimeout(resolve, pollingInterval));
    analysisResult = await checkAnalysisStatus(analysis_id);

    if (analysisResult.data.attributes.status !== 'queued') {
        isCompleted = true;
    }
}

return analysisResult;
}

// Funcție asincronă pentru verificarea stării analizei prin intermediul unei cereri GET
async function checkAnalysisStatus(analysis_id) {
const response = await fetch(`/analysis/${analysis_id}`, {
    method: 'GET',
});

if (response.ok) {
    return await response.json();
} else {
    throw new Error(`${response.status} ${response.statusText}`);
}
}
