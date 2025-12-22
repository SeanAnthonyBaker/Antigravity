
// Native fetch is available in Node 18+

const testGrok = async () => {
    try {
        const response = await fetch('http://localhost:5000/api/grok', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer test-key'
            },
            body: JSON.stringify({
                model: "grok-beta",
                messages: [{ role: "user", content: "Hello" }]
            })
        });

        console.log(`STATUS: ${response.status}`);
        const text = await response.text();
        console.log('BODY:', text);
    } catch (e) {
        console.error('Fetch error:', e);
    }
};

testGrok();
