## Admin MFA Setup & Login

### Enabling MFA for Admin
1. **Request Setup:**  
   POST `/api/auth/mfa/setup` with `{ email }`  
   → Returns QR code and secret.
2. **Scan QR Code:**  
   Use Google Authenticator or similar.
3. **Verify:**  
   POST `/api/auth/mfa/verify` with `{ email, token }`  
   → If valid, MFA is enabled.

### Admin Login with MFA
- POST to login with `{ email, password, mfaCode }`
- If admin and MFA is enabled, `mfaCode` is required.

### Security
- MFA secret is stored securely.
- Only admin is required to use MFA.
- Rate limiting and password complexity are enforced. 