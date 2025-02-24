const OPENROUTER_API_KEY = "";
const MODEL = "google/gemma-2-9b-it:free";

// Example: Listening for browser action click (icon click)
chrome.action.onClicked.addListener(tab => {
  console.log("Background script: Browser action clicked");
  // You can open a new tab, send messages, etc. here
});

// Add a function to return the suggested text to be typed
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
                                Return the suggestions as a JSON array of strings.
                                The array should be empty if there are no suggestions.
                                Do not send back any other text than the JSON array with the suggestions.
                                Do not include the provided incomplete text as part of the suggestions.                             
                                ` 
                },
                {
                    role: "user",
                    content: `Completion context: ${completionContext} Incomplete text: ${incompleteText}`
                }
            ]
        })
    }); // fetch request to openrouter
    const responseData = await response.json();
    const suggestedText = responseData.choices[0].message.content;
    console.log("Background script: responseData:", responseData, "suggestedText:", suggestedText);

    return suggestedText;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background script: fetch_completion message received:", message.data);  
  if (message.action === "fetch_completion") {
        
      // Replace this with actual API call
        let incompleteText = message.data.incompleteText;
        let completionContext = message.data.context;
        let suggestedText = [];
        //suggestedText = getSuggestedText(userText); // Simulated AI response
        suggestedText = getSuggestionsFromAIModel(completionContext, incompleteText);
        console.log("Background script: suggestedText:", suggestedText);
        sendResponse({ suggestion: suggestedText });

        return true; // Indicates that the response will be sent asynchronously
    }
});


