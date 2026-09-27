// MistriJi Performance & Concurrency Load Testing Suite
const http = require('http');
const https = require('https');
const { SUPABASE_URL: SUPABASE_BASE_URL, SUPABASE_KEY } = require('./config.cjs');

const FRONTEND_URL = 'http://localhost:3000/';
const SUPABASE_URL = SUPABASE_BASE_URL + '/rest/v1/skills?select=*';

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function runComputationStressTest() {
  console.log('\n======================================================');
  console.log('TEST 1: CLIENT COMPUTATIONAL & SORTING STRESS TEST');
  console.log('======================================================');
  
  const workerCounts = [50, 500, 2000, 10000];
  for (const count of workerCounts) {
    const workers = Array.from({ length: count }, (_, i) => ({
      id: `w-${i}`,
      name: `Worker ${i}`,
      lat: 32.7 + (Math.random() * 0.5),
      lng: 74.8 + (Math.random() * 0.5),
      rating: 4 + Math.random(),
    }));

    const customerCoords = { lat: 32.7266, lng: 74.8570 }; // Jammu center
    
    const start = performance.now();
    const iterations = count > 2000 ? 50 : 200;
    for (let iter = 0; iter < iterations; iter++) {
      const sorted = workers.map(w => ({
        ...w,
        dist: haversine(customerCoords.lat, customerCoords.lng, w.lat, w.lng)
      })).sort((a, b) => a.dist - b.dist);
    }
    const end = performance.now();
    const avgTimePerRun = (end - start) / iterations;
    
    console.log(`- ${count} workers across ${iterations} sort cycles: ${avgTimePerRun.toFixed(3)} ms/run (Capacity: ~${Math.round(1000 / avgTimePerRun)} runs/sec per core)`);
  }
}

async function runHttpLoadTest(targetUrl, totalRequests, concurrency, isHttps = false, headers = {}) {
  const client = isHttps ? https : http;
  const agent = new (isHttps ? https.Agent : http.Agent)({ keepAlive: true, maxSockets: concurrency + 20 });
  
  let completed = 0;
  let success = 0;
  let failed = 0;
  const latencies = [];
  const startTime = performance.now();

  return new Promise((resolve) => {
    let active = 0;
    let requestIndex = 0;

    function next() {
      if (requestIndex >= totalRequests) {
        if (active === 0) {
          const totalTime = (performance.now() - startTime) / 1000;
          latencies.sort((a, b) => a - b);
          const p50 = latencies[Math.floor(latencies.length * 0.50)] || 0;
          const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
          const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
          const rps = (totalRequests / totalTime).toFixed(1);
          
          resolve({
            totalRequests,
            concurrency,
            totalTime: totalTime.toFixed(2),
            rps,
            success,
            failed,
            p50: p50.toFixed(1),
            p95: p95.toFixed(1),
            p99: p99.toFixed(1),
            min: (latencies[0] || 0).toFixed(1),
            max: (latencies[latencies.length - 1] || 0).toFixed(1)
          });
        }
        return;
      }

      while (active < concurrency && requestIndex < totalRequests) {
        active++;
        requestIndex++;
        const reqStart = performance.now();
        
        const req = client.get(targetUrl, { agent, headers, timeout: 8000 }, (res) => {
          res.on('data', () => {});
          res.on('end', () => {
            const reqTime = performance.now() - reqStart;
            latencies.push(reqTime);
            if (res.statusCode >= 200 && res.statusCode < 400) {
              success++;
            } else {
              failed++;
            }
            active--;
            completed++;
            next();
          });
        });

        req.on('error', (err) => {
          failed++;
          active--;
          completed++;
          next();
        });

        req.on('timeout', () => {
          failed++;
          req.destroy();
          active--;
          completed++;
          next();
        });
      }
    }

    next();
  });
}

async function main() {
  console.log('======================================================');
  console.log('MISTRIJI CONCURRENCY & CAPACITY BENCHMARK SUITE');
  console.log('======================================================');
  
  // Test 1: Computation
  runComputationStressTest();

  // Test 2: Local Web Server Concurrency Load Test
  console.log('\n======================================================');
  console.log('TEST 2: LOCAL WEB APP (VITE) CONCURRENCY LOAD TEST');
  console.log('======================================================');
  
  const frontendStages = [
    { name: 'Stage 1: Low Concurrency', total: 100, concurrency: 25 },
    { name: 'Stage 2: Medium Concurrency', total: 300, concurrency: 75 },
    { name: 'Stage 3: High Concurrency', total: 600, concurrency: 150 },
    { name: 'Stage 4: Peak Concurrency', total: 1000, concurrency: 300 },
  ];

  for (const stage of frontendStages) {
    process.stdout.write(`Executing ${stage.name} (${stage.concurrency} concurrent virtual users, ${stage.total} total requests)... `);
    const result = await runHttpLoadTest(FRONTEND_URL, stage.total, stage.concurrency, false);
    console.log(`DONE!`);
    console.log(`  -> Throughput: ${result.rps} req/sec | Success: ${result.success}/${result.totalRequests} (Error rate: ${((result.failed / result.totalRequests) * 100).toFixed(1)}%)`);
    console.log(`  -> Latency: p50: ${result.p50}ms | p95: ${result.p95}ms | p99: ${result.p99}ms (Min: ${result.min}ms, Max: ${result.max}ms)`);
  }

  // Test 3: Backend Database / API Load Test (Supabase PostgREST)
  console.log('\n======================================================');
  console.log('TEST 3: SUPABASE BACKEND API CONCURRENCY TEST');
  console.log('======================================================');
  
  const backendStages = [
    { name: 'Stage 1: Light API Traffic', total: 50, concurrency: 10 },
    { name: 'Stage 2: Active API Traffic', total: 100, concurrency: 25 },
    { name: 'Stage 3: Heavy API Traffic', total: 200, concurrency: 50 },
  ];

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json'
  };

  for (const stage of backendStages) {
    process.stdout.write(`Executing ${stage.name} (${stage.concurrency} concurrent connections)... `);
    const result = await runHttpLoadTest(SUPABASE_URL, stage.total, stage.concurrency, true, headers);
    console.log(`DONE!`);
    console.log(`  -> API Throughput: ${result.rps} req/sec | Success: ${result.success}/${result.totalRequests}`);
    console.log(`  -> API Latency: p50: ${result.p50}ms | p95: ${result.p95}ms | p99: ${result.p99}ms`);
  }

  console.log('\n======================================================');
  console.log('BENCHMARK RUN COMPLETED SUCCESSFULLY');
  console.log('======================================================');
}

main().catch(console.error);
