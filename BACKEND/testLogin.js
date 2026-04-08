// Node 20+ has built-in fetch, no external package needed
async function testLogin() {
  try {
    console.log('🔍 Testing Login API...\n');

    // Test with operator credentials
    const loginData = {
      email: 'cseopr_1@vnrvjiet.in',
      password: 'cseopr@123',
      loginType: 'teacher'
    };

    console.log('📤 Sending login request...');
    console.log(`  Email: ${loginData.email}`);
    console.log(`  Login Type: ${loginData.loginType}\n`);

    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginData)
    });

    const status = response.status;
    console.log(`📊 Response Status: ${status}\n`);

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Login Successful!');
      console.log('📋 User Data:');
      console.log(`  User ID: ${data.data.user_id}`);
      console.log(`  Username: ${data.data.username}`);
      console.log(`  Email: ${data.data.email}`);
      console.log(`  Role: ${data.data.role}`);
      console.log(`  Token: ${data.data.token.substring(0, 50)}...`);
      console.log(`\n🎉 Login test passed!`);
    } else {
      console.log('❌ Login Failed!');
      console.log(`  Message: ${data.message}`);
      console.log('\n📝 Full Response:');
      console.log(JSON.stringify(data, null, 2));
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testLogin();
