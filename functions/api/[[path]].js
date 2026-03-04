export async function onRequest(context) {
    const url = new URL(context.request.url);

    // Build the target Worker URL: replace the Pages origin with the Worker origin
    const workerUrl =
        'https://snah-api.muhammedmusthafaameennm.workers.dev' +
        url.pathname +
        url.search;

    // Forward the request to the Worker (runs server-side on Cloudflare edge)
    const response = await fetch(workerUrl, {
        method: context.request.method,
        headers: context.request.headers,
        body: ['GET', 'HEAD'].includes(context.request.method)
            ? undefined
            : context.request.body,
    });

    return response;
}
