const { chromium } = require('playwright');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000');
  
  console.log('Injetando e acionando html2pdf diretamente...');
  
  // Simula o código de geração do PDF do app.js
  await page.evaluate(() => {
    return new Promise((resolve) => {
      const template = document.getElementById('pdf-export-template');
      
      document.getElementById('pdf-date').textContent = "Data: Teste";
      document.getElementById('pdf-relevant-list').innerHTML = "<p>Teste de Lista Relevante</p>";
      document.getElementById('pdf-summary').textContent = "Resumo para testes.";
      document.getElementById('pdf-cases').textContent = "Casos de teste.";
      document.getElementById('pdf-logic').textContent = "Lógica testada.";
      document.getElementById('pdf-actions').textContent = "Ações validadas.";

      const opt = {
          margin: 0.5,
          filename: `Teste_Automatizado.pdf`,
          image: { type: 'jpeg', quality: 1 },
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
      };

      html2pdf().set(opt).from(template).save().then(resolve);
    });
  });
  
  console.log('Esperando o download...');
  
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('body') // qualquer clique pra manter rodando se precisar, mas o html2pdf usa iframe/blob
  ]).catch(async () => {
     // html2pdf já engatilha o download automático por blob url
     return [await page.waitForEvent('download', { timeout: 15000 })];
  });
  
  const downloadPath = path.join(__dirname, 'test-download.pdf');
  await download.saveAs(downloadPath);
  console.log('PDF baixado, lendo...');
  
  const dataBuffer = fs.readFileSync(downloadPath);
  const data = await pdfParse(dataBuffer);
  
  console.log('--- CONTEÚDO DO PDF ---');
  console.log(data.text);
  console.log('-----------------------');
  
  if (data.text.trim().length > 50) {
    console.log('✅ SUCESSO: O PDF não está em branco!');
  } else {
    console.error('❌ ERRO: O PDF ESTÁ EM BRANCO!');
  }
  
  await browser.close();
})();
