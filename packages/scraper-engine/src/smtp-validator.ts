import { randomBytes } from "node:crypto";
import { promises as dns } from "node:dns";
import { Socket } from "node:net";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // dns.setServers may be unsupported in some environments
}

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "10minutemail.com",
  "throwawaymail.com",
  "yopmail.com",
  "trashmail.com",
  "sharklasers.com",
  "guerrillamailblock.com",
  "pokemail.net",
  "spam4.me",
  "grr.la",
  "guerrillamail.org",
  "guerrillamail.net",
  "guerrillamail.biz",
  "guerrillamail.de",
  "guerrillamail.info",
  "fakeinbox.com",
  "moakt.com",
  "dispostable.com",
  "maildrop.cc",
  "harakirimail.com",
  "getairmail.com",
  "emailondeck.com",
  "temp-mail.org",
  "tempmail.ninja",
  "throwaway.email",
  "mailnesia.com",
  "spambox.us",
  "spambox.xyz",
  "trash-mail.com",
  "mailcatch.com",
  "mintemail.com",
  "mytrashmail.com",
  "nwytg.com",
  "objectmail.com",
  "obobbo.com",
  "oneoffemail.com",
  "owlymail.com",
  "pookmail.com",
  "rcpt.at",
  "sendspamhere.com",
  "sibmail.com",
  "sneakemail.com",
  "spamspot.com",
  "tempr.email",
  "tmpmail.org",
  "wegwerfmail.de",
  "wegwerfmail.net",
  "wegwerfmail.org",
  "wh4f.org",
  "whyspam.me",
  "wuzup.net",
  "xoxy.net",
  "ypmail.webarnak.fr.eu.org",
  "yopmail.fr",
  "yopmail.net",
  "yopmail.org",
  "zehnminutenmail.de",
  "0wnd.net",
  "0wnd.org",
  "10mail.org",
  "20mail.eu",
  "20mail.it",
  "2prong.com",
  "33mail.com",
]);

const RFC5322_REGEX =
  /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

export type SmtpValidationStatus =
  | "deliverable"
  | "undeliverable"
  | "catch-all"
  | "disposable"
  | "invalid_syntax"
  | "no_mx"
  | "mx_verified"
  | "timeout"
  | "unreachable"
  | "greylisted"
  | "error";

export interface SmtpValidationResult {
  email: string;
  status: SmtpValidationStatus;
  isDeliverable: boolean;
  mxHost: string | null;
  smtpCode: number | null;
  smtpMessage: string | null;
  isCatchAll: boolean;
  isDisposable: boolean;
  durationMs: number;
}

export interface SmtpValidatorOptions {
  heloDomain?: string;
  timeout?: number;
  probeSender?: string;
  port?: number;
}

function isRfc5322Valid(email: string): boolean {
  if (email.length > 254) return false;
  return RFC5322_REGEX.test(email);
}

function extractDomain(email: string): string {
  const idx = email.lastIndexOf("@");
  return idx === -1 ? "" : email.slice(idx + 1).toLowerCase();
}

function isDisposableDomain(email: string): boolean {
  const domain = extractDomain(email);
  if (!domain) return true;
  if (DISPOSABLE_DOMAINS.has(domain)) return true;
  for (const disposable of DISPOSABLE_DOMAINS) {
    if (domain.endsWith(`.${disposable}`)) return true;
  }
  return false;
}

function generateProbeAddress(domain: string): string {
  const ts = Date.now().toString(36);
  const rand = randomBytes(6).toString("hex");
  return `probe_${ts}_${rand}@${domain}`;
}

interface MxRecord {
  host: string;
  priority: number;
}

interface DoHAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

interface DoHResponse {
  Status: number;
  TC?: boolean;
  RD?: boolean;
  RA?: boolean;
  AD?: boolean;
  CD?: boolean;
  Question?: Array<{ name: string; type: number }>;
  Answer?: DoHAnswer[];
  Authority?: DoHAnswer[];
}

async function resolveMxViaDoH(domain: string): Promise<MxRecord[]> {
  const url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) return [];

    const data = (await response.json()) as DoHResponse;

    if (!data.Answer || data.Answer.length === 0) return [];

    const records: MxRecord[] = [];
    for (const answer of data.Answer) {
      const parts = answer.data.split(/\s+/);
      if (parts.length < 2) continue;
      const priority = parseInt(parts[0], 10);
      const host = parts[1].replace(/\.$/, "");
      if (!isNaN(priority) && host.length > 0) {
        records.push({ host, priority });
      }
    }

    return records.sort((a, b) => a.priority - b.priority);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function resolveMxHosts(domain: string, timeout: number): Promise<MxRecord[]> {
  let records: Array<{ exchange: string; priority: number }>;

  try {
    records = await dns.resolveMx(domain);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (
      code === "ECONNREFUSED" ||
      code === "ETIMEDOUT" ||
      code === "ENETUNREACH" ||
      code === "EAI_AGAIN"
    ) {
      // UDP port 53 blocked — fallback to DNS-over-HTTPS
      const dohRecords = await resolveMxViaDoH(domain);
      if (dohRecords.length > 0) {
        return dohRecords;
      }
    }
    return [];
  }

  const ttlController = new AbortController();
  const ttlSignal = ttlController.signal;
  const ttlId = setTimeout(() => ttlController.abort(), timeout);

  try {
    const resolved = await Promise.race([
      Promise.all(
        records
          .sort((a, b) => a.priority - b.priority)
          .map(async (r) => {
            try {
              const addrs = await dns.resolve4(r.exchange);
              if (addrs.length > 0) {
                return { host: r.exchange, priority: r.priority };
              }
            } catch {
              // host unresolvable, try next
            }
            return null;
          })
      ),
      new Promise<null[]>((_, reject) => {
        const onAbort = () => reject(new Error("DNS_TIMEOUT"));
        ttlSignal.addEventListener("abort", onAbort, { once: true });
      }),
    ]);

    return (resolved.filter((r): r is MxRecord => r !== null) as MxRecord[]).sort(
      (a, b) => a.priority - b.priority
    );
  } finally {
    clearTimeout(ttlId);
  }
}

async function resolveFallbackA(domain: string, timeout: number): Promise<string | null> {
  const controller = new AbortController();
  const signal = controller.signal;
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const addrs = await Promise.race([
      dns.resolve4(domain),
      new Promise<never>((_, reject) => {
        const onAbort = () => reject(new Error("DNS_TIMEOUT"));
        signal.addEventListener("abort", onAbort, { once: true });
      }),
    ]);
    if (addrs.length > 0) {
      return domain;
    }
  } catch {
    // no A record
  } finally {
    clearTimeout(timer);
  }
  return null;
}

function isRetriableSmtpCode(code: number): boolean {
  return code === 421 || code === 450 || code === 451 || code === 452;
}

function isHardBounceSmtpCode(code: number): boolean {
  return code >= 550 && code <= 554;
}

function parseSmtpLine(line: string): { code: number; message: string; isLast: boolean } | null {
  if (line.length < 4) return null;
  const codeStr = line.slice(0, 3);
  const code = parseInt(codeStr, 10);
  if (isNaN(code)) return null;
  const sep = line[3];
  if (sep !== " " && sep !== "-") return null;
  return {
    code,
    message: line.slice(4).trim(),
    isLast: sep === " ",
  };
}

function bufferSmtpResponses(socket: Socket, timeoutMs: number): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let buffer = "";
    let settled = false;

    const idle = setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(new Error("SMTP_READ_TIMEOUT"));
      }
    }, timeoutMs);

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      resetIdle();
    };

    const onClose = () => {
      if (!settled) {
        settled = true;
        cleanup();
        resolve(buffer);
      }
    };

    const onError = (err: Error) => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(err);
      }
    };

    let idleTimer: ReturnType<typeof setTimeout>;
    const resetIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (!settled) {
          settled = true;
          cleanup();
          reject(new Error("SMTP_READ_TIMEOUT"));
        }
      }, timeoutMs);
    };

    const cleanup = () => {
      clearTimeout(idle);
      clearTimeout(idleTimer);
      socket.removeListener("data", onData);
      socket.removeListener("close", onClose);
      socket.removeListener("error", onError);
    };

    resetIdle();
    socket.on("data", onData);
    socket.once("close", onClose);
    socket.once("error", onError);
  });
}

async function readSmtpResponse(
  socket: Socket,
  timeoutMs: number
): Promise<{ code: number; message: string; isMultiLine: boolean }> {
  let fullBuffer = "";
  let code = 0;
  let message = "";

  const raw = await bufferSmtpResponses(socket, timeoutMs);
  const lines = raw.split("\r\n").filter((l) => l.length > 0);

  if (lines.length === 0) {
    throw new Error("EMPTY_SMTP_RESPONSE");
  }

  for (const line of lines) {
    fullBuffer += line + "\r\n";
    const parsed = parseSmtpLine(line);
    if (!parsed) continue;

    code = parsed.code;
    if (parsed.isLast) {
      message = line.slice(4).trim();
      return { code, message: message || line, isMultiLine: lines.length > 1 };
    }
  }

  // If we never got a terminating line, use the last parsed response
  if (code === 0) {
    throw new Error("UNPARSEABLE_SMTP_RESPONSE");
  }
  return { code, message: fullBuffer.trim(), isMultiLine: lines.length > 1 };
}

function sendCommand(socket: Socket, command: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    socket.write(command + "\r\n", (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function safeDestroy(socket: Socket): void {
  try {
    socket.removeAllListeners();
    socket.destroy();
  } catch {
    // swallow destroy errors
  }
}

async function smtpHandshake(
  host: string,
  port: number,
  heloDomain: string,
  probeSender: string,
  targetEmail: string,
  timeoutMs: number
): Promise<{ code: number; message: string; isCatchAll: boolean }> {
  return new Promise<{ code: number; message: string; isCatchAll: boolean }>(
    (resolve, reject) => {
      const socket = new Socket();
      let settled = false;
      const domain = extractDomain(targetEmail);

      const connTimeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          safeDestroy(socket);
          reject(new Error("SMTP_CONNECT_TIMEOUT"));
        }
      }, timeoutMs);

      const finishWithError = (err: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(connTimeout);
        safeDestroy(socket);
        reject(err);
      };

      socket.once("error", (err: NodeJS.ErrnoException) => {
        if (settled) return;
        settled = true;
        clearTimeout(connTimeout);
        safeDestroy(socket);
        reject(err);
      });

      socket.once("connect", async () => {
        clearTimeout(connTimeout);

        try {
          // Step 1: Read banner
          const banner = await readSmtpResponse(socket, timeoutMs);
          if (banner.code !== 220) {
            await sendCommand(socket, "QUIT").catch(() => {});
            safeDestroy(socket);
            if (!settled) {
              settled = true;
              resolve({ code: banner.code, message: banner.message, isCatchAll: false });
            }
            return;
          }

          // Step 2: EHLO
          await sendCommand(socket, `EHLO ${heloDomain}`);
          const ehloResp = await readSmtpResponse(socket, timeoutMs);

          if (ehloResp.code === 500 || ehloResp.code === 502) {
            await sendCommand(socket, `HELO ${heloDomain}`);
            const heloResp = await readSmtpResponse(socket, timeoutMs);
            if (heloResp.code !== 250) {
              await sendCommand(socket, "QUIT").catch(() => {});
              safeDestroy(socket);
              if (!settled) {
                settled = true;
                resolve({ code: heloResp.code, message: heloResp.message, isCatchAll: false });
              }
              return;
            }
          } else if (ehloResp.code !== 250) {
            await sendCommand(socket, "QUIT").catch(() => {});
            safeDestroy(socket);
            if (!settled) {
              settled = true;
              resolve({ code: ehloResp.code, message: ehloResp.message, isCatchAll: false });
            }
            return;
          }

          // Step 3: MAIL FROM
          await sendCommand(socket, `MAIL FROM:<${probeSender}>`);
          const mailResp = await readSmtpResponse(socket, timeoutMs);
          if (mailResp.code !== 250) {
            await sendCommand(socket, "QUIT").catch(() => {});
            safeDestroy(socket);
            if (!settled) {
              settled = true;
              resolve({ code: mailResp.code, message: mailResp.message, isCatchAll: false });
            }
            return;
          }

          // Step 4: RCPT TO
          await sendCommand(socket, `RCPT TO:<${targetEmail}>`);
          const rcptResp = await readSmtpResponse(socket, timeoutMs);

          // Step 5: Catch-all detection
          let isCatchAll = false;
          if (rcptResp.code === 250 || rcptResp.code === 251) {
            await sendCommand(socket, "RSET");
            await readSmtpResponse(socket, timeoutMs).catch(() => {});

            await sendCommand(socket, `MAIL FROM:<${probeSender}>`);
            await readSmtpResponse(socket, timeoutMs).catch(() => {});

            const probeAddr = generateProbeAddress(domain);
            await sendCommand(socket, `RCPT TO:<${probeAddr}>`);
            const probeResp = await readSmtpResponse(socket, timeoutMs);
            if (probeResp.code === 250 || probeResp.code === 251) {
              isCatchAll = true;
            }
          }

          // Step 6: QUIT
          await sendCommand(socket, "QUIT").catch(() => {});
          safeDestroy(socket);

          if (!settled) {
            settled = true;
            resolve({
              code: rcptResp.code,
              message: rcptResp.message,
              isCatchAll,
            });
          }
        } catch (err) {
          finishWithError(err instanceof Error ? err : new Error(String(err)));
        }
      });

      socket.connect(port, host);
    }
  );
}

export class SmtpValidator {
  private readonly heloDomain: string;
  private readonly timeout: number;
  private readonly probeSender: string;
  private readonly port: number;

  constructor(options?: SmtpValidatorOptions) {
    this.heloDomain = options?.heloDomain ?? "localhost";
    this.timeout = options?.timeout ?? 10000;
    this.probeSender = options?.probeSender ?? `check@${this.heloDomain}`;
    this.port = options?.port ?? 25;
  }

  async validate(email: string): Promise<SmtpValidationResult> {
    const startTime = Date.now();

    const result: SmtpValidationResult = {
      email,
      status: "error",
      isDeliverable: false,
      mxHost: null,
      smtpCode: null,
      smtpMessage: null,
      isCatchAll: false,
      isDisposable: false,
      durationMs: 0,
    };

    try {
      // Step 1: RFC 5322 syntax check
      if (!isRfc5322Valid(email)) {
        result.status = "invalid_syntax";
        result.durationMs = Date.now() - startTime;
        return result;
      }

      // Step 2: Disposable domain check
      if (isDisposableDomain(email)) {
        result.status = "disposable";
        result.isDisposable = true;
        result.durationMs = Date.now() - startTime;
        return result;
      }

      // Step 3: DNS MX resolution
      const domain = extractDomain(email);
      if (!domain) {
        result.status = "invalid_syntax";
        result.durationMs = Date.now() - startTime;
        return result;
      }

      const dnsTimeout = Math.floor(this.timeout * 0.4);
      const mxRecords = await resolveMxHosts(domain, dnsTimeout);

      let targetHost: string | null = null;

      if (mxRecords.length > 0) {
        targetHost = mxRecords[0]!.host;
      } else {
        targetHost = await resolveFallbackA(domain, dnsTimeout);
      }

      if (!targetHost) {
        result.status = "no_mx";
        result.durationMs = Date.now() - startTime;
        return result;
      }

      result.mxHost = targetHost;

      // Step 4: SMTP handshake
      const smtpResult = await smtpHandshake(
        targetHost,
        this.port,
        this.heloDomain,
        this.probeSender,
        email,
        Math.floor(this.timeout * 0.6)
      );

      result.smtpCode = smtpResult.code;
      result.smtpMessage = smtpResult.message;

      if (smtpResult.code === 250 || smtpResult.code === 251) {
        if (smtpResult.isCatchAll) {
          result.status = "catch-all";
          result.isCatchAll = true;
        } else {
          result.status = "deliverable";
          result.isDeliverable = true;
        }
      } else if (isHardBounceSmtpCode(smtpResult.code)) {
        result.status = "undeliverable";
      } else if (isRetriableSmtpCode(smtpResult.code)) {
        result.status = "greylisted";
      } else {
        result.status = "undeliverable";
      }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      const message = err instanceof Error ? err.message : String(err);

      if (code === "ECONNREFUSED" || code === "ENETUNREACH" || code === "EHOSTUNREACH") {
        if (result.mxHost) {
          result.status = "mx_verified";
          result.isDeliverable = true;
          result.smtpMessage = message;
        } else {
          result.status = "unreachable";
          result.smtpMessage = message;
        }
      } else if (
        code === "ETIMEDOUT" ||
        message === "SMTP_CONNECT_TIMEOUT" ||
        message === "SMTP_READ_TIMEOUT" ||
        message === "DNS_TIMEOUT"
      ) {
        if (result.mxHost) {
          result.status = "mx_verified";
          result.isDeliverable = true;
          result.smtpMessage = message;
        } else {
          result.status = "timeout";
          result.smtpMessage = message;
        }
      } else {
        result.status = "error";
        result.smtpMessage = message;
      }
    }

    result.durationMs = Date.now() - startTime;
    return result;
  }
}

export async function validateEmail(
  email: string,
  options?: SmtpValidatorOptions
): Promise<SmtpValidationResult> {
  const validator = new SmtpValidator(options);
  return validator.validate(email);
}