import { App, Router, UploadHandler } from '../../src/index';

const app = new App();

// --- Static file serving ---
app.use(App.static('./public'));

// --- Logger middleware ---
app.use(async (req, res, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res._status} (${ms}ms)`);
});

// --- Basic routes ---
app.get('/', (req, res) => {
    res.json({ message: 'Hello from bun-http!' });
});

app.get('/hello/:name', (req, res) => {
    res.send(`Hello, ${req.params.name}!`);
});

// --- JSON POST ---
app.post('/api/echo', (req, res) => {
    res.json({ echo: req.body });
});

// --- File upload ---
const upload = new UploadHandler({ dest: './uploads' });
app.post('/upload', upload.single('file'), (req, res) => {
    if (req.file) {
        res.json({ filename: req.file.filename, size: req.file.size });
    } else {
        res.status(400).json({ error: 'No file uploaded' });
    }
});

// --- Router with sub-routing ---
const apiRouter = new Router();

apiRouter.get('/users', (req, res) => {
    res.json([{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]);
});

apiRouter.get('/users/:id', (req, res) => {
    res.json({ id: req.params.id, name: 'User' });
});

app.use('/api', apiRouter);

// --- Cookie demo ---
app.get('/set-cookie', (req, res) => {
    res.cookie('session', 'abc123', { maxAge: 3600, httpOnly: true });
    res.json({ message: 'Cookie set' });
});

// --- Start server ---
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
