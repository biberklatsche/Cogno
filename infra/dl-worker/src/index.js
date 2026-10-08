/**
 * dl.cogno.rocks: serves Cogno's update feed and release files from R2 and
 * counts update checks and downloads in Workers Analytics Engine. Nothing
 * personal is stored - no IP address, no installation id - only versions,
 * platform and country.
 *
 *   GET /update/{channel}/{target}/{arch}/{bundle_type}/{current_version}
 *       The Tauri updater's feed (update.json, written by `release:build --finalize`).
 *       The updater compares the versions itself.
 *   GET /files/{key}
 *       A published release file. Only `{base}/{channel}/releases/...` is public.
 *   GET /download/{platform}?channel=release
 *       Redirects to the newest download for macos, windows or linux.
 */

const CHANNELS = new Set(["release", "dev"]);

export default {
  async fetch(request, env) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
    }

    const url = new URL(request.url);
    const [route, ...segments] = url.pathname.split("/").filter(Boolean);

    switch (route) {
      case "update":
        return serveUpdateFeed(segments, request, env, url);
      case "files":
        return serveFile(segments, request, env, url);
      case "download":
        return redirectToDownload(segments, env, url);
      default:
        return notFound();
    }
  },
};

async function serveUpdateFeed(segments, request, env, url) {
  const [channel, target, arch, bundleType, currentVersion] = segments;

  if (segments.length !== 5 || !CHANNELS.has(channel)) {
    return notFound();
  }

  const feed = await readJson(env, `${env.BASE_PATH}/${channel}/update.json`);

  record(env, request, {
    arch,
    bundleType,
    channel,
    event: "check",
    platform: target,
    version: currentVersion,
  });

  if (feed === null) {
    return new Response(null, { status: 204 });
  }

  // Marks the download that follows as an update from `currentVersion`.
  const platforms = Object.fromEntries(
    Object.entries(feed.platforms ?? {}).map(([key, entry]) => {
      const downloadUrl = new URL(entry.url, url);
      downloadUrl.searchParams.set("via", "update");
      downloadUrl.searchParams.set("from", currentVersion);
      return [key, { ...entry, url: downloadUrl.toString() }];
    }),
  );

  return Response.json({ ...feed, platforms }, { headers: { "Cache-Control": "no-store" } });
}

async function serveFile(segments, request, env, url) {
  const key = segments.map(decodeURIComponent).join("/");
  // {base}/{channel}/releases/{tag}/{platform}/{file}
  const [base, channel, area, tag, platform, fileName] = key.split("/");

  if (base !== env.BASE_PATH || !CHANNELS.has(channel) || area !== "releases" || !fileName) {
    return notFound();
  }

  const object =
    request.method === "HEAD" ? await env.RELEASES.head(key) : await env.RELEASES.get(key);

  if (object === null) {
    return notFound();
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  headers.set("Content-Length", String(object.size));
  headers.set("Content-Disposition", `attachment; filename="${fileName}"`);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  if (request.method === "HEAD") {
    return new Response(null, { headers });
  }

  record(env, request, {
    arch: undefined,
    bundleType: fileName.split("-").at(-1)?.split(".")[0],
    channel,
    event: "download",
    from: url.searchParams.get("from") ?? undefined,
    platform,
    version: tag.replace(/^v/u, ""),
    via: url.searchParams.get("via") ?? "direct",
  });

  return new Response(object.body, { headers });
}

async function redirectToDownload(segments, env, url) {
  const [platform] = segments;
  const channel = url.searchParams.get("channel") ?? "release";

  if (segments.length !== 1 || !CHANNELS.has(channel)) {
    return notFound();
  }

  const latest = await readJson(env, `${env.BASE_PATH}/${channel}/latest.json`);
  const downloadUrl = latest?.platforms?.[platform]?.downloadUrl;

  if (typeof downloadUrl !== "string") {
    return notFound();
  }

  const target = new URL(downloadUrl);
  target.searchParams.set("via", "site");
  return Response.redirect(target.toString(), 302);
}

async function readJson(env, key) {
  const object = await env.RELEASES.get(key);
  return object === null ? null : object.json();
}

/**
 * One data point per check or download. Blob order is the query schema:
 * event, channel, platform, arch, bundle type, version, from, via, country.
 */
function record(env, request, { event, channel, platform, arch, bundleType, version, from, via }) {
  env.EVENTS.writeDataPoint({
    blobs: [
      event,
      channel,
      platform ?? "",
      arch ?? "",
      bundleType ?? "",
      version ?? "",
      from ?? "",
      via ?? "",
      request.cf?.country ?? "",
    ],
    doubles: [1],
    indexes: [event],
  });
}

function notFound() {
  return new Response("Not found", { status: 404 });
}
