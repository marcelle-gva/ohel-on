"use client";

import { useEffect } from "react";

const OAUTH_HASH_KEYS = [
  "access_token",
  "refresh_token",
  "error",
  "error_description",
  "error_code",
];

export function OAuthHashRelay() {
  useEffect(() => {
    const fragment = window.location.hash.replace(/^#/, "");
    if (!fragment) return;

    const params = new URLSearchParams(fragment);
    if (!OAUTH_HASH_KEYS.some((key) => params.has(key))) return;

    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.hash = fragment;
    window.location.replace(callbackUrl.toString());
  }, []);

  return null;
}
