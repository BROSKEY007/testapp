import { rateLimit } from "express-rate-limit";
// 60 requests per minute per client IP. Needs TRUST_PROXY set correctly behind a proxy,
// otherwise every visitor shares the proxy's address and one limit.
export const apiRateLimit = () =>
  rateLimit({
    windowMs: 60000,
    limit: 60,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many requests. Please wait a minute and retry." },
  });
