const OR_MODEL1 = "google/gemini-2.0-flash-thinking-exp:free";
const OR_MODEL2 = "meta-llama/llama-3.3-70b-instruct:free";
const OR_MODEL3 = "google/gemini-2.0-flash-lite-preview-02-05:free";


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  //console.log("Background script (onMessage): message received:", request);  
  
  if (request.action === "fetch_completion") {
        
      const incompleteText = request.data.incompleteText;
      const completionContext = request.data.completionContext;
      const openRouterApiKey = request.data.apiKey;

      const startTime = performance.now(); // Start timer

      try {
        const response = fetch(`https://openrouter.ai/api/v1/chat/completions`, {
              method: 'POST',
              headers: {
                  'Authorization': `Bearer ${openRouterApiKey}`,
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                  model: `${OR_MODEL3}`,
                  messages: [
                      { 
                          role: "system", 
                          content: `You are an AI assistant that provides autocomplete suggestions for incomplete text based on the given context. You will receive:
                                    1. A brief context describing the topic or intent of the text.
                                    2. An incomplete text input, which could be:
                                      * An incomplete sentence
                                      * An incomplete word
                                      * A sentence where the last word is incomplete
                                    3. Your task:
                                      * Analyze the provided context and incomplete text.
                                      * Generate 1 or more possible completions that are the most relevant based on both inputs.
                                      * Ensure that the completions are concise, typically a few words long.
                                      * Rank the suggestions from most to least relevant.
                                    Output Format: Return a JSON object in the following format, where "suggestions" is an array of string completions sorted by relevance.
                                    {
                                      "suggestions": ["suggestion1", "suggestion2", "suggestion3"]
                                    }
                                    Example Inputs and Outputs:
                                    Example 1:
                                    Input:
                                    {
                                      "context": "Writing an email to a colleague about rescheduling a meeting.",
                                      "incomplete_text": "Let's move the mee"
                                    }
                                    Output:
                                    {
                                      "suggestions": ["ting to next week.", "ting to later this month.", "ting to Friday."]
                                    }
                                    Example 2:
                                    Input:
                                    {
                                      "context": "Writing an email to a colleague about rescheduling a meeting.",
                                      "incomplete_text": "How should I write this"
                                    }
                                    Output:
                                    {
                                      "suggestions": [" email.", " letter.", " essay."]
                                    }
                                    Example 3:
                                    Input:
                                    {
                                      "context": "Writing an email to a colleague about rescheduling a meeting.",
                                      "incomplete_text": "How should I write this "
                                    }
                                    Output:
                                    {
                                      "suggestions": ["email.", "letter.", "essay."]
                                    }
                                    Guidelines:
                                    * Suggest completions that align with natural language flow.
                                    * The completions should be in the same language as the incomplete text.
                                    * The completion should continue naturally from the provided incomplete text.
                                    * If the incomplete text is a partial word, prioritize completing that word first in your suggestions.
                                    * When the provided incomplete text and the suggestions are concatenated, the result should be meaningful.
                                    * Be sure to consider any periods in the provided incomplete text when making your suggestions.
                                    * If multiple interpretations exist, provide diverse but relevant options.
                                    Now, generate the best possible autocomplete suggestions based on the given inputs.
                                    `
                      },
                      {
                          role: "user",
                          content: `Completion context: ${completionContext} Incomplete text: ${incompleteText}`
                      }
                  ]
              })
          }).then((response) => response.json())
          .then((data) => {
            
            const endTime = performance.now(); // End timer
            const executionTime = endTime - startTime; // Time in milliseconds
            //console.log("Background script: response:", data);
            const responseJSON = data.choices[0].message.content;
            //console.log("Background script: responseJSON:", responseJSON);
          
            const cleanedText = responseJSON.replace(/```(?:json)?\n?|```/g, '').trim(); // Remove backticks and optional 'json'
            //console.log("Background script: cleanedText:", cleanedText);
            
            let suggestionsList = [];
            try {
              suggestionsList = JSON.parse(cleanedText);
            } catch (error) {
              console.error("Background script: Error parsing JSON:", error);
            }
            suggestionsList.executionTime = executionTime; // Add executionTime to the suggestionsList
            console.log("Background script: suggestionsList with executionTime:", suggestionsList);
            sendResponse(suggestionsList);

          }); // fetch request to openrouter
      } catch (error) {
        console.error("Background script: Error during fetch operation:", error);
        sendResponse({ suggestions: [] }); // Send an empty suggestions array in case of error
      }

      return true; // Indicates that the response will be sent asynchronously
    }
});


