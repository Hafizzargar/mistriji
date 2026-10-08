const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const { sendEmailNotification } = require('../emailService');

const router = express.Router();

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'dummy_key',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret',
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

// ─── Helper: Send Payment Emails ────────────────────────────────
async function sendPaymentEmails(amount, paymentId, userEmail, userName) {
  const amountRupees = amount / 100;
  
  // 1. Email to Customer
  if (userEmail) {
    const customerHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.04);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #4f46e5; margin: 0; font-size: 26px; font-weight: 800;">🔧 MistriJi</h1>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0; font-weight: 500;">Payment Receipt</p>
        </div>

        <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); border-radius: 12px; padding: 20px; text-align: center; color: #ffffff; margin-bottom: 24px;">
          <div style="font-size: 28px; margin-bottom: 6px;">✅</div>
          <h2 style="margin: 0; font-size: 20px; font-weight: 800;">Payment Successful!</h2>
          <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.9;">Thank you for your payment.</p>
        </div>

        <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 12px;">
            <span style="color: #64748b; font-size: 13px; font-weight: 600;">Amount Paid:</span>
            <strong style="color: #1e1b4b; font-size: 18px;">₹${amountRupees.toFixed(2)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span style="color: #64748b; font-size: 13px; font-weight: 600;">Payment ID:</span>
            <span style="color: #334155; font-family: monospace; font-size: 13px;">${paymentId}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #64748b; font-size: 13px; font-weight: 600;">Date:</span>
            <span style="color: #334155; font-size: 13px;">${new Date().toLocaleString('en-IN')}</span>
          </div>
        </div>

        <p style="text-align: center; color: #94a3b8; font-size: 11px; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
          © ${new Date().getFullYear()} MistriJi — Jammu & Kashmir Local Services Platform
        </p>
      </div>
    `;
    await sendEmailNotification(userEmail, 'Payment Receipt - MistriJi', customerHtml).catch(console.error);
  }

  // 2. Email to Admin
  const adminEmail = process.env.ADMIN_EMAIL || 'hafezzargar987@gmail.com';
  const adminHtml = `
    <div style="font-family: sans-serif; padding: 20px;">
      <h2 style="color: #059669;">New Payment Received 💰</h2>
      <p>A payment of <strong>₹${amountRupees.toFixed(2)}</strong> was just successfully captured.</p>
      <ul>
        <li><strong>Customer:</strong> ${userName || userEmail || 'Unknown'}</li>
        <li><strong>Payment ID:</strong> ${paymentId}</li>
        <li><strong>Date:</strong> ${new Date().toLocaleString('en-IN')}</li>
      </ul>
      <p><a href="http://localhost:3001/payments">View Payment History in Admin Panel</a></p>
    </div>
  `;
  await sendEmailNotification(adminEmail, `New Payment: ₹${amountRupees} - MistriJi`, adminHtml).catch(console.error);
}

// 1. Create Order Server-Side
router.post('/create-order', async (req, res) => {
  // ── SECURITY GATE: Authentication & Authorization ──
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token.' });
  }
  const token = authHeader.split(' ')[1];
  let decodedToken;
  try {
    decodedToken = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token.' });
  }

  const authenticatedUserId = decodedToken.sub;
  const userRole = decodedToken.app_metadata?.role || decodedToken.role;

  const { amount, currency, userId, jobId, workerId } = req.body;

  if (!amount || !userId) {
    return res.status(400).json({ error: 'Amount and userId are required.' });
  }

  // Ensure requesting user matches userId (or is admin/super_admin)
  if (userRole !== 'admin' && userRole !== 'super_admin' && authenticatedUserId !== userId) {
    return res.status(403).json({ error: 'Forbidden: Cannot create order for another user.' });
  }

  // If jobId is provided, verify job ownership and amount integrity against database
  if (jobId) {
    const { data: jobData, error: jobError } = await supabase.from('jobs').select('id, customer_id, price').eq('id', jobId).single();
    if (jobError || !jobData) {
      return res.status(404).json({ error: 'Associated job not found.' });
    }
    if (userRole !== 'admin' && userRole !== 'super_admin' && jobData.customer_id !== authenticatedUserId) {
      return res.status(403).json({ error: 'Forbidden: Job does not belong to user.' });
    }
    // Amount integrity check (jobData.price is in Rupees, amount is in paise)
    if (jobData.price !== null && jobData.price !== undefined) {
      const expectedPaise = Math.round(Number(jobData.price) * 100);
      if (Number(amount) !== expectedPaise) {
        return res.status(400).json({
          error: `Invalid payment amount. Expected ₹${jobData.price} (${expectedPaise} paise), but received ${amount} paise.`
        });
      }
    }
  }

  try {
    // Check for Razorpay Route worker split
    let transferOptions = [];
    let workerShare = amount; // default: worker gets all if we could somehow transfer, but we can't if no account. If no account, admin gets all.
    let commissionEarned = 0;

    if (workerId) {
      // 1. Get worker's Razorpay Account ID
      const { data: worker } = await supabase.from('workers').select('razorpay_account_id').eq('id', workerId).single();
      
      if (worker && worker.razorpay_account_id) {
        // 2. Get Commission Settings
        const { data: settingsData } = await supabase.from('system_settings').select('value').eq('key', 'mistriji_payment_settings').maybeSingle();
        const settings = settingsData?.value || { type: 'percentage', value: 10 }; // Default 10%

        if (settings.type === 'percentage') {
          commissionEarned = Math.round(amount * (settings.value / 100));
        } else {
          // Fixed fee, convert setting value to paise (assuming setting is in INR)
          commissionEarned = Math.min(amount, settings.value * 100); 
        }

        // Only do transfer if worker payments are enabled, otherwise don't split via Route
        if (settings.workerPaymentsEnabled !== false) {
          workerShare = amount - commissionEarned;
        } else {
          workerShare = 0; // Skip transfer
        }

        if (workerShare > 0) {
          transferOptions = [{
            account: worker.razorpay_account_id,
            amount: workerShare,
            currency: 'INR',
            notes: {
              jobId: jobId || 'none'
            },
            on_hold: 0 // Settled immediately according to route rules
          }];
        }
      }
    }

    const options = {
      amount: amount, 
      currency: currency || 'INR',
      receipt: `rcpt_${Date.now()}`,
      ...(transferOptions.length > 0 && { transfers: transferOptions })
    };
    
    const order = await razorpay.orders.create(options);

    const { error } = await supabase.from('payments').insert([{
      order_id: order.id,
      amount: amount,
      currency: options.currency,
      status: 'created',
      user_id: userId,
      job_id: jobId || null,
      worker_id: workerId || null,
      receipt_id: options.receipt,
      commission_earned: commissionEarned,
      worker_share: workerShare,
      is_route_split: transferOptions.length > 0
    }]);

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ error: 'Failed to create payment record in database.' });
    }

    res.json({ success: true, order_id: order.id, currency: options.currency, amount: amount });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 2. Verify Payment Signature
router.post('/verify', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userEmail, userName } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment details.' });
  }

  try {
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    
    if (hmac.digest('hex') === razorpay_signature) {
      // 1. Fetch current status
      const { data: currentPayment } = await supabase.from('payments').select('status, amount').eq('order_id', razorpay_order_id).single();
      
      // 2. Only process if it's currently 'created'
      if (currentPayment && currentPayment.status === 'created') {
        const { error } = await supabase
          .from('payments')
          .update({ status: 'captured', payment_id: razorpay_payment_id, signature: razorpay_signature })
          .eq('order_id', razorpay_order_id);

        if (!error) {
          // Send Emails exactly once
          await sendPaymentEmails(currentPayment.amount, razorpay_payment_id, userEmail, userName);
        }
      }

      return res.json({ success: true, message: 'Payment verified.' });
    } else {
      return res.status(400).json({ error: 'Invalid signature.' });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 3. Razorpay Webhook (Source of truth if user drops connection)
router.post('/webhook', async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers['x-razorpay-signature'];
  
  if (!signature || !req.rawBody) {
    return res.status(400).send('Missing signature or raw body');
  }

  try {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(req.rawBody);
    
    if (hmac.digest('hex') !== signature) {
      return res.status(400).send('Invalid signature');
    }

    const event = req.body;
    if (event.event === 'payment.captured') {
      const paymentData = event.payload.payment.entity;
      const order_id = paymentData.order_id;
      const payment_id = paymentData.id;
      const contact_email = paymentData.email; // Razorpay captures email if passed in checkout
      
      const { data: currentPayment } = await supabase.from('payments').select('status, amount').eq('order_id', order_id).single();
      
      if (currentPayment && currentPayment.status === 'created') {
        const { error } = await supabase
          .from('payments')
          .update({ status: 'captured', payment_id: payment_id })
          .eq('order_id', order_id);
          
        if (!error) {
          // Send emails exactly once
          await sendPaymentEmails(currentPayment.amount, payment_id, contact_email, null);
        }
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Webhook Error');
  }
});

module.exports = router;
