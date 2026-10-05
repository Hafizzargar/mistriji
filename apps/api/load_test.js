import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '20s', target: 50 },   // Ramp up to 50 users
    { duration: '30s', target: 100 },  // Normal load: 100 concurrent users
    { duration: '20s', target: 500 },  // Stress load: 500 users
    { duration: '10s', target: 1000 }, // Spike load: 1000 users
    { duration: '20s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests below 1s
    http_req_failed: ['rate<0.05'],    // Error rate must be less than 5%
  },
};

const BASE_URL = __ENV.API_URL || 'https://mistriji.onrender.com';

export default function () {
  // 1. Health check (lightweight)
  let healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
  });

  sleep(0.5);

  // 2. Capacity test with UNIQUE test users/identifiers per VU and iteration
  // Prevents artificial rate-limiting (429) caused by sharing a single phone number
  const uniquePhone = String(9800000000 + (__VU * 10000) + __ITER);

  let otpPayload = JSON.stringify({
    identifier: uniquePhone,
    type: 'phone',
  });

  let otpParams = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  let otpRes = http.post(`${BASE_URL}/api/otp/send`, otpPayload, otpParams);
  check(otpRes, {
    'otp send succeeds (200)': (r) => r.status === 200,
  });

  sleep(0.5);
}
