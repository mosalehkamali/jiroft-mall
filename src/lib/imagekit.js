import ImageKit from "imagekit";

let client = null;

/**
 * The ImageKit client, created on first use — so a fresh store builds and runs
 * before ImageKit is configured; only an actual upload needs the keys.
 */
export function getImageKit() {
  const { IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT } = process.env;
  if (!IMAGEKIT_PUBLIC_KEY || !IMAGEKIT_PRIVATE_KEY || !IMAGEKIT_URL_ENDPOINT) {
    throw Object.assign(new Error("آپلود فایل تنظیم نشده است (IMAGEKIT_* در .env)"), { status: 503 });
  }
  client ??= new ImageKit({
    publicKey: IMAGEKIT_PUBLIC_KEY,
    privateKey: IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: IMAGEKIT_URL_ENDPOINT,
  });
  return client;
}
