import 'dotenv/config';
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
export const config = {
    port: parseInt(process.env.PORT || '3001', 10),
    jwtSecret: process.env.JWT_SECRET || 'default-secret',
    databaseUrl: process.env.DATABASE_URL,
    directUrl: process.env.DIRECT_URL,
    frontendUrl,
    allowedOrigins: [
        'http://localhost:3000',
        'http://localhost:3001',
        frontendUrl,
    ],
    midtrans: {
        merchantId: process.env.MIDTRANS_MERCHANT_ID || 'G723694640',
        clientKey: process.env.MIDTRANS_CLIENT_KEY || 'Mid-client-1_SXELtkLKLOzEAF',
        serverKey: process.env.MIDTRANS_SERVER_KEY || '',
        isProduction: process.env.NODE_ENV === 'production',
    },
};
