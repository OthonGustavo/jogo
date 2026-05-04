document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const pdfInput = document.getElementById('pdf-input');
    const extractBtn = document.getElementById('extract-btn');
    const fileName = document.getElementById('file-name');
    const resultsSection = document.getElementById('results');
    const loader = document.querySelector('.loader');
    const listenBtn = document.getElementById('listen-all-btn');
    const voiceSelect = document.getElementById('voice-select');
    const speedRange = document.getElementById('speed-range');
    const speedVal = document.getElementById('speed-val');
    
    const playerContainer = document.getElementById('audio-player-container');
    const audioProgress = document.getElementById('audio-progress');
    const currentTimeEl = document.getElementById('current-time');
    const totalTimeEl = document.getElementById('total-time');

    const downloadPdfBtn = document.getElementById('download-pdf-btn');
    const downloadMp3Btn = document.getElementById('download-mp3-btn');

    let selectedFile = null;
    let analysisData = null;
    let fullTextToRead = "";
    
    let localVoices = [];
    let audioStream = new Audio();
    let isPlaying = false;
    let mode = 'stream'; 

    // --- Audio Configuration ---
    function loadVoices() {
        localVoices = window.speechSynthesis.getVoices();
        voiceSelect.innerHTML = `
            <optgroup label="Vozes de IA (Suportam Download)">
                <option value="google-br">Google AI - Brasil</option>
                <option value="google-pt">Google AI - Portugal</option>
            </optgroup>
            <optgroup label="Vozes do Sistema (Apenas Reprodução)" id="local-voices-group">
            </optgroup>
        `;
        const localGroup = document.getElementById('local-voices-group');
        localVoices.forEach((voice, index) => {
            const option = document.createElement('option');
            option.value = `local-${index}`;
            option.textContent = `${voice.name} (${voice.lang})`;
            localGroup.appendChild(option);
        });
    }

    if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    loadVoices();
    setTimeout(loadVoices, 500);

    speedRange.addEventListener('input', () => {
        speedVal.textContent = speedRange.value + 'x';
        if (mode === 'stream') audioStream.playbackRate = parseFloat(speedRange.value);
    });

    // --- Upload & API Logic ---
    dropZone.addEventListener('click', () => pdfInput.click());
    pdfInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
    
    function handleFile(file) {
        if (file && file.type === 'application/pdf') {
            selectedFile = file;
            fileName.textContent = file.name;
            document.getElementById('file-info').classList.remove('hidden');
            extractBtn.disabled = false;
        }
    }

    extractBtn.addEventListener('click', async () => {
        if (!selectedFile) return;
        extractBtn.disabled = true;
        loader.classList.remove('hidden');
        resultsSection.classList.add('hidden');

        const formData = new FormData();
        formData.append('pdf', selectedFile);

        try {
            const response = await fetch('/extract', { method: 'POST', body: formData });
            const result = await response.json();
            if (result.status === 'Sucesso') {
                analysisData = result.data;
                displayResults(analysisData);
                prepareTextToRead(analysisData);
            }
        } catch (error) {
            alert('Erro: ' + error.message);
        } finally {
            extractBtn.disabled = false;
            loader.classList.add('hidden');
        }
    });

    function displayResults(data) {
        resultsSection.classList.remove('hidden');
        document.getElementById('relevant-list').innerHTML = Object.entries(data.relevant_data || {})
            .map(([k, v]) => `<li><strong>${k}:</strong> ${v}</li>`).join('');
        document.getElementById('summary-content').textContent = data.summary;
        document.getElementById('cases-content').textContent = data.similar_cases;
        document.getElementById('logic-content').textContent = data.logic;
        document.getElementById('actions-content').textContent = data.actions;
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    function prepareTextToRead(data) {
        fullTextToRead = `
            Análise do documento: ${fileName.textContent}.
            Resumo: ${data.summary || ''}. 
            Lógica Jurídica: ${data.logic || ''}. 
            Ações Recomendadas: ${data.actions || ''}.
        `.trim();
        stopAudio();
    }

    function formatTime(s) {
        if (!isFinite(s) || isNaN(s)) return "--:--";
        const min = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    }

    // --- Playback Logic ---
    listenBtn.addEventListener('click', () => {
        if (isPlaying) { stopAudio(); return; }
        if (!fullTextToRead) return;
        const val = voiceSelect.value;
        if (val.startsWith('google')) { mode = 'stream'; playStream(0); }
        else { mode = 'local'; playLocal(0); }
    });

    function playStream(startTime = 0) {
        isPlaying = true;
        listenBtn.innerHTML = '<i class="fas fa-stop"></i> Parar';
        playerContainer.classList.remove('hidden');
        const lang = voiceSelect.value === 'google-pt' ? 'pt-PT' : 'pt-BR';
        audioStream.src = `/stream-audio?text=${encodeURIComponent(fullTextToRead)}&lang=${lang}`;
        audioStream.playbackRate = parseFloat(speedRange.value);
        audioStream.currentTime = startTime;
        audioStream.play();
        audioStream.onloadedmetadata = () => {
            totalTimeEl.textContent = formatTime(audioStream.duration);
            audioProgress.max = Math.floor(audioStream.duration);
        };
        audioStream.ontimeupdate = () => {
            currentTimeEl.textContent = formatTime(audioStream.currentTime);
            audioProgress.value = Math.floor(audioStream.currentTime);
        };
        audioStream.onended = () => stopAudio();
    }

    function playLocal(startIndex) {
        const synth = window.speechSynthesis;
        synth.cancel();
        isPlaying = true;
        listenBtn.innerHTML = '<i class="fas fa-stop"></i> Parar';
        playerContainer.classList.remove('hidden');
        const textSlice = fullTextToRead.substring(startIndex);
        if (!textSlice.trim()) return stopAudio();
        const utterance = new SpeechSynthesisUtterance(textSlice);
        const localIndex = parseInt(voiceSelect.value.replace('local-', ''));
        utterance.voice = localVoices[localIndex];
        utterance.rate = parseFloat(speedRange.value);
        const estimatedTotal = fullTextToRead.length / (15 * utterance.rate);
        totalTimeEl.textContent = formatTime(estimatedTotal);
        audioProgress.max = fullTextToRead.length;
        utterance.onboundary = (event) => {
            const globalIndex = startIndex + event.charIndex;
            audioProgress.value = globalIndex;
            currentTimeEl.textContent = formatTime((globalIndex / fullTextToRead.length) * estimatedTotal);
        };
        utterance.onend = () => stopAudio();
        synth.speak(utterance);
    }

    function stopAudio() {
        isPlaying = false;
        audioStream.pause();
        window.speechSynthesis.cancel();
        listenBtn.innerHTML = '<i class="fas fa-play"></i> Ouvir Explicação';
        audioProgress.value = 0;
        currentTimeEl.textContent = "00:00";
    }

    audioProgress.addEventListener('change', () => {
        if (mode === 'local') playLocal(parseInt(audioProgress.value));
        else audioStream.currentTime = audioProgress.value;
    });

    // --- PDF Download (Fix Definitivo com onclone) ---
    downloadPdfBtn.addEventListener('click', async () => {
        if (!analysisData) return;
        downloadPdfBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...';

        const template = document.getElementById('pdf-export-template');
        
        // População no template original
        document.getElementById('pdf-date').textContent = `Documento: ${fileName.textContent} | Data: ${new Date().toLocaleDateString('pt-BR')}`;
        document.getElementById('pdf-relevant-list').innerHTML = Object.entries(analysisData.relevant_data || {})
            .map(([k, v]) => `<p style="margin: 5px 0;"><strong>${k}:</strong> ${v}</p>`).join('');
        document.getElementById('pdf-summary').textContent = analysisData.summary;
        document.getElementById('pdf-cases').textContent = analysisData.similar_cases;
        document.getElementById('pdf-logic').textContent = analysisData.logic;
        document.getElementById('pdf-actions').textContent = analysisData.actions;

        const wrapper = template.parentElement;
        // Traz para a viewport mas atrás do conteúdo para html2canvas conseguir renderizar
        wrapper.style.top = '0';
        wrapper.style.zIndex = '-100';

        const opt = {
            margin: 0.5,
            filename: `Relatorio_Analise_${fileName.textContent.replace('.pdf', '')}.pdf`,
            image: { type: 'jpeg', quality: 1 },
            html2canvas: { 
                scale: 2, 
                useCORS: true, 
                logging: false,
                windowWidth: 800
            },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        };

        try {
            await html2pdf().set(opt).from(template).save();
        } catch (e) {
            console.error('Erro no PDF:', e);
            alert('Erro ao gerar PDF');
        } finally {
            // Devolve para fora da tela
            wrapper.style.top = '200vh';
            downloadPdfBtn.innerHTML = '<i class="fas fa-file-pdf"></i> PDF';
        }
    });

    downloadMp3Btn.addEventListener('click', () => {
        const val = voiceSelect.value;
        const lang = val === 'google-pt' ? 'pt-PT' : 'pt-BR';
        const streamUrl = `/stream-audio?text=${encodeURIComponent(fullTextToRead)}&lang=${lang}`;
        const a = document.createElement('a');
        a.href = streamUrl;
        a.download = `Audio_Analise_${fileName.textContent.replace('.pdf', '')}.mp3`;
        a.click();
    });
});