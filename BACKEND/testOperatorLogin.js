#!/usr/bin/env node

/**
 * Test the operator login credentials
 * This script tests if the CSE operator can login successfully
 */

const testLogin = async () => {
  const credentials = {
    email: 'cseopr@vnrvjiet.in',
    password: 'cse123',
    loginType: 'teacher'
  };

  console.log('Testing operator login...');
  console.log('Credentials:', JSON.stringify(credentials, null, 2));
  console.log('\nMake sure the backend server is running on http://localhost:3000');
  console.log('\nSending POST request to http://localhost:3000/api/auth/login\n');

  try {
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(credentials)
    });

    console.log('Response status:', response.status, response.statusText);
    
    const data = await response.json();
    console.log('\nResponse data:');
    console.log(JSON.stringify(data, null, 2));

    if (data.success) {
      console.log('\n✓ LOGIN SUCCESSFUL!');
      console.log('User role:', data.data.role);
      console.log('User email:', data.data.email);
    } else {
      console.log('\n❌ LOGIN FAILED');
      console.log('Message:', data.message);
    }
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.log('\nIs the backend server running? Start it with: npm run dev');
  }
};

testLogin();
