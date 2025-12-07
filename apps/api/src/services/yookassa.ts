import { v4 as uuid } from 'uuid'

// ЮKassa API configuration
const YOOKASSA_SHOP_ID = process.env.YOOKASSA_SHOP_ID || ''
const YOOKASSA_SECRET_KEY = process.env.YOOKASSA_SECRET_KEY || ''
const YOOKASSA_API_URL = 'https://api.yookassa.ru/v3'

interface CreatePaymentParams {
  amount: number
  currency?: string
  description: string
  returnUrl: string
  metadata?: Record<string, string>
}

interface PaymentResponse {
  id: string
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled'
  amount: {
    value: string
    currency: string
  }
  confirmation?: {
    type: string
    confirmation_url: string
  }
  created_at: string
  description: string
  metadata?: Record<string, string>
  paid: boolean
}

export class YooKassaService {
  private shopId: string
  private secretKey: string

  constructor() {
    this.shopId = YOOKASSA_SHOP_ID
    this.secretKey = YOOKASSA_SECRET_KEY
  }

  private getAuthHeader(): string {
    const credentials = Buffer.from(`${this.shopId}:${this.secretKey}`).toString('base64')
    return `Basic ${credentials}`
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResponse> {
    const idempotenceKey = uuid()

    const body = {
      amount: {
        value: params.amount.toFixed(2),
        currency: params.currency || 'RUB'
      },
      confirmation: {
        type: 'redirect',
        return_url: params.returnUrl
      },
      capture: true,
      description: params.description,
      metadata: params.metadata
    }

    const response = await fetch(`${YOOKASSA_API_URL}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.getAuthHeader(),
        'Idempotence-Key': idempotenceKey
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('YooKassa error:', error)
      throw new Error(`YooKassa payment creation failed: ${error}`)
    }

    return response.json()
  }

  async getPayment(paymentId: string): Promise<PaymentResponse> {
    const response = await fetch(`${YOOKASSA_API_URL}/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': this.getAuthHeader()
      }
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`YooKassa get payment failed: ${error}`)
    }

    return response.json()
  }

  async cancelPayment(paymentId: string): Promise<PaymentResponse> {
    const idempotenceKey = uuid()

    const response = await fetch(`${YOOKASSA_API_URL}/payments/${paymentId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.getAuthHeader(),
        'Idempotence-Key': idempotenceKey
      }
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`YooKassa cancel payment failed: ${error}`)
    }

    return response.json()
  }

  // Validate webhook signature
  validateWebhook(body: string, signature: string): boolean {
    // ЮKassa uses IP-based validation for webhooks
    // For production, verify the request comes from YooKassa IPs
    // 185.71.76.0/27, 185.71.77.0/27, 77.75.153.0/25, 77.75.156.11, 77.75.156.35
    return true // Simplified for now
  }
}

export const yooKassaService = new YooKassaService()
