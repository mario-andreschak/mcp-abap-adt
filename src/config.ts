export interface SapConfig {
  url: string;
  username: string;
  password: string;
  client: string;
  caFile?: string;
  language?: string;
  rejectUnauthorized?: boolean;
}

export function getConfig(): SapConfig {
  const {
    SAP_URL: url,
    SAP_USERNAME: username,
    SAP_PASSWORD: password,
    SAP_CLIENT: client,
  } = process.env;
  if (!url || !username || !password || !client) {
    throw new Error(
      "Missing required environment variables: SAP_URL, SAP_USERNAME, SAP_PASSWORD, SAP_CLIENT",
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("SAP_URL must be an absolute HTTP(S) URL");
  }
  if (
    !["https:", "http:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    !["", "/"].includes(parsed.pathname)
  ) {
    throw new Error(
      "SAP_URL must contain only an HTTP(S) origin, without credentials, path, query or fragment",
    );
  }
  const tls = process.env.TLS_REJECT_UNAUTHORIZED ?? "1";
  if (!["0", "1"].includes(tls))
    throw new Error("TLS_REJECT_UNAUTHORIZED must be 1 (default) or 0");
  const language = process.env.SAP_LANGUAGE;
  if (language && !/^[A-Za-z]{2}$/.test(language))
    throw new Error("SAP_LANGUAGE must be a two-letter language code");
  return {
    language: language?.toUpperCase(),
    url: parsed.origin,
    username,
    password,
    client,
    caFile: process.env.SAP_CA_FILE || undefined,
    rejectUnauthorized: tls !== "0",
  };
}
