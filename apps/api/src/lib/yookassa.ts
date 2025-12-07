import { v4 as uuidv4 } from 'uuid'

// YooKassa API Client
// Документация: https://yookassa.ru/developers/using-api/interaction-format

const YOOKASSA_API_URL = 'https://api.yookassa.ru/v3'
const SHOP_ID = process.env.YOOKASSA_SHOP_ID || '1144955'
const SECRET_KEY = process.env.YOOKASSA_SECRET_KEY || 'test_5mTrR-pioRqBGUA_d579j6l-JHLxXi8_jrTv03a9h4Y'

interface CreatePaymentParams {
  amount: number
  currency?: string
  description: string
  returnUrl: string
  metadata?: Record<string, string>
  capture?: boolean
}

interface PaymentResponse {
  id: string
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled'
  paid: boolean
  amount: {
    value: string
    currency: string
  }
  confirmation?: {
    type: string
    confirmation_url: string
  }
  created_at: string
  description?: string
  metadata?: Record<string, string>
  payment_method?: {
    type: string
    id: string
    saved: boolean
    title?: string
  }
  recipient: {
    account_id: string
    gateway_id: string
  }
  refundable: boolean
  test: boolean
}

interface RefundResponse {
  id: string
  status: 'pending' | 'succeeded' | 'canceled'
  amount: {
    value: string
    currency: string
  }
  created_at: string
  payment_id: string
}

class YooKassaClient {
  private shopId: string
  private secretKey: string
  private baseUrl: string

  constructor() {
    this.shopId = SHOP_ID
    this.secretKey = SECRET_KEY
    this.baseUrl = YOOKASSA_API_URL
  }

  private getAuthHeader(): string {
    const credentials = Buffer.from(`${this.shopId}:${this.secretKey}`).toString('base64')
    return `Basic ${credentials}`
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: Record<string, unknown>,
    idempotenceKey?: string
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Authorization': this.getAuthHeader(),
      'Content-Type': 'application/json',
    }

    if (idempotenceKey) {
      headers['Idempotence-Key'] = idempotenceKey
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('YooKassa API error:', data)
      throw new Error(data.description || 'YooKassa API error')
    }

    return data as T
  }

  /**
   * Создание платежа
   * https://yookassa.ru/developers/api#create_payment
   */
  async createPayment(params: CreatePaymentParams): Promise<PaymentResponse> {
    const idempotenceKey = uuidv4()

    const payload = {
      amount: {
        value: params.amount.toFixed(2),
        currency: params.currency || 'RUB',
      },
      capture: params.capture ?? true, // Автоматическое подтверждение платежа
      confirmation: {
        type: 'redirect',
        return_url: params.returnUrl,
      },
      description: params.description,
      metadata: params.metadata,
    }

    console.log('Creating YooKassa payment:', payload)

    return this.request<PaymentResponse>('POST', '/payments', payload, idempotenceKey)
  }

  /**
   * Получение информации о платеже
   * https://yookassa.ru/developers/api#get_payment
   */
  async getPayment(paymentId: string): Promise<PaymentResponse> {
    return this.request<PaymentResponse>('GET', `/payments/${paymentId}`)
  }

  /**
   * Подтверждение платежа (capture)
   * https://yookassa.ru/developers/api#capture_payment
   */
  async capturePayment(paymentId: string, amount?: number): Promise<PaymentResponse> {
    const idempotenceKey = uuidv4()

    const payload: Record<string, unknown> = {}
    if (amount !== undefined) {
      payload.amount = {
        value: amount.toFixed(2),
        currency: 'RUB',
      }
    }

    return this.request<PaymentResponse>('POST', `/payments/${paymentId}/capture`, payload, idempotenceKey)
  }

  /**
   * Отмена платежа
   * https://yookassa.ru/developers/api#cancel_payment
   */
  async cancelPayment(paymentId: string): Promise<PaymentResponse> {
    const idempotenceKey = uuidv4()
    return this.request<PaymentResponse>('POST', `/payments/${paymentId}/cancel`, {}, idempotenceKey)
  }

  /**
   * Создание возврата
   * https://yookassa.ru/developers/api#create_refund
   */
  async createRefund(paymentId: string, amount: number, description?: string): Promise<RefundResponse> {
    const idempotenceKey = uuidv4()

    const payload = {
      payment_id: paymentId,
      amount: {
        value: amount.toFixed(2),
        currency: 'RUB',
      },
      description,
    }

    return this.request<RefundResponse>('POST', '/refunds', payload, idempotenceKey)
  }

  /**
   * Получение информации о возврате
   * https://yookassa.ru/developers/api#get_refund
   */
  async getRefund(refundId: string): Promise<RefundResponse> {
    return this.request<RefundResponse>('GET', `/refunds/${refundId}`)
  }
}

// Singleton instance
export const yookassa = new YooKassaClient()

// Export types
export type { CreatePaymentParams, PaymentResponse, RefundResponse }
