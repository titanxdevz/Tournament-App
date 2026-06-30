async function testRegister() {
  try {
    const res = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alex@example.com',
        password: 'password123',
        name: 'Alex Pro',
      }),
    });
    const data = await res.json();
    console.log('REGISTRATION STATUS:', res.status, data);
  } catch (err: any) {
    console.error('REGISTRATION ERROR:', err.message);
  }
}

testRegister();
