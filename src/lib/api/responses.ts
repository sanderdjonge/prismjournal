export function ok(data: unknown): Response {
  return Response.json(data, { status: 200 });
}

export function created(data: unknown): Response {
  return Response.json(data, { status: 201 });
}

export function badRequest(error: string): Response {
  return Response.json({ error }, { status: 400 });
}

export function unauthorized(): Response {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

export function forbidden(): Response {
  return Response.json({ error: 'Forbidden' }, { status: 403 });
}

export function notFound(resource: string): Response {
  return Response.json({ error: `${resource} not found` }, { status: 404 });
}

export function internalError(): Response {
  return Response.json({ error: 'Internal server error' }, { status: 500 });
}
