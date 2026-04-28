import https from "node:https";

/**
 * Fetch live data from Google Apps Script web app.
 * Zero caching - reads the sheet directly every call.
 */
function httpsGetFollow(url) {
  return new Promise((resolve, reject) => {
    const doGet = (reqUrl) => {
      const parsed = new URL(reqUrl);
      https
        .get(
          {
            hostname: parsed.hostname,
            path: parsed.pathname + parsed.search,
            headers: { "User-Agent": "sales-dashboard/1.0" },
            rejectUnauthorized: false,
          },
          (res) => {
            /* Apps Script always 302-redirects once */
            if (
              res.statusCode >= 300 &&
              res.statusCode < 400 &&
              res.headers.location
            ) {
              doGet(res.headers.location);
              return;
            }
            const chunks = [];
            res.on("data", (c) => chunks.push(c));
            res.on("end", () => {
              const body = Buffer.concat(chunks).toString("utf-8");
              if (res.statusCode >= 400) {
                reject(
                  new Error(
                    `Apps Script ${res.statusCode}: ${body.slice(0, 300)}`
                  )
                );
              } else {
                resolve(JSON.parse(body));
              }
            });
          }
        )
        .on("error", reject);
    };
    /* Cache-buster so proxies never serve stale */
    const sep = url.includes("?") ? "&" : "?";
    doGet(`${url}${sep}t=${Date.now()}`);
  });
}

export async function getSheetData() {
  const url = process.env.APPS_SCRIPT_URL;
  if (!url) throw new Error("APPS_SCRIPT_URL not set in environment");
  return httpsGetFollow(url);
}
