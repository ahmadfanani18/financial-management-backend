import crypto from 'crypto';
import { config } from '../../config/index.js';

interface MidtransConfig {
  merchantId: string;
  clientKey: string;
  serverKey: string;
  isProduction: boolean;
}

export const midtransConfig: MidtransConfig = {
  merchantId: config.midtrans.merchantId,
  clientKey: config.midtrans.clientKey,
  serverKey: config.midtrans.serverKey,
  isProduction: config.midtrans.isProduction,
};

export const getMidtransBaseUrl = () => {
  return midtransConfig.isProduction
    ? 'https://api.midtrans.com'
    : 'https://api.sandbox.midtrans.com';
};

const getAuthHeader = () => {
  const encoded = Buffer.from(`${midtransConfig.serverKey}:`).toString('base64');
  return `Basic ${encoded}`;
};

export interface CreateTransactionParams {
  orderId: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  paymentMethod: string;
  paymentProvider?: string;
}

export interface MidtransTransactionResponse {
  token: string;
  redirect_url: string;
  transaction_id?: string;
  vaNumber?: string | null;
}

export async function createMidtransTransaction(
  params: CreateTransactionParams
): Promise<MidtransTransactionResponse> {
  const baseUrl = getMidtransBaseUrl();
  const endpoint = `${baseUrl}/v2/charge`;

  const bankMap: Record<string, string> = {
    'BCA_VA': 'bca',
    'BRI_VA': 'bri',
    'BNI_VA': 'bni',
    'MANDIRI_VA': 'mandiri',
  };

  let payload: Record<string, unknown> = {};

  if (params.paymentMethod === 'VA_BANK') {
    const bankCode = bankMap[params.paymentProvider || ''] || 'bca';
    payload = {
      payment_type: 'bank_transfer',
      transaction_details: {
        gross_amount: params.amount,
        order_id: params.orderId,
      },
      customer_details: {
        first_name: params.customerName,
        email: params.customerEmail,
      },
      bank_transfer: {
        bank: bankCode,
      },
      expiry: {
        unit: 'hours',
        duration: 24,
      },
    };
  } else if (params.paymentMethod === 'E_WALLET') {
    payload = {
      payment_type: 'echannel',
      transaction_details: {
        gross_amount: params.amount,
        order_id: params.orderId,
      },
      customer_details: {
        first_name: params.customerName,
        email: params.customerEmail,
      },
      echannel: {
        bill_info1: 'Payment',
        bill_info2: `Order ${params.orderId}`,
      },
      expiry: {
        unit: 'minutes',
        duration: 15,
      },
    };
  } else if (params.paymentMethod === 'CREDIT_CARD') {
    payload = {
      payment_type: 'credit_card',
      transaction_details: {
        gross_amount: params.amount,
        order_id: params.orderId,
      },
      customer_details: {
        first_name: params.customerName,
        email: params.customerEmail,
      },
      credit_card: {
        token_id: params.paymentProvider,
      },
    };
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Midtrans error: ${error}`);
  }

  const result = await response.json();
  
  let vaNumber: string | null = null;
  if (params.paymentMethod === 'VA_BANK' && result.va_numbers) {
    vaNumber = result.va_numbers[0]?.va_number || null;
  } else if (params.paymentMethod === 'E_WALLET' && result.bill_key) {
    vaNumber = result.bill_key;
  }

  return {
    token: vaNumber || result.transaction_id || result.order_id,
    redirect_url: '',
    transaction_id: result.transaction_id,
    vaNumber,
  };
}

export async function getTransactionStatus(orderId: string) {
  const baseUrl = getMidtransBaseUrl();
  const endpoint = `${baseUrl}/v2/${orderId}/status`;

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Authorization: getAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get transaction status');
  }

  return response.json();
}

export function verifySignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  signatureKey: string
): boolean {
  const toSign = `${orderId}${statusCode}${grossAmount}${midtransConfig.serverKey}`;
  const signature = crypto
    .createHash('sha512')
    .update(toSign)
    .digest('hex');
  return signature === signatureKey;
}

export async function createSubscription(
  customerName: string,
  customerEmail: string,
  cardToken: string,
  amount: number,
  orderId: string
) {
  const baseUrl = getMidtransBaseUrl();
  const endpoint = `${baseUrl}/v2/subscription`;

  const payload = {
    name: `Subscription-${orderId}`,
    amount: amount,
    currency: 'IDR',
    payment_type: 'credit_card',
    transaction_time: new Date().toISOString(),
    repeat_interval: 'month',
    credit_card: {
      token_id: cardToken,
    },
    customer_details: {
      first_name: customerName,
      email: customerEmail,
    },
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Midtrans subscription error: ${error}`);
  }

  return response.json();
}