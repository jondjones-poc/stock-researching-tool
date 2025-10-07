// Test script to call the key-metrics API and store JSON data
const axios = require('axios');
const fs = require('fs');

async function testKeyMetricsAPI() {
  try {
    console.log('Testing key-metrics API...');
    
    // Test with CAKE symbol
    const response = await axios.get('http://localhost:3000/api/key-metrics?symbol=CAKE');
    
    console.log('API Response Status:', response.status);
    console.log('API Response Data:', JSON.stringify(response.data, null, 2));
    
    // Store the response data in a file
    const testData = {
      timestamp: new Date().toISOString(),
      symbol: 'CAKE',
      response: response.data
    };
    
    fs.writeFileSync('key-metrics-test-data.json', JSON.stringify(testData, null, 2));
    console.log('Test data saved to key-metrics-test-data.json');
    
  } catch (error) {
    console.error('Error testing key-metrics API:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testKeyMetricsAPI();
