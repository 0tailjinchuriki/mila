// Crypto Payment Configuration
// This configuration is loaded locally instead of from Redis/Cloud
export const cryptoConfig = {
  available: true,
  assets: [
    {
      network: 'BTC',
      walletAddress: 'bc1qf0ks95rth4fczjkv6czketx0uwzjymqgt7jq2j',
      qrCodeImage: import.meta.url.replace('cryptoConfig.js', 'Qrcode.jpg')
    }
  ],
  instructions: 'Send the exact amount to the wallet address above. Your payment will be verified within 24-48 hours.'
};
