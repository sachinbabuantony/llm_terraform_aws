import requests
import json
from config import LLM_CONFIG, EXTRACTION_VARIABLES

def structure_text(text_data):
    """
    Process text data with an LLM to extract structured medical information
    
    Args:
        text_data (str): Text to analyze for medical values
        
    Returns:
        dict: Structured data with extracted fields
    """
    try:
        url = LLM_CONFIG["API_URL"]
        
        prompt = f"""
        Analise o seguinte texto médico e extraia informações médicas importantes relacionadas a ecocardiograma.
        Mantenha todos os nomes de variáveis e valores em português brasileiro.
        Use caracteres especiais corretamente (ç, ã, é, etc.).

        Regras:
        1. Extraia especificamente as seguintes variáveis (se presentes no texto):
           {chr(10).join([f'   - {var}' for var in EXTRACTION_VARIABLES])}
        2. Mantenha valores em português quando aplicável
        3. Retorne APENAS os dados JSON neste formato exato, sem texto adicional:
        {{
            "fields": [
                {{
                    "name": "nome_da_variável",
                    "value": "valor_extraído"
                }}
            ]
        }}

        Texto para análise:
        {text_data}
        """
        
        data = {
            "model": LLM_CONFIG["MODEL"],
            "messages": [
                {
                    "role": "system",
                    "content": "Você é um analisador de dados médicos especializado em documentação médica brasileira. Extraia informações médicas importantes e retorne APENAS como dados JSON, sem texto ou formatação markdown adicional."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "stream": False
        }

        response = requests.post(url=url, json=data)
        
        # Check for successful response
        if response.status_code != 200:
            print(f"Error: LLM API returned status code {response.status_code}")
            return {"fields": []}
            
        response_json = response.json()
        content = response_json['choices'][0]['message']['content']
        
        # Parse the JSON content
        try:
            parsed_content = json.loads(content)
            return parsed_content
        except json.JSONDecodeError:
            print(f"Error: Failed to parse LLM response as JSON: {content}")
            return {"fields": []}
        
    except Exception as e:
        print(f"Error in structure_text: {str(e)}")
        # Return empty result in case of error
        return {"fields": []}