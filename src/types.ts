// ============================================================
// Type Definitions
// ============================================================

export interface RequestParams {
    [key: string]: string;
}

export interface RequestQuery {
    [key: string]: string;
}

export interface RequestBody {
    [key: string]: any;
}

export interface Cookies {
    [key: string]: string;
}

export interface UploadedFile {
    fieldname: string;
    originalname: string;
    path: string;
    size: number;
    mimetype: string;
    filename: string;
    destination: string;
}

export interface SetCookieOptions {
    maxAge?: number;
    httpOnly?: boolean;
    secure?: boolean;
    path?: string;
}

// Forward declarations to break circular references
export interface App {}
export interface Router {}

export interface RouteHandler {
    (req: ExtendedRequest, res: ExtendedResponse, next: () => Promise<void>): void | Promise<void>;
}

export interface ExtendedRequest {
    method: string;
    path: string;
    url: string;
    query: RequestQuery;
    body: RequestBody;
    cookies: Cookies;
    headers: Headers;
    params: RequestParams;
    user: any;
    app: App;
    file: UploadedFile | null;
    _files: Record<string, File>;
    _raw: Request;
}

export interface ExtendedResponse {
    _status: number;
    _headers: Record<string, string>;
    _body: any;
    _redirectUrl: string | null;
    _cookies: string[];
    _sent: boolean;
    _locals: Record<string, any>;
    locals: Record<string, any>;
    status: (code: number) => ExtendedResponse;
    send: (data: any) => void;
    json: (data: any) => void;
    redirect: (url: string, status?: number) => void;
    cookie: (name: string, value: string, options?: SetCookieOptions) => void;
    clearCookie: (name: string) => void;
    render: (viewName: string, data?: Record<string, any>) => Promise<void>;
    type: (contentType: string) => ExtendedResponse;
}

export interface RouteEntry {
    method: string;
    regex: RegExp;
    paramNames: string[];
    handlers: RouteHandler[];
}

export interface ViewEngine {
    /** File extensions this engine handles (e.g. ['.tsx', '.jsx']) */
    extensions: string[];
    /** Render function: receives viewPath + data, returns HTML string */
    render: (viewPath: string, data: Record<string, any>) => Promise<string>;
}

export interface MiddlewareEntry {
    prefix: string;
    handler: Router | RouteHandler;
    isRouter: boolean;
}
