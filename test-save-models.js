async function testSaveModels() {
  const testModels = [
    {
      id: 'test-1',
      provider: 'huggingface',
      name: 'Test Model',
      model_string: 'google/gemma-3-300m',
      api_key: 'test-key',
      is_active: true
    }
  ];

  try {
    const response = await fetch('http://localhost:8080/api/models', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testModels)
    });

    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('SUCCESS: Models saved successfully');
    } else {
      console.log('FAILED: ' + (result.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('ERROR:', error.message);
  }
}

testSaveModels();
