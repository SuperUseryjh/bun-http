import path from 'path';
import fs from 'fs';
import ejs from 'ejs';
import { Router } from './router';
import type {
    RouteHandler,
    MiddlewareEntry,
    ExtendedRequest,
    ExtendedResponse,
    SetCookieOptions,
    RequestParams,
    ViewEngine,
} from './types';

// ============================================================
// App — Application Main Class (wraps Bun.serve)
// ============================================================

export class App {
    _middleware: MiddlewareEntry[] = [];
    _settings: Record<string, any> = {};
    _viewsDir: string = path.join(process.cwd(), 'views');
    _viewCache: Record<string, ejs.TemplateFunction> = {};
    _pluginManager: any = null;
    _server: any = null;
    _router: Router = new Router();
    /** Reference to the routes Router entry, used for hot reload replacement */
    private _routesEntry: MiddlewareEntry | null = null;
    /** Registered view engines */
    _viewEngines: ViewEngine[] = [];

    /**
     * Register a custom view engine.
     * @param engine ViewEngine object with extensions and render function
     * @example
     * app.use({ extensions: ['.tsx', '.jsx'], render: async (path, data) => { ... } });
     */
    use(engine: ViewEngine): void;
    use(prefix: string, handler: Router | RouteHandler): void;
    use(handler: Router | RouteHandler): void;
    use(...args: any[]): void {
        if (args.length === 1) {
            const arg = args[0];
            // Check if it's a ViewEngine (has extensions + render)
            if (arg && Array.isArray(arg.extensions) && typeof arg.render === 'function') {
                this._viewEngines.push(arg);
                return;
            }
            // Otherwise it's a Router or RouteHandler
            if (arg instanceof Router || typeof arg === 'function') {
                this._middleware.push({ prefix: '/', handler: arg, isRouter: arg instanceof Router });
            }
        } else if (args.length === 2) {
            this._middleware.push({ prefix: args[0], handler: args[1], isRouter: args[1] instanceof Router });
        }
    }

    set(key: string, value: any): void { this._settings[key] = value; }

    /** Setting read (1 arg) or HTTP route registration (≥2 args) */
    get(key: string, ...handlers: RouteHandler[]): any {
        if (handlers.length > 0) {
            this._router.get(key, ...handlers);
            return;
        }
        return this._settings[key];
    }

    post(path: string, ...handlers: RouteHandler[]): void { this._router.post(path, ...handlers); }
    put(path: string, ...handlers: RouteHandler[]): void { this._router.put(path, ...handlers); }
    delete(path: string, ...handlers: RouteHandler[]): void { this._router.delete(path, ...handlers); }

    /** Register Router and store reference for hot reload replacement */
    setRoutes(router: Router): void {
        const entry: MiddlewareEntry = { prefix: '/', handler: router, isRouter: true };
        this._middleware.push(entry);
        this._routesEntry = entry;
    }

    /** Replace Router (without restarting server), used for hot reload */
    replaceRoutes(router: Router): void {
        if (this._routesEntry) {
            this._routesEntry.handler = router;
        }
    }

    static(dir: string): RouteHandler {
        const dirPath = path.resolve(dir);
        return async (req: ExtendedRequest, res: ExtendedResponse, next: () => Promise<void>) => {
            const filePath = path.join(dirPath, '.' + req.path);
            
            // Prevent directory traversal
            const relative = path.relative(dirPath, filePath);
            const isSafe = relative && !relative.startsWith('..') && !path.isAbsolute(relative);
            
            if (isSafe && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                const ext = path.extname(filePath).toLowerCase();
                const mimeMap: Record<string, string> = {
                    '.css': 'text/css', '.js': 'application/javascript', '.html': 'text/html',
                    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
                    '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
                    '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff',
                    '.ttf': 'font/ttf', '.eot': 'application/vnd.ms-fontobject',
                };
                const file = Bun.file(filePath);
                res._status = 200;
                res._headers['Content-Type'] = mimeMap[ext] || 'application/octet-stream';
                res._body = file;
                res._sent = true;
                return;
            }
            await next();
        };
    }

    async renderView(viewName: string, data: Record<string, any>): Promise<string> {
        // Resolve full view path, trying all known extensions
        const { viewPath, ext } = this._resolveViewPath(viewName);
        if (!viewPath) {
            throw new Error(`View not found: ${viewName}`);
        }

        // Check custom engine registry first
        if (ext) {
            for (const engine of this._viewEngines) {
                const normalizedExts = engine.extensions.map(e => e.startsWith('.') ? e : `.${e}`);
                if (normalizedExts.includes(ext)) {
                    return engine.render(viewPath, data);
                }
            }
        }

        // Fallback to default EJS engine
        const content = fs.readFileSync(viewPath, 'utf-8');
        const template = ejs.compile(content, { filename: viewPath });
        return template(data);
    }

    private _resolveViewPath(viewName: string): { viewPath: string | null; ext: string | null } {
        // If viewName already has extension
        const knownExts = ['.ejs', '.jsx', '.tsx', '.js', '.ts', '.pug', '.hbs'];
        const nameExt = knownExts.find(ext => viewName.endsWith(ext));
        if (nameExt) {
            const fullPath = path.join(this._viewsDir, viewName);
            if (fs.existsSync(fullPath)) return { viewPath: fullPath, ext: nameExt };
            return { viewPath: null, ext: nameExt };
        }

        // Collect all registered custom extensions, then try .ejs
        const customExts = this._viewEngines.flatMap(e => e.extensions.map(ext => ext.startsWith('.') ? ext : `.${ext}`));
        const tryExts = [...new Set(customExts), '.ejs'];
        for (const ext of tryExts) {
            const fullPath = path.join(this._viewsDir, viewName + ext);
            if (fs.existsSync(fullPath)) return { viewPath: fullPath, ext };
        }

        return { viewPath: null, ext: null };
    }

    listen(port: number, callback?: () => void): any {
        this._server = Bun.serve({
            port,
            fetch: (req: Request) => this._handleRequest(req),
        });
        if (callback) callback();
        return this._server;
    }

    private async _handleRequest(request: Request): Promise<Response> {
        const url = new URL(request.url);
        const method = request.method.toUpperCase();
        const pathname = url.pathname;

        // ---- Parse Request Body ----
        let body: Record<string, any> = {};
        const files: Record<string, File> = {};
        const contentType = request.headers.get('content-type') || '';

        if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
            try {
                if (contentType.includes('application/json')) {
                    body = await request.json();
                } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
                    const formData = await request.formData();
                    for (const [key, value] of formData) {
                        if (value instanceof File) {
                            files[key] = value;
                        } else {
                            body[key] = value;
                        }
                    }
                }
            } catch (_) { /* Ignore malformed JSON */
                body = {};
            }
        }

        // ---- Parse Cookies ----
        const cookies: Record<string, string> = {};
        const cookieHeader = request.headers.get('cookie');
        if (cookieHeader) {
            cookieHeader.split(';').forEach(c => {
                const eqIdx = c.indexOf('=');
                if (eqIdx > 0) {
                    const name = c.substring(0, eqIdx).trim();
                    const value = c.substring(eqIdx + 1).trim();
                    cookies[name] = value;
                }
            });
        }

        // ---- Build req object ----
        const req: ExtendedRequest = {
            method,
            path: pathname,
            url: request.url,
            query: Object.fromEntries(url.searchParams),
            body,
            cookies,
            headers: request.headers,
            params: {},
            user: null,
            app: this,
            file: null,
            _files: files,
            _raw: request,
        };

        // ---- Build res object ----
        let handlerIndex = 0;
        const handlers: RouteHandler[] = [];

        const res: ExtendedResponse = {
            _status: 200,
            _headers: {},
            _body: null,
            _redirectUrl: null,
            _cookies: [],
            _sent: false,
            _locals: {},

            get locals() { return this._locals; },
            set locals(v) { this._locals = v; },

            status(code: number) { this._status = code; return this; },

            send(data: any) {
                if (this._sent) return;
                this._sent = true;
                if (typeof data === 'object' && data !== null && !(data instanceof Blob)) {
                    this._body = JSON.stringify(data);
                    this._headers['Content-Type'] = 'application/json';
                } else {
                    this._body = String(data ?? '');
                    this._headers['Content-Type'] = this._headers['Content-Type'] || 'text/html; charset=utf-8';
                }
            },

            json(data: any) {
                if (this._sent) return;
                this._sent = true;
                this._body = JSON.stringify(data);
                this._headers['Content-Type'] = 'application/json';
            },

            redirect(url: string, status = 302) {
                if (this._sent) return;
                this._sent = true;
                this._status = status;
                this._redirectUrl = url;
            },

            cookie(name: string, value: string, options: SetCookieOptions = {}) {
                let cookieStr = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
                if (options.maxAge !== undefined) cookieStr += `; Max-Age=${options.maxAge}`;
                if (options.httpOnly) cookieStr += '; HttpOnly';
                if (options.secure) cookieStr += '; Secure';
                if (options.path) cookieStr += `; Path=${options.path}`;
                this._cookies.push(cookieStr);
            },

            clearCookie(name: string) {
                this.cookie(name, '', { maxAge: 0 });
            },

            async render(viewName: string, data?: Record<string, any>) {
                if (this._sent) return;
                try {
                    const mergedData = { ...this._locals, ...(data || {}) };
                    const html = await req.app.renderView(viewName, mergedData);
                    this._sent = true;
                    this._body = html;
                    this._headers['Content-Type'] = 'text/html; charset=utf-8';
                } catch (err) {
                    console.error('Render error:', err);
                    this._status = 500;
                    this._sent = true;
                    this._body = 'Template rendering error';
                    this._headers['Content-Type'] = 'text/html; charset=utf-8';
                }
            },

            type(contentType: string) {
                this._headers['Content-Type'] = contentType;
                return this;
            }
        };

        // ---- Collect all middleware and handlers ----
        const allMiddleware: MiddlewareEntry[] = [
            // Routes registered via app.get/post/put/delete take priority
            { prefix: '/', handler: this._router, isRouter: true },
            ...this._middleware,
        ];

        for (const mw of allMiddleware) {
            if (mw.isRouter && mw.handler instanceof Router) {
                const router = mw.handler;
                const relPath = pathname.startsWith(mw.prefix)
                    ? '/' + pathname.slice(mw.prefix.length).replace(/^\/+/, '')
                    : null;

                if (relPath !== null) {
                    const match = router._match(method, relPath);
                    if (match) {
                        req.params = match.params;
                        handlers.push(...match.handlers);
                        continue;
                    }
                    handlers.push(...router._middleware);
                    for (const sub of router._subRouters) {
                        allMiddleware.push({ prefix: mw.prefix, handler: sub, isRouter: true });
                    }
                }
            } else if (typeof mw.handler === 'function') {
                if (mw.prefix === '/' || pathname.startsWith(mw.prefix)) {
                    handlers.push(mw.handler as RouteHandler);
                }
            }
        }

        // ---- Execute handler chain ----
        const next = async () => {
            if (res._sent) return;
            if (handlerIndex >= handlers.length) {
                if (!res._sent) {
                    res._status = 404;
                    res.send('Not Found');
                }
                return;
            }
            const handler = handlers[handlerIndex++];
            try {
                const result = handler(req, res, next);
                if (result instanceof Promise) await result;
            } catch (err) {
                console.error('Handler error:', err);
                if (!res._sent) {
                    res._status = 500;
                    res.send('Internal Server Error');
                }
            }
        };

        await next();

        // ---- Build final Response ----
        if (res._sent && res._redirectUrl) {
            const headers: Record<string, string | string[]> = { Location: res._redirectUrl };
            if (res._cookies.length > 0) headers['Set-Cookie'] = res._cookies;
            return new Response(null, { status: res._status || 302, headers: headers as any });
        }

        const responseHeaders: Record<string, string | string[]> = { ...res._headers };
        if (res._cookies.length > 0) {
            responseHeaders['Set-Cookie'] = res._cookies;
        }

        if (res._body instanceof Blob) {
            return new Response(res._body, { status: res._status || 200, headers: responseHeaders as any });
        }

        const bodyStr = typeof res._body === 'string' ? res._body : '';
        return new Response(bodyStr, {
            status: res._status || 200,
            headers: responseHeaders as any,
        });
    }
}
