// Function to load and parse script examples from a text file
export const loadScriptExamples = async () => {
  try {
    // Fetch the examples file
    const response = await fetch('/scriptExamples.txt');
    const data = await response.text();
    return data;
   
  } catch (error) {
    console.error('Error loading script examples:', error);
    return { modelScripts: [], sceneScripts: [] };
  }
}; 