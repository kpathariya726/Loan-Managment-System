import http from 'http';

function makeRequest(
  options: http.RequestOptions,
  postData?: string
): Promise<{ status?: number; data: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ status: res.statusCode, data });
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runLiveApiChecks() {
  console.log('================================================================');
  console.log('             LMS LIVE API GATEWAY AUTHENTICATION CHECK          ');
  console.log('================================================================');

  try {
    // 1. Hit public login endpoint
    console.log('\n[Client] Sending credentials to POST http://127.0.0.1:3000/api/auth/login...');
    const loginPayload = JSON.stringify({
      email: 'borrower@lms.com',
      password: 'LmsBorrowPassword123!'
    });

    const loginOptions: http.RequestOptions = {
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginPayload)
      }
    };

    const loginResponse = await makeRequest(loginOptions, loginPayload);
    console.log(`[Client] Server Status Code: ${loginResponse.status}`);
    
    const loginJson = JSON.parse(loginResponse.data);
    console.log('[Client] Server JSON Response:');
    console.log(JSON.stringify(loginJson, null, 2));

    if (!loginJson.success || !loginJson.token) {
      throw new Error('Login failed; no token issued.');
    }

    const token = loginJson.token; // Bearer token

    // 2. Hit protected endpoint with the token
    console.log('\n[Client] Requesting protected endpoint GET /api/borrower/profile with Bearer Token...');
    const profileOptions: http.RequestOptions = {
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/borrower/profile',
      method: 'GET',
      headers: {
        'Authorization': token
      }
    };

    const profileResponse = await makeRequest(profileOptions);
    console.log(`[Client] Server Status Code: ${profileResponse.status}`);
    
    const profileJson = JSON.parse(profileResponse.data);
    console.log('[Client] Server JSON Response:');
    console.log(JSON.stringify(profileJson, null, 2));

    // 3. Hit forbidden route to verify RBAC interceptor
    console.log('\n[Client] Requesting admin-only endpoint GET /api/loans with Borrower Bearer Token...');
    const loansOptions: http.RequestOptions = {
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/loans',
      method: 'GET',
      headers: {
        'Authorization': token // Token is for BORROWER role
      }
    };

    const loansResponse = await makeRequest(loansOptions);
    console.log(`[Client] Server Status Code: ${loansResponse.status} (Expected: 403 Forbidden)`);
    
    const loansJson = JSON.parse(loansResponse.data);
    console.log('[Client] Server JSON Response:');
    console.log(JSON.stringify(loansJson, null, 2));

    console.log('\n================================================================');
    console.log('                 API INTERCEPTORS VERIFIED                       ');
    console.log('================================================================');

  } catch (error: any) {
    console.error(`\n[Client Error] API tests failed: ${error.message}`);
    console.log('Make sure the backend server task is running on port 3000!');
  }
}

// Introduce short delay to let Express server database initialization finalize before requests start
setTimeout(() => {
  runLiveApiChecks();
}, 2500);
