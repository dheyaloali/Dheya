const fs = require('fs');

(async () => {
  const fetch = (await import('node-fetch')).default;

  const email = 'admin@example.com'; // Change if your admin email is different

  fetch('http://localhost:3000/api/auth/mfa/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  })
    .then(res => res.json())
    .then(data => {
      if (!data.qrCodeDataUrl) {
        console.error('No qrCodeDataUrl in response:', data);
        return;
      }
      // Extract base64 part
      const base64 = data.qrCodeDataUrl.split(',')[1];
      fs.writeFileSync('qrcode.png', Buffer.from(base64, 'base64'));
      console.log('QR code saved as qrcode.png');
    })
    .catch(console.error);
})();