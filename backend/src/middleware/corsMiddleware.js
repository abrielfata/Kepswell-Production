const parseOrigins = (value) =>
    (value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

const baseOrigins = new Set([
    'http://localhost:3000',
    ...parseOrigins(process.env.FRONTEND_URL),
    ...parseOrigins(process.env.FRONTEND_URLS),
]);

const isVercelPreviewOrigin = (origin) => {
    if (!origin) {
        return false;
    }

    try {
        const { hostname, protocol } = new URL(origin);
        return protocol === 'https:' && hostname.endsWith('.vercel.app');
    } catch (error) {
        return false;
    }
};

// CORS middleware with origin restriction for production
module.exports = (req, res, next) => {
    const origin = req.headers.origin;
    const isAllowed = !origin || baseOrigins.has(origin) || isVercelPreviewOrigin(origin);

    if (isAllowed && origin) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Vary', 'Origin');
    }

    res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept, Authorization'
    );
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }

    next();
};
