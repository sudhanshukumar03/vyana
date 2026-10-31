import {AddressInfo} from 'net';
import {Pool} from 'pg';
import jwt from 'jsonwebtoken';
import {randomUUID} from 'crypto';
import {io} from 'socket.io-client';
import {createApplication} from '../src/app';
import {loadConfig} from '../src/config';

it.each(['polling','websocket'])('enforces the origin policy for %s sockets before authentication',async transport=>{
  const config=loadConfig({DATABASE_URL:'postgresql://unused/origin_test',
    JWT_SECRET:'socket-origin-signing-secret-at-least-32',AI_INTERNAL_SECRET:'socket-origin-internal-secret-at-least-32'});
  const query=jest.fn().mockResolvedValue({rows:[{id:1,email:'owner@example.test',session_id:randomUUID()}]});
  const runtime=createApplication({query} as unknown as Pool,config);
  await new Promise<void>(resolve=>runtime.server.listen(0,'127.0.0.1',resolve));
  const token=jwt.sign({sid:randomUUID()},config.jwtSecret,{subject:'1',issuer:'healthguard',audience:'healthguard-web',expiresIn:'1m'});
  const socket=io(`http://127.0.0.1:${(runtime.server.address() as AddressInfo).port}`,{
    transports:[transport],auth:{token},extraHeaders:{Origin:'https://untrusted.example.test'},reconnection:false,
  });
  try {
    const result=await new Promise<string>(resolve=>{
      socket.once('connect',()=>resolve('connected'));socket.once('connect_error',()=>resolve('rejected'));
    });
    expect(result).toBe('rejected');expect(query).not.toHaveBeenCalled();
  } finally {socket.disconnect();await new Promise<void>(resolve=>runtime.io.close(()=>resolve()));}
});
