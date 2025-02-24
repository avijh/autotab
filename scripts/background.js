const MODEL = "google/gemini-2.0-flash-thinking-exp:free";

function getSuggestedText(inputText) {
  const testCompletions = {
    "Hello": [" World", " There!"],
    "Good": [" Morning!", " Afternoon!", " Evening!"],
    "Buona": [" Notte!", " Tarde!"],
    "Boa": [" Noite!", " Tarde!"],
    "My name": [" is"],
    "My name is ": ["Avi"],
    "My name is Avi ": ["Vijh"]
  };
  const suggestedText = testCompletions[inputText] || [];
  //console.log("inputText:", inputText, "suggestedText:", suggestedText);
  return suggestedText;
}

async function getSuggestionsFromAIModel(completionContext, incompleteText) {
  let OPENROUTER_API_KEY = "";

  chrome.storage.local.get(["apiKey"], (result) => {
    OPENROUTER_API_KEY = result.apiKey;
    if (!OPENROUTER_API_KEY) {
      console.log("Background script (getSuggestionsFromAIModel) - API key not found.");
    } else {
      console.log("Background script (getSuggestionsFromAIModel) - API key:", OPENROUTER_API_KEY);
    }
  });

  const response = await fetch(`https://openrouter.ai/api/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: `${MODEL}`,
            messages: [
                { 
                    role: "system", 
                    content: `  You are a text completion assistant.
                                You are given a context and an incomplete text.
                                The incomplete text can either be an incomplete sentence or an incomplete word or a combination of both.
                                If the last word in the sentence is an incomplete word, then you provide the text to complete that word. 
                                If the last word in the sentence is an incomplete word, when completing the incomplete word, 
                                only provide the text required to complete it and do not include any part of the provided incomplete word.
                                You need to complete the text based on the context.
                                The completion should be in the same language as the context.
                                The completion should be concise and to the point.
                                The completion should be grammatically correct.
                                The completion should be as short as possible, preferably just a single word or phrase.
                                The completion should be a single word or phrase that is a logical continuation of the incomplete text.
                                Do not send back any other text than the suggestions.
                                Do not include the provided incomplete text as part of the suggestions.
                                Return the suggestions as a JSON object with an array of strings.                             
                                ` 
                },
                {
                    role: "user",
                    content: `Completion context: ${completionContext} Incomplete text: ${incompleteText}`
                }
            ]
        })
    }).then((response) => response.json()); // fetch request to openrouter
    
    const responseJSON = response.choices[0].message.content;
    console.log("Background script (getSuggestionsFromAIModel): response:", response, "responseJSON:", responseJSON);
    
    const cleanedText = responseJSON.replace(/```(?:json)?\n?|```/g, '').trim(); // Remove backticks and optional 'json'
    console.log("Background script (getSuggestionsFromAIModel): cleanedText:", cleanedText);
    
    let suggestedText = [];
    try {
      suggestedText = JSON.parse(cleanedText).suggestions;
    } catch (error) {
      console.error("Background script (getSuggestionsFromAIModel) - Error parsing JSON:", error);
    }
    console.log("Background script (getSuggestionsFromAIModel) - suggestedText:", suggestedText);

    return suggestedText;
} // getSuggestionsFromAIModel

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background script (onMessage): fetch_completion message received:", message.data);  
  if (message.action === "fetch_completion") {
        
      let incompleteText = message.data.incompleteText;
      let completionContext = message.data.completionContext;
      //suggestedText = getSuggestedText(incompleteText); // Simulated AI response
      const suggestedText = getSuggestionsFromAIModel(completionContext, incompleteText);
      console.log("Background script (onMessage) - suggestedText:", suggestedText);
      sendResponse({ suggestions: suggestedText });

      return true; // Indicates that the response will be sent asynchronously
    }
});


