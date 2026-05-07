# SkillMap - Платформа для диагностики навыков

## Описание
SkillMap - это образовательная платформа для диагностики и развития навыков учеников с возможностью входа через Google и email/пароль.

## Технологии
- React + TypeScript + Vite
- Supabase (локальная база данных)
- TailwindCSS + shadcn/ui
- React Router
- Framer Motion

## Требования
- Node.js 18+ или Bun
- Docker Desktop (для локального Supabase)
- Supabase CLI

## Установка

### 1. Установите зависимости
```bash
npm install
# или
bun install
```

### 2. Установите Supabase CLI
```bash
# MacOS
brew install supabase/tap/supabase

# Windows (PowerShell)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Linux
brew install supabase/tap/supabase
```

### 3. Запустите локальный Supabase
```bash
supabase start
```

После запуска вы получите вывод с конфигурацией:
```
API URL: http://127.0.0.1:54321
anon key: eyJhbGc...
service_role key: eyJhbGc...
```

### 4. Настройте переменные окружения
Скопируйте `.env.example` в `.env`:
```bash
cp .env.example .env
```

Откройте `.env` и добавьте значения из вывода `supabase start`:
```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key-from-supabase-start
```

### 5. Запустите приложение
```bash
npm run dev
# или
bun dev
```

Приложение будет доступно по адресу: http://localhost:5173

## Настройка Google OAuth (опционально)

Для включения входа через Google:

### 1. Создайте OAuth приложение в Google Cloud Console
1. Перейдите на https://console.cloud.google.com/
2. Создайте новый проект или выберите существующий
3. Включите Google+ API
4. Перейдите в "APIs & Services" > "Credentials"
5. Создайте "OAuth 2.0 Client ID"
6. Добавьте авторизованные redirect URIs:
   - `http://127.0.0.1:54321/auth/v1/callback`
   - `http://localhost:5173/auth`

### 2. Настройте Supabase
Откройте `supabase/config.toml` и обновите секцию Google OAuth:
```toml
[auth.external.google]
enabled = true
client_id = "your-client-id.apps.googleusercontent.com"
secret = "your-client-secret"
```

### 3. Перезапустите Supabase
```bash
supabase stop
supabase start
```

## Доступные команды

```bash
# Разработка
npm run dev

# Сборка для продакшена
npm run build

# Предпросмотр продакшен сборки
npm run preview

# Тесты
npm run test

# Линтинг
npm run lint

# Supabase команды
supabase start       # Запустить локальный Supabase
supabase stop        # Остановить локальный Supabase
supabase status      # Проверить статус
supabase db reset    # Сбросить базу данных
```

## Структура базы данных

### Таблицы
- `profiles` - профили пользователей (имя, аватар, группа)
- `user_roles` - роли пользователей (student/teacher)

### RLS (Row Level Security)
- Пользователи могут видеть все профили
- Пользователи могут редактировать только свой профиль
- Учителя имеют доступ к просмотру всех ролей

## Автоматическое создание профиля
При регистрации нового пользователя автоматически:
1. Создается профиль в таблице `profiles`
2. Присваивается роль "student" в таблице `user_roles`

## Суть проекта
Платформа позволяет:
- Регистрация и вход через email/пароль или Google
- Прохождение диагностических тестов
- Просмотр результатов и рекомендаций
- Для учителей: просмотр результатов учеников через дашборд

## Лицензия
MIT
