const express = require('express');
const multer = require('multer');
const pdfParser = require('pdf-parse');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const googleTTS = require('google-tts-api');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Configuração do Multer para upload de arquivos
const upload = multer({ dest: 'uploads/' });

const agents = require('./src/agent-orchestrator');

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Endpoint para extração de PDF
app.post('/extract', upload.single('pdf'), async (req, res) => {
  try {
    console.log('--- Nova solicitação de extração ---');
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo PDF enviado.' });
    }

    console.log('Tipo de pdfParser:', typeof pdfParser);
    
    const dataBuffer = fs.readFileSync(req.file.path);
    const data = await pdfParser(dataBuffer);
    const pdfText = data.text;

    // Limpar arquivo temporário
    fs.unlinkSync(req.file.path);

    // Chamar o agente de extração
    const extractionResults = await agents.pdfExtractor.extractAll(pdfText);

    res.json({
      status: "Sucesso",
      data: extractionResults
    });
  } catch (error) {
    console.error('Erro na extração:', error);
    res.status(500).json({ error: 'Falha ao processar o PDF: ' + error.message });
  }
});

// Endpoint para fazer streaming do áudio completo
app.get('/stream-audio', async (req, res) => {
  try {
    const { text, lang = 'pt-BR' } = req.query;
    if (!text) return res.status(400).send('Texto não fornecido.');

    const urls = googleTTS.getAllAudioUrls(text, {
      lang: lang,
      slow: false,
      host: 'https://translate.google.com',
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    
    // Baixar e encadear os pedaços
    const axios = require('axios');
    for (const item of urls) {
      const response = await axios({
        method: 'get',
        url: item.url,
        responseType: 'stream'
      });
      
      // Pipe o stream para a resposta
      await new Promise((resolve, reject) => {
        response.data.pipe(res, { end: false });
        response.data.on('end', resolve);
        response.data.on('error', reject);
      });
    }
    
    res.end();
  } catch (error) {
    console.error('[Stream] Erro:', error);
    if (!res.headersSent) res.status(500).send(error.message);
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`\n🚀 Servidor do Extrator iniciado em http://localhost:${port}`);
});
