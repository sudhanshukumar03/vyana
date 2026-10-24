"""Authenticate before parsing and bound streamed bodies, including chunked requests."""
import asyncio
import hmac
import os
from starlette.responses import JSONResponse


class InternalBoundary:
    def __init__(self, app):
        self.app = app
        self.slots = asyncio.Semaphore(8)

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http' or scope['path'] == '/health/live':
            return await self.app(scope, receive, send)
        headers = dict(scope['headers'])
        secret = os.environ.get('AI_INTERNAL_SECRET', '')
        provided = headers.get(b'x-ai-key', b'').decode('latin-1')
        if len(secret) < 32 or not hmac.compare_digest(provided, secret):
            return await JSONResponse({'error': 'Internal authentication required'}, status_code=401)(scope, receive, send)
        owner = headers.get(b'x-owner-id', b'').decode('latin-1')
        if not owner.isdecimal() or len(owner) > 10:
            return await JSONResponse({'error': 'Authenticated owner required'}, status_code=403)(scope, receive, send)
        if self.slots.locked():
            return await JSONResponse({'error': 'AI busy. Retry later.'}, status_code=429)(scope, receive, send)
        async with self.slots:
            chunks = []
            total = 0
            while True:
                message = await receive()
                if message['type'] == 'http.disconnect':
                    return
                total += len(message.get('body', b''))
                if total > 15 * 1024 * 1024:
                    return await JSONResponse({'error': 'Request too large'}, status_code=413)(scope, receive, send)
                chunks.append(message.get('body', b''))
                if not message.get('more_body', False):
                    break
            body = b''.join(chunks)
            sent = False

            async def replay():
                nonlocal sent
                if not sent:
                    sent = True
                    return {'type': 'http.request', 'body': body, 'more_body': False}
                return await receive()

            await self.app(scope, replay, send)
