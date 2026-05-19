# Auth Service

Centralized **authentication and identity** microservice for Node.js backends. It owns user credentials, JWT issuance, refresh rotation, Redis-backed session state, and RBAC primitives. It intentionally excludes product or domain logic (payments, bookings, notifications, and so on).

---

## Table of contents

1. [What is done in this repo](#what-is-done-in-this-repo)
2. [High-level architecture](#high-level-architecture)
3. [Layered design and data flow](#layered-design-and-data-flow)
4. [DTO layer](#dto-layer)
5. [Project structure (every folder)](#project-structure-every-folder)
6. [File-by-file reference](#file-by-file-reference)
7. [Main classes and methods](#main-classes-and-methods)
8. [Middleware chain](#middleware-chain)
9. [Authentication and tokens](#authentication-and-tokens)
10. [RBAC](#rbac)
11. [Redis key reference](#redis-key-reference)
12. [Configuration and environment](#configuration-and-environment)
13. [Docker](#docker)
14. [Testing](#testing)
15. [API quick reference](#api-quick-reference)
16. [Scalability and security notes](#scalability-and-security-notes)
17. [License](#license)

---

## What is done in this repo

| Area | Status |
|------|--------|
| Express app, health route, auth routes | Done |
| MongoDB user model + repository | Done |
| Redis client + token store (refresh cache, blacklist) | Done |
| MongoDB `refresh_sessions` (source of truth) + write-through Redis | Done |
| Logout all, change/reset password, session list/revoke | Done |
| JWT access + refresh, rotation | Done |
| Auth service (register, login, refresh, logout, me, validate) | Done |
| Zod validators + validate middleware | Done |
| Auth / authorize / permissions / rate limit / logger / errors | Done |
| **DTOs** for HTTP response shaping | Done |
| Controllers use DTOs + `ApiResponseDto` envelope | Done |
| Docker + docker-compose + `.dockerignore` | Done |
| Jest + Supertest integration tests | Done |
| OpenAPI spec (`docs/openapi.yaml`) | Done |

---

## High-level architecture

```
Clients / other microservices
        │  HTTPS
        ▼
   API Gateway (optional)
        │
        ▼
  ┌─────────────┐     ┌──────────┐
  │ Auth Service│────▶│  Redis   │  refresh slots, blacklist, rate limits
  └──────┬──────┘     └──────────┘
         │
         ▼
   ┌──────────┐
   │ MongoDB  │  users, roles, tokenVersion
   └──────────┘
```

Layers (top to bottom):

1. **Routes** — URL paths, HTTP verbs, which middleware runs first.
2. **Controllers** — Parse validated input, call **services**, map results through **DTOs**, send JSON.
3. **DTOs** — Stable **public API shapes**; prevent leaking internal fields or accidental extra properties.
4. **Services** — Business rules (who can log in, how refresh rotates, when to blacklist).
5. **Repositories** — Database reads/writes only (Mongoose queries).
6. **Models** — Schema, indexes, instance methods (e.g. `comparePassword`, `toSafeJSON`).
7. **Cache / auth helpers** — Redis token helpers, JWT sign/verify.

---

## Layered design and data flow

### Example: `POST /api/v1/auth/register`

1. **Express** receives JSON body.
2. **`httpLogger`** (pino-http) logs request metadata.
3. **`createAuthLimiter()`** rate-limits the route (Redis-backed outside `NODE_ENV=test`).
4. **`validateRequest(registerSchema)`** runs **Zod** on `req.body`; on success sets `req.validated`.
5. **`auth.controller.register`** runs inside **`asyncHandler`** (promises forwarded to error middleware).
6. **`AuthService.register`** sanitizes strings, checks duplicate email via **`UserRepository`**, **`User.create`** (Mongoose pre-save hashes password), **`issueAuthTokens`** writes Redis refresh slot and returns plain object.
7. Controller maps service result with **`AuthSessionDto.fromService`** → **`ApiResponseDto.success(...)`** → `res.status(201).json(...)`.

### Example: `GET /api/v1/auth/me`

1. **`authenticate()`** reads `Authorization: Bearer`, verifies JWT, checks Redis blacklist, loads user from DB, compares `tokenVersion`, sets **`req.auth`**.
2. Controller calls **`AuthService.me`**, wraps with **`MeResponseDto`**, then **`ApiResponseDto.success`**.

Errors anywhere in async code bubble to **`errorMiddleware`**, which returns `{ success: false, error: { message, details? } }`.

---

## DTO layer

**Purpose:** Controllers should not hand-craft response objects spread from services. DTOs define the **exact contract** returned to HTTP clients: which fields exist, consistent naming, and no accidental inclusion of secrets or Mongoose internals.

All DTOs are **plain JavaScript classes** with **static factory methods** (no instances required). They return **plain objects** suitable for `res.json()`.

| DTO | File | Role |
|-----|------|------|
| **`ApiResponseDto`** | `src/dtos/api-response.dto.js` | `ApiResponseDto.success(data)` → `{ success: true, data }` |
| **`UserDto`** | `src/dtos/user.dto.js` | `UserDto.fromEntity(user)` — public user fields only |
| **`TokenPairDto`** | `src/dtos/token-pair.dto.js` | `TokenPairDto.fromIssueResult(raw)` — access, refresh, `tokenType`, `expiresIn` |
| **`AuthSessionDto`** | `src/dtos/auth-session.dto.js` | Register/login: user + token pair |
| **`TokenRefreshResponseDto`** | `src/dtos/token-refresh.dto.js` | Refresh endpoint: tokens only |
| **`LogoutResponseDto`** | `src/dtos/logout-response.dto.js` | `{ success: true }` from service |
| **`MeResponseDto`** | `src/dtos/me-response.dto.js` | `{ user: UserDto... }` |
| **`ValidateTokenResponseDto`** | `src/dtos/validate-token-response.dto.js` | Introspection payload (`valid`, `sub`, `roles`, etc.) |

Barrel export: **`src/dtos/index.js`**.

---

## Project structure (every folder)

```
src/
├── config/           # Environment loading and validation (Zod)
├── constants/        # HTTP codes, Redis key builders, roles/permissions map
├── controllers/      # HTTP handlers (thin)
├── services/         # Auth business logic
├── repositories/     # MongoDB access for User
├── models/           # Mongoose schemas
├── routes/           # Express routers
├── middlewares/      # Cross-cutting HTTP concerns
├── validators/       # Zod schemas for request bodies
├── utils/            # ApiError, asyncHandler, sanitize, crypto helpers
├── cache/            # Redis client + token.store
├── auth/             # JWT sign/verify helpers
├── db/               # Mongoose connect/disconnect
├── dtos/             # Response DTOs + ApiResponseDto
├── tests/            # Jest + Supertest + mongo test helper
├── app.js            # Express factory (no listen)
└── server.js         # Boot: dotenv, DB, Redis, listen
```

---

## File-by-file reference

### Entry and app shell

| File | Responsibility |
|------|----------------|
| **`src/server.js`** | Loads `dotenv`, connects Mongo (`connectMongo`), initializes Redis (`getRedis`), creates app via **`createApp()`**, listens on `PORT`, handles SIGINT/SIGTERM shutdown. |
| **`src/app.js`** | **`createApp()`**: Helmet, CORS, `express.json`, `cookie-parser`, **`httpLogger`**, mounts **`/health`**, **`/api/v1/auth`**, **`/api/v1`** (RBAC demo route), 404 → **`ApiError`**, **`errorMiddleware`**. |

### Config

| File | Responsibility |
|------|----------------|
| **`src/config/index.js`** | `require('dotenv').config()`, exports **`loadEnv()`** result as `env` (see `env.js`). |
| **`src/config/env.js`** | **`loadEnv()`** parses **`process.env`** with **Zod** (secrets min length, URIs, bcrypt rounds). Throws if invalid so the process fails fast at boot. |

### Constants

| File | Responsibility |
|------|----------------|
| **`src/constants/http.js`** | Numeric HTTP status constants used by **`ApiError`** and controllers. |
| **`src/constants/roles.js`** | **`ROLES`**, **`DEFAULT_ROLE`**, **`ROLE_PERMISSIONS`** map for permission middleware. |
| **`src/constants/redisKeys.js`** | Key prefix helpers: `refreshTokenKey`, `accessBlacklistKey`, `sessionKey`, `userSessionsSet`. |

### Utils

| File | Responsibility |
|------|----------------|
| **`src/utils/ApiError.js`** | **`ApiError`** class: `statusCode`, `message`, `details`. Static factories: `badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `tooMany`, `internal`. |
| **`src/utils/asyncHandler.js`** | **`asyncHandler(fn)`** wraps async route handlers so rejected promises call **`next(err)`**. |
| **`src/utils/sanitize.js`** | **`sanitizeString`**, **`sanitizeObjectStrings`** — trim, strip `\0` on auth payloads. |
| **`src/utils/cryptoRandom.js`** | **`randomUrlSafeBytes`**, **`sha256Hex`** (used if you extend opaque tokens). |

### Database

| File | Responsibility |
|------|----------------|
| **`src/db/mongoose.js`** | **`connectMongo()`** uses **`process.env.MONGODB_URI || env.MONGODB_URI`** (tests can override). **`disconnectMongo()`**. |

### Models

| File | Responsibility |
|------|----------------|
| **`src/models/user.model.js`** | **Mongoose** schema: `name`, `email`, `password` (+select false), `roles`, `isActive`, `tokenVersion`, timestamps. **`unique: true`** on email. **pre('save')** bcrypt hash when password modified. Methods: **`comparePassword`**, **`toSafeJSON`**. |

### Repositories

| File | Responsibility |
|------|----------------|
| **`src/repositories/user.repository.js`** | **`UserRepository`** class: **`create`**, **`findByEmail`**, **`findById`** (options `withPassword`), **`incrementTokenVersion`**, **`updateRoles`**. No business rules. |

### Services

| File | Responsibility |
|------|----------------|
| **`src/services/auth.service.js`** | **`AuthService`** class (constructor accepts optional **`UserRepository`** for tests). Methods below. |

### Auth (JWT)

| File | Responsibility |
|------|----------------|
| **`src/auth/jwt.js`** | **`signAccessToken`**, **`signRefreshToken`**, **`verifyAccessToken`**, **`verifyRefreshToken`**, **`decodeTokenUnsafe`**, **`accessTtlSecondsFromToken`**, **`refreshTtlSecondsFromToken`**, constants **`ACCESS_TYP`**, **`REFRESH_TYP`**. |

### Cache

| File | Responsibility |
|------|----------------|
| **`src/cache/redis.client.js`** | Singleton **`getRedis()`** (ioredis), **`createRedisClient`**, **`setRedisClientForTests`**, **`disconnectRedis`**. |
| **`src/cache/token.store.js`** | **`setRefreshSession`**, **`consumeRefreshSession`** (Redis **`GETDEL`**), **`isFamilyRevoked`**, **`revokeRefreshFamily`**, **`blacklistAccessToken`**, **`isAccessTokenBlacklisted`**, session helpers **`registerSession`**, **`deleteSession`**, **`clearUserSessions`**. |

### Controllers and routes

| File | Responsibility |
|------|----------------|
| **`src/controllers/auth.controller.js`** | **`register`**, **`login`**, **`refresh`**, **`logout`**, **`me`**, **`validate`** — each uses **`AuthService`** + DTOs + **`ApiResponseDto.success`**. |
| **`src/routes/auth.routes.js`** | Mounts auth paths under **`/api/v1/auth`**, wires limiter, **`validateRequest`**, **`authenticate`** where needed. |
| **`src/routes/health.routes.js`** | **`GET /health`**. |
| **`src/routes/rbac.routes.js`** | Example **`GET /api/v1/admin/ping`** with **`authenticate()`** + **`authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN)`**. |

### Middlewares

| File | Responsibility |
|------|----------------|
| **`src/middlewares/validate.middleware.js`** | **`validateRequest(schema)`** — Zod safeParse on body/query/params → **`req.validated`** or **`ApiError.badRequest`**. |
| **`src/middlewares/authenticate.middleware.js`** | **`extractBearerToken(req)`**, **`authenticate()`** — JWT verify, blacklist, DB user + `tokenVersion`, sets **`req.auth`**. |
| **`src/middlewares/authorize.middleware.js`** | **`authorize(...allowedRoles)`** — requires **`req.auth.roles`** to intersect allowed list. |
| **`src/middlewares/permissions.middleware.js`** | **`requirePermission(...perms)`** uses **`ROLE_PERMISSIONS`**. **`userHasPermission`** helper. |
| **`src/middlewares/logger.js`** | **pino** root logger instance. |
| **`src/middlewares/httpLogger.middleware.js`** | **pino-http** middleware. |
| **`src/middlewares/error.middleware.js`** | Central error handler: **`ApiError`** status, Mongo duplicate key **11000** → 409, 5xx logs. |
| **`src/middlewares/rateLimit.middleware.js`** | **`createAuthLimiter()`** — in test, in-memory limiter; else **`rate-limit-redis`** + **`getRedis`**. |

### Validators

| File | Responsibility |
|------|----------------|
| **`src/validators/auth.validators.js`** | Zod objects: **`registerSchema`**, **`loginSchema`**, **`refreshSchema`**, **`logoutSchema`**, **`validateSchema`**. |

### DTOs

| File | Responsibility |
|------|----------------|
| **`src/dtos/index.js`** | Re-exports all DTO modules. |
| Other `src/dtos/*.dto.js` | See [DTO layer](#dto-layer). |

### Tests

| File | Responsibility |
|------|----------------|
| **`src/tests/setup.js`** | Test **`process.env`**, **ioredis-mock** via **`setRedisClientForTests`**. |
| **`src/tests/mongoTestHelper.js`** | **`startTestMongo()`** — prefers **`TEST_MONGODB_URI`**, else **MongoMemoryServer** with **`launchTimeout`**, optional **`MONGOMS_SYSTEM_BINARY`**. |
| **`src/tests/auth.integration.test.js`** | End-to-end HTTP tests against **`createApp()`**. |

---

## Main classes and methods

### `AuthService` (`src/services/auth.service.js`)

| Method | What it does |
|--------|----------------|
| **`register({ name, email, password })`** | Sanitize, conflict check, **`users.create`**, **`issueAuthTokens`**, returns `{ user: toSafeJSON(), ...tokens }`. |
| **`login({ email, password })`** | Sanitize, load user with password, **`comparePassword`**, inactive → 401, **`issueAuthTokens`**. |
| **`refresh({ refreshToken })`** | Verify refresh JWT, check family revoked, **`consumeRefreshSession`** (replay if missing), load user, match **`tokenVersion`**, **`issueAuthTokens`** with same **`familyId`**. |
| **`logout({ accessToken, refreshToken })`** | Delete refresh Redis key if valid JWT; blacklist access **`jti`** for remaining TTL. |
| **`me(userId)`** | Load user, **`toSafeJSON()`**. |
| **`validateAccessToken(accessToken)`** | Verify access JWT, blacklist, user active, **`tokenVersion`**, return introspection object. |
| **`issueAuthTokens(user, { familyId })`** (internal) | New UUID family if needed, sign tokens, **`setRefreshSession`** with TTL from refresh JWT. |
| **`revokeAllSessions(userId)`** | **`incrementTokenVersion`** — for future admin APIs. |

### `UserRepository` (`src/repositories/user.repository.js`)

| Method | What it does |
|--------|----------------|
| **`create(data)`** | **`User.create(data)`** |
| **`findByEmail(email, { withPassword })`** | **`User.findOne`**, optional **`+password`**. |
| **`findById(id, { withPassword })`** | **`User.findById`**. |
| **`incrementTokenVersion(userId)`** | **`$inc: { tokenVersion: 1 }`**. |
| **`updateRoles(userId, roles)`** | Replace roles array. |

### User model (Mongoose document methods)

| Method | What it does |
|--------|----------------|
| **`comparePassword(candidate)`** | **`bcrypt.compare`** against stored hash. |
| **`toSafeJSON()`** | Plain object without password for API/DTO input. |

---

## Middleware chain

Typical order for **`POST /api/v1/auth/register`**:

1. Helmet  
2. CORS  
3. `express.json`  
4. `cookie-parser`  
5. `httpLogger`  
6. **Rate limiter**  
7. **`validateRequest`**  
8. **Controller**

For **`GET /api/v1/auth/me`**:

… same global stack, then **`authenticate()`** before the controller.

---

## Authentication and tokens

- **Access JWT**: HS256, short TTL (`JWT_ACCESS_EXPIRES_IN`), claims include `sub`, `roles`, `tv` (tokenVersion), `jti`, `typ: "access"`.
- **Refresh JWT**: separate secret, longer TTL, `jti`, `fam` (family), `tv`, `typ: "refresh"`.
- **Redis** key **`rt:{jti}`** must exist; refresh uses **`GETDEL`** so each refresh token is one-time (rotation + replay detection).
- **Logout** blacklists access **`jti`** in **`abl:{jti}`** until access expiry.

---

## RBAC

- Roles: **`user`**, **`seller`**, **`admin`**, **`super-admin`** (`src/constants/roles.js`).
- **`authenticate()`** loads roles from DB after JWT verification (aligned with `tokenVersion`).
- **`authorize('admin', 'super-admin')`** — role names.
- **`requirePermission('users:read')`** — uses **`ROLE_PERMISSIONS`**.

---

## Refresh session storage (Mongo + Redis)

| Layer | Role |
|-------|------|
| **MongoDB `refresh_sessions`** | Source of truth: `jti`, `userId`, `familyId`, `tokenHash`, `deviceInfo`, `expiresAt`, `revoked` |
| **Redis `rt:{jti}`** | Fast cache; Mongo fallback on miss during refresh |

**Write-through:** login/register/refresh → Mongo then Redis.  
**Logout-all / change-password / reset-password:** revoke all Mongo rows, clear Redis, bump `tokenVersion`.

---

## Redis key reference

| Pattern | Use |
|---------|-----|
| `rt:{jti}` | Refresh session cache |
| `abl:{jti}` | Access blacklist |
| `sess:{id}` | Optional session blob |
| `usess:{userId}` | Set of session ids |
| `rl:auth:*` | Rate limit keys |
| `rfam:revoked:{familyId}` | Family-level revoke flag |

---

## Configuration and environment

Copy **`.env.example`** → **`.env`**. Critical variables:

- **`JWT_ACCESS_SECRET`**, **`JWT_REFRESH_SECRET`** — minimum 32 characters (enforced by Zod).
- **`MONGODB_URI`**, **`REDIS_URL`**
- **`JWT_ACCESS_EXPIRES_IN`**, **`JWT_REFRESH_EXPIRES_IN`**
- **`BCRYPT_SALT_ROUNDS`**, **`CORS_ORIGIN`**, **`LOG_LEVEL`**

Testing overrides: **`TEST_MONGODB_URI`**, **`MONGOMS_SYSTEM_BINARY`** (see [Testing](#testing)).

---

## Docker

1. `cp .env.example .env` — set strong JWT secrets.  
2. `docker compose up --build`  

Compose sets **`MONGODB_URI`** / **`REDIS_URL`** for in-network hosts; JWT values come from **`.env`**.

---

## Testing

- **`npm test`** — Jest + Supertest + **ioredis-mock** (16 tests: auth flows, sessions, passwords, health, RBAC).  
- **`npm run test:e2e`** — smoke test against Docker (`scripts/docker-e2e.sh`; run `docker compose up -d` first).  
- Mongo: **`TEST_MONGODB_URI`** for a real Mongo (sandboxes), or **mongodb-memory-server** by default; optional **`MONGOMS_SYSTEM_BINARY`**.  
- See **`src/tests/mongoTestHelper.js`**.

---

## API quick reference

| Method | Path | Auth | Description |
|--------|------|------|---------------|
| POST | `/api/v1/auth/register` | No | Register + tokens |
| POST | `/api/v1/auth/login` | No | Login + tokens |
| POST | `/api/v1/auth/refresh` | No | Rotate refresh |
| POST | `/api/v1/auth/logout` | Bearer | Logout (this device) |
| POST | `/api/v1/auth/logout-all` | Bearer | Logout all devices |
| POST | `/api/v1/auth/change-password` | Bearer | Change password + revoke sessions |
| POST | `/api/v1/auth/forgot-password` | No | Request reset (`resetToken` in dev only) |
| POST | `/api/v1/auth/reset-password` | No | Reset password with token |
| GET | `/api/v1/auth/sessions` | Bearer | List active sessions |
| DELETE | `/api/v1/auth/sessions/:jti` | Bearer | Revoke one session |
| GET | `/api/v1/auth/me` | Bearer | Profile |
| POST | `/api/v1/auth/validate` | No | Introspect token |
| GET | `/health` | No | Liveness |

Full OpenAPI: **`docs/openapi.yaml`**.

---

## Scalability and security notes

- Stateless access tokens scale horizontally; Redis is the shared state for refresh and blacklist.
- Prefer **Redis 6.2+** for **`GETDEL`**.
- **`npm audit`** may report dependency advisories; plan upgrades separately.
- For many verifiers, consider **RS256 + JWKS** instead of sharing HS256 secrets.

---

## License

MIT (adjust as needed for your organization).
