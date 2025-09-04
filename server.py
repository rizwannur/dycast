import asyncio
import websockets
import time

async def echo(websocket, path):
    async for message in websocket:
        print(f'[{time.ctime()}]: ')
        print(message)
        message = "Server received message: {}".format(message)
        await websocket.send(message)

print('WebSocket server started successfully, accessible at ws://localhost:8765')

asyncio.get_event_loop().run_until_complete(websockets.serve(echo, 'localhost', 8765))
asyncio.get_event_loop().run_forever()

'''
# Create a WebSocket server
# Used to receive parsed barrage data
# Test barrage forwarding function
'''