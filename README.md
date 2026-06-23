# bun-http-express

A lightweight Express-like HTTP framework for [Bun](https://bun.sh/). Familiar API, Bun-native performance.

## Features

- **Express-style API** — `app.get()`, `app.post()`, `app.use()`, middleware chain
- **Parametric routing** — `/users/:id` with auto-parsed params
- **Built-in body parsing** — JSON, form-data, multipart (file upload)
- **Cookie support** — `res.cookie()`, `res.clearCookie()`
- **Static file serving** — `app.use(App.static('./public'))`
- **Template rendering** — EJS out of the box, pluggable view engine
- **Sub-router support** — `app.use('/api', apiRouter)`
- **Hot reload friendly** — `replaceRoutes()` for swapping routers without restart
- **TypeScript first** — full type definitions included

## Installation

```bash
bun add bun-http-express
```

## Quick Start

```ts
import { App, Router } from 'bun-http-express';

const app = new App();

// Logger middleware
app.use(async (req, res, next) => {
  const start = Date.now();
  await next();
  console.log(`${req.method} ${req.path} → ${res._status} (${Date.now() - start}ms)`);
});

// Basic routes
app.get('/', (req, res) => {
  res.json({ message: 'Hello from bun-http-express!' });
});

app.get('/hello/:name', (req, res) => {
  res.send(`Hello, ${req.params.name}!`);
});

// JSON POST
app.post('/api/echo', (req, res) => {
  res.json({ echo: req.body });
});

// Cookie
app.get('/set-cookie', (req, res) => {
  res.cookie('session', 'abc123', { maxAge: 3600, httpOnly: true });
  res.json({ message: 'Cookie set' });
});

// Static files
app.use(App.static('./public'));

// Start server
app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
```

## Routing

### Basic Routes

```ts
app.get('/users', handler);
app.post('/users', handler);
app.put('/users/:id', handler);
app.delete('/users/:id', handler);
```

### Sub-Router

```ts
const api = new Router();
api.get('/users', getUsers);
api.get('/users/:id', getUserById);
api.post('/users', createUser);

app.use('/api/v1', api);
// GET /api/v1/users → api.get('/users')
```

## Middleware

```ts
// Global middleware
app.use(async (req, res, next) => {
  req.user = await authenticate(req);
  await next();
});

// Path-scoped middleware
app.use('/admin', adminAuth);

// Multiple middleware
app.use(corsMiddleware, loggerMiddleware, bodyParser);
```

## File Upload

```ts
import { UploadHandler } from 'bun-http-express';

const upload = new UploadHandler({ dest: './uploads' });

app.post('/upload', upload.single('file'), (req, res) => {
  if (req.file) {
    res.json({ filename: req.file.filename, size: req.file.size });
  }
});
```

## Cookie

```ts
// Set cookie
res.cookie('token', 'xyz', {
  maxAge: 3600,     // seconds
  httpOnly: true,
  secure: true,
  path: '/',
});

// Clear cookie
res.clearCookie('token');
```

## Template Rendering

### EJS (Default)

```ts
app.get('/page', (req, res) => {
  res.render('index', { title: 'Home', user: { name: 'Alice' } });
});
// Renders views/index.ejs
```

## API Reference

### App

| Method | Description |
|---|---|
| `app.get(path, ...handlers)` | Register GET route |
| `app.post(path, ...handlers)` | Register POST route |
| `app.put(path, ...handlers)` | Register PUT route |
| `app.delete(path, ...handlers)` | Register DELETE route |
| `app.use(...args)` | Register middleware (with optional prefix) |
| `app.set(key, value)` | Application settings |
| `app.get(key)` | Read application setting |
| `app.setRoutes(router)` | Register a Router instance |
| `app.replaceRoutes(router)` | Swap router for hot reload |
| `App.static(dir)` | Static file middleware |
| `app.listen(port, cb)` | Start server |

### ExtendedRequest

| Property | Type | Description |
|---|---|---|
| `req.method` | `string` | HTTP method |
| `req.path` | `string` | URL pathname |
| `req.query` | `object` | Parsed query params |
| `req.body` | `object` | Parsed request body |
| `req.params` | `object` | Route params (`:id`) |
| `req.cookies` | `object` | Parsed cookies |
| `req.file` | `UploadedFile \| null` | Uploaded file info |
| `req.headers` | `Headers` | Request headers |

### ExtendedResponse

| Method | Description |
|---|---|
| `res.status(code)` | Set HTTP status |
| `res.send(data)` | Send text/HTML response |
| `res.json(data)` | Send JSON response |
| `res.redirect(url, status?)` | Redirect to URL |
| `res.cookie(name, value, options?)` | Set cookie |
| `res.clearCookie(name)` | Remove cookie |
| `res.render(view, data?)` | Render template |
| `res.type(contentType)` | Set Content-Type |

## License

MIT
