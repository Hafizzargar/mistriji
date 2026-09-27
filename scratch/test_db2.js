const { SUPABASE_URL, SUPABASE_KEY } = require('./config.cjs')

async function test() {
  const notif = {
    user_id: '0c9a64e6-7305-4567-bdc3-298995fb342e', // admin id
    title: 'Test Booking',
    message: 'Test msg from admin',
    type: 'booking_alert',
    is_read: false
  }

  // To insert as admin, we need the admin's access token, which we don't have.
  // We'll just see if anon can insert. We already know it fails.
}
