require('dotenv').config();
const axios = require('axios');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash';

/**
 * Helper to call the LLM through OpenRouter
 */
async function callLLM(systemPrompt, userPrompt) {
  try {
    const response = await axios.post(
      OPENROUTER_API_URL,
      {
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('LLM Call Error:', error.response ? error.response.data : error.message);
    throw new Error('Failed to generate response from LLM');
  }
}

/**
 * Agente Pesquisador: Responsável por filtrar e sumarizar notícias.
 */
const researcher = {
  async getNews(topics) {
    // Para simplificação inicial, usaremos notícias estáticas simuladas.
    // Em um cenário real, aqui seria feita uma chamada a uma API de busca (como Serper ou Google News API).
    console.log(`[Researcher] Pesquisando sobre: ${topics.join(', ')}...`);
    return [
      { 
        title: "Apple lança novo chip M4 focado em IA", 
        url: "https://example.com/apple-m4", 
        summary: "O novo chip M4 da Apple promete desempenho recorde em tarefas de inteligência artificial local." 
      },
      { 
        title: "DeepSeek-V3 supera modelos concorrentes em benchmarks de código", 
        url: "https://example.com/deepseek-v3", 
        summary: "A nova arquitetura do DeepSeek-V3 demonstra eficiência superior em geração de scripts complexos." 
      }
    ];
  }
};

/**
 * Agente Roteirista: Transforma notícias em roteiro de vídeo.
 */
const scriptwriter = {
  async createScript(newsData) {
    console.log(`[Scriptwriter] Criando roteiro com base em ${newsData.length} notícias...`);
    const systemPrompt = "Você é um roteirista especializado em vídeos curtos de tecnologia (TikTok/Reels). Crie roteiros dinâmicos, com ganchos fortes e linguagem simples.";
    const userPrompt = `Crie um roteiro de vídeo curto (máximo 60 segundos) baseado nestas notícias: ${JSON.stringify(newsData)}`;
    
    return await callLLM(systemPrompt, userPrompt);
  }
};

/**
 * Agente Social Media: Cria posts para redes sociais.
 */
const socialMedia = {
  async createPosts(newsData) {
    console.log(`[SocialMedia] Criando postagens para redes sociais...`);
    const systemPrompt = "Você é um gestor de redes sociais focado em tecnologia. Crie posts envolventes para Twitter e LinkedIn.";
    const userPrompt = `Crie um post para Twitter (thread) e um post para LinkedIn baseados nestas notícias: ${JSON.stringify(newsData)}`;
    
    const output = await callLLM(systemPrompt, userPrompt);
    return output;
  }
};

/**
 * Agente Extrator de PDF: Responsável por analisar o texto bruto e extrair insights.
 */
const pdfExtractor = {
  async extractAll(text) {
    console.log(`[PdfExtractor] Analisando ${text.length} caracteres de texto...`);
    
    const systemPrompt = `Você é um especialista em análise de documentos jurídicos e administrativos. 
Sua tarefa é extrair 5 tipos de informações de um texto de PDF e retornar APENAS um JSON válido.
As categorias são:
1. relevant_data: (Objeto com nome, cpf, endereco, causa, etc)
2. summary: (Texto curto resumindo o documento)
3. similar_cases: (Texto sugerindo onde buscar casos parecidos ou exemplos de jurisprudência)
4. logic: (Explicação da lógica jurídica ou administrativa por trás do documento)
5. actions: (Sugestão de próximos passos práticos)

O formato de saída deve ser exatamente este JSON:
{
  "relevant_data": {},
  "summary": "",
  "similar_cases": "",
  "logic": "",
  "actions": ""
}`;

    const userPrompt = `Analise o seguinte texto extraído de um PDF:\n\n${text.substring(0, 15000)}`; // Limitando para não estourar contexto básico
    
    const rawOutput = await callLLM(systemPrompt, userPrompt);
    
    try {
      // Tentar limpar a saída caso a IA coloque blocos de código
      const jsonStr = rawOutput.replace(/```json|```/g, '').trim();
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error("Erro ao parsear JSON da IA:", rawOutput);
      return {
        error: "Falha ao processar resposta da IA",
        raw: rawOutput
      };
    }
  }
};

module.exports = {
  researcher,
  scriptwriter,
  socialMedia,
  pdfExtractor
};
