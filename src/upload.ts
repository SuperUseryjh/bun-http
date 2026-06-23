import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import type { RouteHandler, ExtendedRequest, ExtendedResponse } from './types';

// ============================================================
// UploadHandler — File Upload Handler
// ============================================================

export class UploadHandler {
    private dest: string;

    constructor(options: { dest: string }) {
        this.dest = options.dest;
        fs.mkdirSync(this.dest, { recursive: true });
    }

    single(fieldName: string): RouteHandler {
        return async (req: ExtendedRequest, _res: ExtendedResponse, next: () => Promise<void>) => {
            const file = req._files?.[fieldName];
            if (file) {
                const ext = path.extname(file.name) || '';
                // Use UUID for unique filenames
                const fileName = `${crypto.randomUUID()}${ext}`;
                const filePath = path.join(this.dest, fileName);
                await Bun.write(filePath, new Response(file.stream()));
                req.file = {
                    fieldname: fieldName,
                    originalname: file.name,
                    path: filePath,
                    size: file.size,
                    mimetype: file.type,
                    filename: fileName,
                    destination: this.dest,
                };
            }
            next();
        };
    }
}
