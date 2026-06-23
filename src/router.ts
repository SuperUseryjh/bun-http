import type { RequestParams, RouteHandler, RouteEntry } from './types';

// ============================================================
// Router — Route Manager
// ============================================================

export class Router {
    _routes: RouteEntry[] = [];
    _prefix: string = '';
    _middleware: RouteHandler[] = [];
    _subRouters: Router[] = [];

    private _addRoute(method: string, pathPattern: string, handlers: RouteHandler[]): void {
        const paramNames: string[] = [];
        const regexStr = pathPattern.replace(/:([^/]+)/g, (_: string, name: string) => {
            paramNames.push(name);
            return '([^/]+)';
        });
        const regex = new RegExp(`^${regexStr}$`);
        this._routes.push({ method: method.toUpperCase(), regex, paramNames, handlers });
    }

    get(path: string, ...handlers: RouteHandler[]): void { this._addRoute('GET', path, handlers); }
    post(path: string, ...handlers: RouteHandler[]): void { this._addRoute('POST', path, handlers); }
    put(path: string, ...handlers: RouteHandler[]): void { this._addRoute('PUT', path, handlers); }
    delete(path: string, ...handlers: RouteHandler[]): void { this._addRoute('DELETE', path, handlers); }

    use(handler: Router | RouteHandler): void {
        if (handler instanceof Router) {
            this._subRouters.push(handler);
        } else if (typeof handler === 'function') {
            this._middleware.push(handler);
        }
    }

    /** Clear all routes, middleware and sub-routers for hot reload */
    clearRoutes(): void {
        this._routes = [];
        this._middleware = [];
        this._subRouters = [];
    }

    _match(method: string, pathname: string): { params: RequestParams; handlers: RouteHandler[] } | null {
        for (const route of this._routes) {
            if (route.method !== method) continue;
            const m = pathname.match(route.regex);
            if (m) {
                const params: RequestParams = {};
                route.paramNames.forEach((name, i) => {
                    params[name] = decodeURIComponent(m[i + 1]);
                });
                return { params, handlers: route.handlers };
            }
        }
        return null;
    }
}
