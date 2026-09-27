const http = require('http');

async function sendOtpRequest(index) {
  // Generate valid Indian phone numbers (e.g. +919876543000 to +919876543999)
  const phone = `+91987654${String(3000 + index).slice(-4)}`;
  const payload = JSON.stringify({ identifier: phone, role: 'customer' });
  
  const start = Date.now();
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3002,
      path: '/api/otp/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'X-Forwarded-For': `10.0.${Math.floor(index / 20)}.${(index % 250) + 1}`
      },
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        const duration = Date.now() - start;
        resolve({ status: res.statusCode, duration, data });
      });
    });

    req.on('error', (err) => {
      resolve({ status: 0, duration: Date.now() - start, error: err.message });
    });

    req.write(payload);
    req.end();
  });
}

async function runBenchmark() {
  console.log('=== High-Concurrency Test on POST /api/otp/send ===');
  console.log('50 concurrent workers x 10 iterations = 500 total requests\n');

  const allResults = [];
  const startTotal = Date.now();

  for (let batch = 1; batch <= 10; batch++) {
    const batchStart = Date.now();
    const promises = [];
    for (let i = 0; i < 50; i++) {
      const globalIdx = (batch - 1) * 50 + i;
      promises.push(sendOtpRequest(globalIdx));
    }
    const batchResults = await Promise.all(promises);
    allResults.push(...batchResults);
    const batchDuration = Date.now() - batchStart;
    console.log(`Batch ${batch}/10: 50 requests in ${batchDuration}ms`);
  }

  const totalTime = Date.now() - startTotal;
  
  const statusCounts = {};
  const latencies = [];
  allResults.forEach(r => {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    latencies.push(r.duration);
  });

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.50)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const min = latencies[0];
  const max = latencies[latencies.length - 1];
  const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);

  console.log('\n================ LOAD TEST RESULTS ================');
  console.log(`Total Requests:    ${allResults.length}`);
  console.log(`Total Elapsed:     ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`Throughput (RPS):  ${((allResults.length / totalTime) * 1000).toFixed(1)} req/sec`);
  console.log('\n--- HTTP Status Breakdown ---');
  Object.entries(statusCounts).forEach(([status, count]) => {
    const label = status === '200' ? 'OK (OTP Generated & Sent)' :
                  status === '429' ? 'Rate Limited (Protected by otpRateLimitMiddleware / 60s cooldown)' :
                  status === '400' ? 'Bad Request' :
                  status === '0'   ? 'Connection Error' : `Status ${status}`;
    console.log(`  HTTP ${status} (${label}): ${count} (${((count/allResults.length)*100).toFixed(1)}%)`);
  });
  console.log('\n--- Latency Percentiles ---');
  console.log(`  Min:  ${min}ms`);
  console.log(`  Avg:  ${avg}ms`);
  console.log(`  p50:  ${p50}ms`);
  console.log(`  p95:  ${p95}ms`);
  console.log(`  p99:  ${p99}ms`);
  console.log(`  Max:  ${max}ms`);
  console.log('====================================================\n');
}

runBenchmark();
