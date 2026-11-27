import http from "node:http";
import https from "node:https";
import tls from "node:tls";
import { HttpError } from "./auth";

/**
 * GET for AKTU servers (erp.aktu.ac.in, fms.aktu.ac.in). Their certificate chains end at
 * "SSL.com TLS RSA Root CA 2022", which browsers trust but Node's bundled CA list does not,
 * so fetch() fails with UNABLE_TO_GET_ISSUER_CERT_LOCALLY. This adds that one public root
 * for these requests only. Verification stays on.
 */

// SSL.com TLS RSA Root CA 2022, valid until 2046-08-19.
// SHA-256 8F:AF:7D:2E:2C:B4:70:9B:B8:E0:B3:36:66:BF:75:A5:DD:45:B5:DE:48:0F:8E:A8:D4:BF:E6:BE:BC:17:F2:ED
const SSL_COM_ROOT_2022 = `-----BEGIN CERTIFICATE-----
MIIFiTCCA3GgAwIBAgIQb77arXO9CEDii02+1PdbkTANBgkqhkiG9w0BAQsFADBO
MQswCQYDVQQGEwJVUzEYMBYGA1UECgwPU1NMIENvcnBvcmF0aW9uMSUwIwYDVQQD
DBxTU0wuY29tIFRMUyBSU0EgUm9vdCBDQSAyMDIyMB4XDTIyMDgyNTE2MzQyMloX
DTQ2MDgxOTE2MzQyMVowTjELMAkGA1UEBhMCVVMxGDAWBgNVBAoMD1NTTCBDb3Jw
b3JhdGlvbjElMCMGA1UEAwwcU1NMLmNvbSBUTFMgUlNBIFJvb3QgQ0EgMjAyMjCC
AiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBANCkCXJPQIgSYT41I57u9nTP
L3tYPc48DRAokC+X94xI2KDYJbFMsBFMF3NQ0CJKY7uB0ylu1bUJPiYYf7ISf5OY
t6/wNr/y7hienDtSxUcZXXTzZGbVXcdotL8bHAajvI9AI7YexoS9UcQbOcGV0ins
S657Lb85/bRi3pZ7QcacoOAGcvvwB5cJOYF0r/c0WRFXCsJbwST0MXMwgsadugL3
PnxEX4MN8/HdIGkWCVDi1FW24IBydm5MR7d1VVm0U3TZlMZBrViKMWYPHqIbKUBO
L9975hYsLfy/7PO0+r4Y9ptJ1O4Fbtk085zx7AGL0SDGD6C1vBdOSHtRwvzpXGk3
R2azaPgVKPC506QVzFpPulJwoxJF3ca6TvvC0PeoUidtbnm1jPx7jMEWTO6Af77w
dr5BUxIzrlo4QqvXDz5BjXYHMtWrifZOZ9mxQnUjbvPNQrL8VfVThxc7wDNY8VLS
+YCk8OjwO4s4zKTGkH8PnP2L0aPP2oOnaclQNtVcBdIKQXTbYxE3waWglksejBYS
d66UNHsef8JmAOSqg+qKkK3ONkRN0VHpvB/zagX9wHQfJRlAUW7qglFA35u5CCoG
AtUjHBPW6dvbxrB6y3snm/vg1UYk7RBLY0ulBY+6uB0rpvqR4pJSvezrZ5dtmi2f
gTIFZzL7SAg/2SW4BCUvAgMBAAGjYzBhMA8GA1UdEwEB/wQFMAMBAf8wHwYDVR0j
BBgwFoAU+y437uOEeicuzRk1sTN8/9REQrkwHQYDVR0OBBYEFPsuN+7jhHonLs0Z
NbEzfP/UREK5MA4GA1UdDwEB/wQEAwIBhjANBgkqhkiG9w0BAQsFAAOCAgEAjYlt
hEUY8U+zoO9opMAdrDC8Z2awms22qyIZZtM7QbUQnRC6cm4pJCAcAZli05bg4vsM
QtfhWsSWTVTNj8pDU/0quOr4ZcoBwq1gaAafORpR2eCNJvkLTqVTJXojpBzOCBvf
R4iyrT7gJ4eLSYwfqUdYe5byiB0YrrPRpgqU+tvT5TgKa3kSM/tKWTcWQA673vWJ
DPFs0/dRa1419dvAJuoSc06pkZCmF8NsLzjUo3KUQyxi4U5cMj29TH0ZR6LDSeeW
P4+a0zvkEdiLA9z2tmBVGKaBUfPhqBVq6+AL8BQx1rmMRTqoENjwuSfr98t67wVy
lrXEj5ZzxOhWc5y8aVFjvO9nHEMaX3cZHxj4HCUp+UmZKbaSPaKDN7EgkaibMOlq
bLQjk2UEqxHzDh1TJElTHaE/nUiSEeJ9DU/1172iWD54nR4fK/4huxoTtrEoZP2w
AgDHbICivRZQIA9ygV/MlP+7mea6kMvq+cYMwq7FGc4zoWtcu358NFcXrfA/rs3q
r5nsLFR+jM4uElZI7xc7P0peYNLcdDa8pUNjyw9bowJWCZ4kLOGGgYz+qxcs+sji
Mho6/4UIyYOf8kpIEFR3N+2ivEC+5BB09+Rbu7nzifmPQdjH5FCQNYA+HLhNkNPU
98OwoX6EyneSMSy4kLGCenROmxMmtNVQZlR4rmA=
-----END CERTIFICATE-----`;

const agent = new https.Agent({ ca: [...tls.rootCertificates, SSL_COM_ROOT_2022], keepAlive: false });
const ALLOWED_HOST = /(^|\.)aktu\.ac\.in$/;

type Options = { timeoutMs: number; maxBytes: number };

/**
 * Downloads an AKTU URL into memory. Follows up to 4 redirects, only within aktu.ac.in, and sends
 * back cookies set on the way (the ERP pages redirect in a loop until their cookie check passes).
 */
export function aktuGet(url: string, options: Options, redirects = 4, cookie = ""): Promise<Buffer> {
  const { timeoutMs, maxBytes } = options;
  const target = new URL(url);
  if (!ALLOWED_HOST.test(target.hostname)) return Promise.reject(new HttpError(400, "Only aktu.ac.in links can be fetched."));
  const secure = target.protocol === "https:";
  const client = secure ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.get(
      target,
      { ...(secure && { agent }), headers: { "User-Agent": "Mozilla/5.0 (compatible; BTechHubBot/1.0)", ...(cookie && { Cookie: cookie }) }, timeout: timeoutMs },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          if (redirects <= 0) return reject(new HttpError(502, "AKTU redirected too many times."));
          const set = (res.headers["set-cookie"] ?? []).map((c) => c.split(";")[0]);
          const next = [cookie, ...set].filter(Boolean).join("; ");
          return resolve(aktuGet(new URL(res.headers.location, target).href, options, redirects - 1, next));
        }
        if (status !== 200) {
          res.resume();
          return reject(new HttpError(502, `AKTU returned ${status}.`));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) return req.destroy(new HttpError(422, "The file from AKTU is too large."));
          chunks.push(chunk);
        });
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new HttpError(504, "AKTU took too long to respond.")));
    req.on("error", reject);
  });
}
