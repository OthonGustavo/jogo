import { GoogleGenerativeAI } from "@google/generative-ai";

export const aiOrchestrator = {
  async analyzeDocument(text, apiKey) {
    if (!apiKey) throw new Error("Chave API não fornecida.");
    
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Usamos gemini-2.0-flash que confirmamos estar ativo na sua chave
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }, { apiVersion: "v1" });

    const systemInstruction = `Você é um especialista em análise de documentos jurídicos e administrativos. 
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

    // Combinando instruções e texto para máxima compatibilidade (evita erro 400 de systemInstruction)
    const combinedPrompt = `${systemInstruction}\n\nTEXTO PARA ANÁLISE:\n${text.substring(0, 15000)}`;
    
    try {
      const result = await model.generateContent(combinedPrompt);
      const responseText = result.response.text();
      
      // Limpeza de blocos de código markdown
      const jsonStr = responseText.replace(/```json|```/g, '').trim();
      
      try {
        // Tentar encontrar o JSON dentro da resposta caso a IA tenha adicionado texto extra
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
        return JSON.parse(jsonStr);
      } catch (parseError) {
        console.error("Erro ao parsear JSON da IA. Resposta bruta:", responseText);
        throw new Error("A IA não retornou um JSON válido. Tente novamente.");
      }
    } catch (error) {
      console.error("DETALHES TÉCNICOS DO ERRO GOOGLE:", error);
      
      if (error.message?.includes("403") || error.message?.includes("404") || error.message?.includes("expired")) {
        throw new Error("Erro na API: Chave inválida ou modelo não disponível. Verifique sua chave no Google AI Studio.");
      }
      throw error;
    }
  }
};
