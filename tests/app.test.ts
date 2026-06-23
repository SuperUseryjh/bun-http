import { describe, expect, test } from 'bun:test';
import { App, Router, UploadHandler } from '../src/index';

describe('Router', () => {
    test('should match simple routes', () => {
        const router = new Router();
        let called = false;
        router.get('/hello', (req, res) => {
            called = true;
        });
        const match = router._match('GET', '/hello');
        expect(match).not.toBeNull();
        expect(match?.handlers).toHaveLength(1);
    });

    test('should match parametric routes', () => {
        const router = new Router();
        router.get('/users/:id', (req, res) => {});
        const match = router._match('GET', '/users/123');
        expect(match).not.toBeNull();
        expect(match?.params['id']).toBe('123');
    });

    test('should not match wrong method', () => {
        const router = new Router();
        router.get('/hello', (req, res) => {});
        const match = router._match('POST', '/hello');
        expect(match).toBeNull();
    });

    test('clearRoutes should remove all routes', () => {
        const router = new Router();
        router.get('/a', (req, res) => {});
        router.post('/b', (req, res) => {});
        router.clearRoutes();
        expect(router._routes).toHaveLength(0);
        expect(router._middleware).toHaveLength(0);
        expect(router._subRouters).toHaveLength(0);
    });
});

describe('App', () => {
    test('set and get settings', () => {
        const app = new App();
        app.set('view engine', 'ejs');
        expect(app.get('view engine')).toBe('ejs');
    });

    test('should handle 404 for unmatched routes', async () => {
        const app = new App();
        const response = await (app as any)._handleRequest(
            new Request('http://localhost/nonexistent')
        );
        expect(response.status).toBe(404);
    });

    test('should return JSON response', async () => {
        const app = new App();
        app.get('/json', (req, res) => {
            res.json({ hello: 'world' });
        });
        const response = await (app as any)._handleRequest(
            new Request('http://localhost/json')
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toEqual({ hello: 'world' });
    });

    test('should parse query parameters', async () => {
        const app = new App();
        app.get('/search', (req, res) => {
            res.json({ query: req.query });
        });
        const response = await (app as any)._handleRequest(
            new Request('http://localhost/search?q=test&page=2')
        );
        const body = await response.json();
        expect(body.query).toEqual({ q: 'test', page: '2' });
    });

    test('should parse JSON body', async () => {
        const app = new App();
        app.post('/data', (req, res) => {
            res.json({ received: req.body });
        });
        const response = await (app as any)._handleRequest(
            new Request('http://localhost/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'test' }),
            })
        );
        const body = await response.json();
        expect(body.received).toEqual({ name: 'test' });
    });

    test('should set cookie', async () => {
        const app = new App();
        app.get('/cookie', (req, res) => {
            res.cookie('session', 'abc', { httpOnly: true });
            res.send('ok');
        });
        const response = await (app as any)._handleRequest(
            new Request('http://localhost/cookie')
        );
        const setCookie = response.headers.get('set-cookie');
        expect(setCookie).toContain('session=abc');
        expect(setCookie).toContain('HttpOnly');
    });
});

describe('App with Router', () => {
    test('should route through sub-router', async () => {
        const app = new App();
        const router = new Router();
        router.get('/api/test', (req, res) => {
            res.json({ api: true });
        });
        app.use(router);
        const response = await (app as any)._handleRequest(
            new Request('http://localhost/api/test')
        );
        const body = await response.json();
        expect(body).toEqual({ api: true });
    });

    test('should respect prefix', async () => {
        const app = new App();
        const router = new Router();
        router.get('/users', (req, res) => {
            res.json({ users: [] });
        });
        app.use('/v1', router);
        const response = await (app as any)._handleRequest(
            new Request('http://localhost/v1/users')
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toEqual({ users: [] });
    });
});
