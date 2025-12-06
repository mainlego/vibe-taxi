# Vibe Taxi

Современное приложение такси на базе Next.js 14, Fastify и PostgreSQL.

## Технологии

- **Monorepo**: Turborepo + pnpm workspaces
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- **Backend**: Fastify, Socket.IO, TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **State Management**: Zustand, TanStack Query
- **Deployment**: Docker, Nginx

## Структура проекта

```
vibe-taxi/
├── apps/
│   ├── api/          # Fastify API сервер
│   ├── client/       # Приложение пассажира (Next.js)
│   ├── driver/       # Приложение водителя (Next.js)
│   └── admin/        # Админ панель (Next.js)
├── packages/
│   └── database/     # Prisma схема и клиент
├── nginx/            # Конфигурация Nginx
├── docker-compose.yml
└── Dockerfile
```

## Быстрый старт

### Требования

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose (для БД)

### Установка

```bash
# Клонировать репозиторий
git clone <repo-url>
cd vibe-taxi

# Установить зависимости
pnpm install

# Скопировать переменные окружения
cp .env.example .env

# Запустить PostgreSQL
docker compose -f docker-compose.dev.yml up -d

# Сгенерировать Prisma клиент
pnpm db:generate

# Применить схему к БД
pnpm db:push

# Заполнить БД тестовыми данными
cd packages/database && pnpm db:seed && cd ../..

# Запустить все приложения
pnpm dev
```

### Доступ к приложениям

- **Client** (пассажир): http://localhost:3000
- **Driver** (водитель): http://localhost:3002
- **Admin** (админ): http://localhost:3003
- **API**: http://localhost:3001

## Команды

```bash
# Разработка
pnpm dev              # Запустить все приложения
pnpm build            # Собрать все приложения

# База данных
pnpm db:generate      # Сгенерировать Prisma клиент
pnpm db:push          # Применить схему к БД
pnpm db:studio        # Открыть Prisma Studio
```

## Деплой на VPS (reg.ru)

### 1. Подготовка сервера

```bash
# Установить Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Установить Docker Compose
apt install docker-compose-plugin
```

### 2. Настройка DNS

Добавить A-записи в DNS:
- `vibe-taxi.ru` → IP сервера
- `api.vibe-taxi.ru` → IP сервера
- `driver.vibe-taxi.ru` → IP сервера
- `admin.vibe-taxi.ru` → IP сервера

### 3. Деплой

```bash
# Клонировать репозиторий на сервер
git clone <repo-url>
cd vibe-taxi

# Создать .env файл с production настройками
cp .env.example .env
nano .env  # Отредактировать настройки

# Запустить все сервисы
docker compose --profile production up -d

# Применить миграции
docker compose exec api npx prisma db push

# Посмотреть логи
docker compose logs -f
```

### 4. SSL сертификаты (Certbot)

```bash
# Установить Certbot
apt install certbot

# Получить сертификаты
certbot certonly --webroot -w /var/www/certbot \
  -d vibe-taxi.ru \
  -d api.vibe-taxi.ru \
  -d driver.vibe-taxi.ru \
  -d admin.vibe-taxi.ru
```

## API Endpoints

### Авторизация
- `POST /api/auth/send-code` - Отправить SMS код
- `POST /api/auth/verify` - Проверить код
- `POST /api/auth/register` - Регистрация
- `GET /api/auth/me` - Текущий пользователь

### Заказы
- `POST /api/orders` - Создать заказ
- `GET /api/orders/:id` - Получить заказ
- `POST /api/orders/:id/accept` - Принять заказ (водитель)
- `POST /api/orders/:id/arrived` - Водитель на месте
- `POST /api/orders/:id/start` - Начать поездку
- `POST /api/orders/:id/complete` - Завершить поездку
- `POST /api/orders/:id/cancel` - Отменить заказ

### Водители
- `POST /api/drivers/register` - Регистрация водителя
- `GET /api/drivers/me` - Профиль водителя
- `POST /api/drivers/location` - Обновить геолокацию
- `POST /api/drivers/status` - Изменить статус

### Тарифы
- `GET /api/tariffs` - Все тарифы
- `POST /api/tariffs/calculate-all` - Расчёт цен

## WebSocket Events

### Клиент
- `order:accepted` - Заказ принят водителем
- `order:status` - Изменение статуса заказа
- `order:completed` - Поездка завершена
- `order:cancelled` - Заказ отменён
- `driver:location:update` - Обновление локации водителя

### Водитель
- `order:available` - Новый доступный заказ
- `order:taken` - Заказ взят другим водителем
- `order:accept:success` - Успешное принятие заказа
- `order:accept:error` - Ошибка принятия заказа

## Лицензия

MIT
