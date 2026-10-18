'use strict';
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const apiRoutes = require("./routes");
const errorHandler = require("./middlewares/errorHandler");

const app = express();

// Security headers
app.use(helmet());

if (process.env.TRUST_PROXY_HOPS !== undefined && process.env.TRUST_PROXY_HOPS !== '') {
    const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS);
    if (!Number.isSafeInteger(trustProxyHops) || trustProxyHops < 0) {
        throw new Error('TRUST_PROXY_HOPS must be a non-negative integer');
    }
    app.set('trust proxy', trustProxyHops);
}

// Middleware
const allowedOrigins = (process.env.WEB_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
        if (/^https?:\/\//i.test(origin)) return new URL(origin).origin;
        return `https://${origin}`;
    });

app.use(cors({
    origin(origin, callback) {
        if (!origin || (process.env.NODE_ENV !== "production" && allowedOrigins.length === 0)) {
            return callback(null, true);
        }
        return callback(null, allowedOrigins.includes(origin));
    },
}));
app.use(express.json({ limit: "1mb" }));

app.use("/api", apiRoutes);

// 404 handler for unknown routes
app.use((req, res) => {
    res.status(404).json({ status: "error", message: "Route not found" });
});

// Central error handler (must be last)
app.use(errorHandler);

module.exports = app;
