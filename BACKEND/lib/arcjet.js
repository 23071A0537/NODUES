import arcjet, { shield, detectBot, tokenBucket } from "@arcjet/node";
import "dotenv/config";

export const aj = arcjet({
    key: process.env.ARCJET_KEY,
    characteristics: ["ip.src"],
    rules: [
        //shild protects app from common attacks like sql injection, xss, lfi, rce, ssti, ssrf, etc.
        shield({mode: "LIVE"}),
        detectBot({
            mode: "LIVE",
            //block all bots except search engine bots
            allow: ["CATEGORY:SEARCH_ENGINE"],
        }),
         tokenBucket({
            mode: "LIVE",
            refillRate: 100,  // tokens per interval
            interval: 1,      // interval in SECONDS
            capacity: 500,    // maximum number of tokens in the bucket
        }),
    ]
})