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

const getVercelHostPrefix = (origin) => {
    try {
        const { hostname } = new URL(origin);
        if (!hostname.endsWith('.vercel.app')) {
            return null;
        }

        return hostname.replace('.vercel.app', '').toLowerCase();
    } catch (error) {
        return null;
    }
};

const configuredVercelPrefixes = new Set(
    [...baseOrigins]
        .map((origin) => getVercelHostPrefix(origin))
        .filter(Boolean)
);

/**
 * Check if origin is a Vercel preview deployment for THIS project.
 * Requires VERCEL_PROJECT_SLUG env var (e.g., "live-session-reporting").
 * If slug is not set, all preview origins are rejected (secure default).
 */
const isVercelPreviewOrigin = (origin) => {
    if (!origin) {
        return false;
    }

    try {
        const { hostname, protocol } = new URL(origin);
        if (protocol !== 'https:' || !hostname.endsWith('.vercel.app')) {
            return false;
        }

        // Only allow preview deployments that match our project slug
        const slug = process.env.VERCEL_PROJECT_SLUG;
        if (slug && hostname.includes(slug)) {
            return true;
        }

        // Fallback: allow preview domains that belong to configured Vercel origin(s)
        // Example:
        // configured: kepswell-frontend.vercel.app
        // preview:    kepswell-frontend-git-main-team.vercel.app
        const incomingPrefix = getVercelHostPrefix(origin);
        if (!incomingPrefix) {
            return false;
        }

        return [...configuredVercelPrefixes].some(
            (prefix) => incomingPrefix === prefix || incomingPrefix.startsWith(`${prefix}-`)
        );
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
    res.header('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }

    next();
};
