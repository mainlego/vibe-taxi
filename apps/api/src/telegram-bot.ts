import crypto from 'crypto'

// In-memory storage for Telegram deep link auth tokens
interface TelegramAuthData {
  user: {
    id: number
    first_name: string
    last_name?: string
    username?: string
    photo_url?: string
    auth_date: number
    hash: string
  }
  role: 'CLIENT' | 'DRIVER'
  expiresAt: Date
}

// Export tokens map to be used by auth routes
export const telegramAuthTokens = new Map<string, TelegramAuthData>()

// Long polling for Telegram bot updates
let lastUpdateId = 0

async function getUpdates(botToken: string): Promise<any[]> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`,
      { signal: AbortSignal.timeout(35000) }
    )
    const data = await response.json()

    if (data.ok && data.result.length > 0) {
      lastUpdateId = data.result[data.result.length - 1].update_id
      return data.result
    }
    return []
  } catch (error) {
    console.error('Telegram getUpdates error:', error)
    return []
  }
}

// Get user profile photo URL via Telegram Bot API
async function getUserPhotoUrl(botToken: string, userId: number): Promise<string | undefined> {
  try {
    // Get user profile photos
    const photosResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/getUserProfilePhotos?user_id=${userId}&limit=1`
    )
    const photosData = await photosResponse.json()

    if (!photosData.ok || !photosData.result.photos || photosData.result.photos.length === 0) {
      return undefined
    }

    // Get the smallest photo (last in array) for efficiency
    const photo = photosData.result.photos[0]
    const fileId = photo[photo.length - 1].file_id // Get smallest size

    // Get file path
    const fileResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
    )
    const fileData = await fileResponse.json()

    if (!fileData.ok || !fileData.result.file_path) {
      return undefined
    }

    // Return full photo URL
    return `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`
  } catch (error) {
    console.error('Failed to get user photo:', error)
    return undefined
  }
}

async function processUpdate(update: any, botToken: string) {
  // Handle /start command with auth token
  if (update.message?.text?.startsWith('/start auth_')) {
    const token = update.message.text.replace('/start auth_', '')
    const user = update.message.from

    // Extract role from token (format: ROLE_timestamp_random)
    const role = token.startsWith('DRIVER_') ? 'DRIVER' : 'CLIENT' as const

    // Get user photo from Telegram
    const photoUrl = await getUserPhotoUrl(botToken, user.id)

    // Generate auth hash for verification
    const authData = {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      photo_url: photoUrl,
      auth_date: Math.floor(Date.now() / 1000),
      hash: '', // Will be generated
    }

    // Generate hash
    const checkArr = Object.keys(authData)
      .filter(key => key !== 'hash' && authData[key as keyof typeof authData] !== undefined)
      .sort()
      .map(key => `${key}=${authData[key as keyof typeof authData]}`)
    const checkString = checkArr.join('\n')
    const secretKey = crypto.createHash('sha256').update(botToken).digest()
    authData.hash = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex')

    // Store token with user data
    telegramAuthTokens.set(token, {
      user: authData,
      role,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    })

    console.log(`✅ Telegram auth token stored: ${token} for user ${user.id} (@${user.username || 'no-username'})`)

    // Send success message to user
    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: user.id,
          text: '✅ Авторизация успешна! Вернитесь в приложение.',
          parse_mode: 'HTML',
        }),
      })
    } catch (err) {
      console.error('Failed to send Telegram message:', err)
    }
  } else if (update.message?.text === '/start') {
    // Handle plain /start command
    const user = update.message.from
    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: user.id,
          text: '👋 Добро пожаловать в Vibe Go!\n\nДля авторизации перейдите в приложение и нажмите "Войти через Telegram".',
          parse_mode: 'HTML',
        }),
      })
    } catch (err) {
      console.error('Failed to send Telegram message:', err)
    }
  }
}

export async function startTelegramBot() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN

  if (!botToken) {
    console.log('⚠️ TELEGRAM_BOT_TOKEN not set, Telegram auth disabled')
    return
  }

  // Delete any existing webhook first
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`)
    console.log('🤖 Telegram bot webhook deleted, starting long polling...')
  } catch (error) {
    console.error('Failed to delete webhook:', error)
  }

  // Start long polling loop
  const poll = async () => {
    while (true) {
      try {
        const updates = await getUpdates(botToken)
        for (const update of updates) {
          await processUpdate(update, botToken)
        }
      } catch (error) {
        console.error('Telegram polling error:', error)
        // Wait before retrying on error
        await new Promise(resolve => setTimeout(resolve, 5000))
      }
    }
  }

  // Start polling in background
  poll().catch(console.error)
  console.log('🤖 Telegram bot polling started')
}

// Cleanup expired tokens periodically
setInterval(() => {
  const now = new Date()
  for (const [token, data] of telegramAuthTokens.entries()) {
    if (now > data.expiresAt) {
      telegramAuthTokens.delete(token)
    }
  }
}, 60000) // Every minute
